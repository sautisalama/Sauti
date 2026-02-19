# Sauti Salama: Comprehensive Matching Specification & Walkthrough

## 1. Executive Summary

The Sauti Salama Matching Engine is a multi-dimensional recommendation system designed to connect survivors of abuse with the most "clinically" and geographically appropriate verified professionals. Unlike simple search-based systems, it evaluates a survivor's entire profile against a professional's specialized capabilities and operational constraints in real-time.

---

## 2. Exhaustive Data Schema (Matching Inputs)

The algorithm consumes data from three primary tables. Below are all fields currently influencing the match results:

### A. The Survivor Request (`reports` table)

| Field                    | Data Type              | Usage in Algorithm                                                           |
| :----------------------- | :--------------------- | :--------------------------------------------------------------------------- |
| `type_of_incident`       | `incident_type` (Enum) | Primary key for selecting the Clinical Specialty Map.                        |
| `required_services`      | `text[]`               | Explicit survivor requests that grant a +20 point bonus.                     |
| `urgency`                | `urgency_level` (Enum) | Determines the final scoring multiplier (1.0x to 1.15x).                     |
| `latitude` / `longitude` | `float8`               | Used as the origin point for Haversine distance calculations.                |
| `preferred_language`     | `language_type` (Enum) | Triggers a +15 point bonus match against professional traits.                |
| `gender`                 | `gender_type` (Enum)   | Triggers a +10 point bonus for specific gender preferences.                  |
| `consent`                | `consent_type` (Enum)  | **Negative Weighting**: If 'no', Legal services are penalized by -50 points. |
| `additional_info`        | `jsonb`                | Parsed for `special_needs` (e.g., `disabled`, `queer_support`).              |
| `record_only`            | `boolean`              | **Control Flag**: Prevents matching for non-child cases if set to true.      |

### B. The Professional Service (`support_services` table)

| Field                    | Data Type              | Usage in Algorithm                                             |
| :----------------------- | :--------------------- | :------------------------------------------------------------- |
| `service_types`          | `support_service_type` | Evaluated against the Clinical Specialty Map.                  |
| `coverage_area_radius`   | `integer` (km)         | Defines the maximum proximity boundary. `null` = Remote.       |
| `availability`           | `availability_type`    | Weighted against the Report Urgency level (1-10 points).       |
| `verification_status`    | `text`                 | **Hard Filter**: Only `verified` services are considered.      |
| `specialises_in_...`     | `boolean`              | Flags for Disability, Queer Support, and Child specialization. |
| `latitude` / `longitude` | `float8`               | Destination point for proximity calculations.                  |

### C. The Professional Profile (`profiles` table)

| Field                      | Data Type | Usage in Algorithm                                                        |
| :------------------------- | :-------- | :------------------------------------------------------------------------ |
| `professional_title`       | `text`    | Maps to `PROFESSIONAL_AUTHORITY` scores (e.g., "Doctor" knows "Medical"). |
| `settings`                 | `jsonb`   | Parsed for `matching_traits` (Gender and Languages).                      |
| `bio` / `city` / `country` | `text`    | Snapshotted into `matched_services` for survivor UI display.              |

---

## 3. The Matching Workflow (The Algorithm)

The engine follows a strict 8-step pipeline to ensure high-fidelity matches:

### Step 1: Candidate Aggregation

The engine compiles a unified list of "Candidate" objects by merging:

- **Verified Support Services**: Linked to their owner's profile.
- **Standalone Experts (HRDs & Paralegals)**: Individuals who don't have a formal "Service" entity but provide verified expertise. HRDs focus on "Other" support, while Paralegals are automatically mapped to "Legal" services.

### Level 2: Clinical Specialty Map (The Standalone Logic)

- **Human Rights Defenders**: Default radius 100km, Focus on "Other" / Protection.
- **Paralegals**: Default radius 60km, Focus on "Legal" / Front-line legal aid.

### Step 2: Service-Type Compatibility (+25 to +45 pts)

It uses a `INCIDENT_SPECIALTY_MAP` to determine relevance:

- **Primary Match**: e.g., Physical Incident -> Medical Service (+25 pts).
- **Secondary Match**: e.g., Physical Incident -> Mental Health Service (+15 pts).
- **Explicit Request**: If the survivor manually requested the service type (+20 pts).

### Step 3: Proximity Scoring (0 to 20 pts)

- For locals: $Score = 20 \times (1 - \frac{Distance}{Radius})$.
- For remote: Proximity score is skipped, but the candidate is flagged with "Remote service available".

### Step 4: Demographic Alignment (+10 to +30 pts)

- **Language**: Exact match on preferred language (+15 pts).
- **Gender**: Exact match on survivor's gender preference (+10 pts).
- **Special Needs**: Matching `special_needs` flags from the report to specialization toggles on the service (+15 pts each).

### Step 5: Professional Authority (0 to 10 pts)

A static matrix boosts specifically qualified titles. A **Lawyer** matching a **Trafficking** report gets +10, whereas a **Paralegal** gets +4, reflecting the higher capacity for high-stakes legal intervention.

### Step 6: Negative Weights & Safety Filters

- **Consent Check**: If a survivor withholds legal consent, Professionals with "Lawyer" or "Law Firm" titles are penalized (-50 pts), effectively filtering them out unless the survivor changes their mind.
- **Child Safety**: If a report involves children, the algorithm ignores `record_only` and forces a match with specialists capable of child protection.

### Step 7: Load Balancing (Dynamic Penalty)

The engine calls `get_active_case_count`. For every active case a professional is currently handling, their score for the new match is reduced by **5 points**. This prevents "super-providers" from being overwhelmed and ensures survivors get matched with responsive professionals.

### Step 8: Urgency Scaling & Selection

The final raw score is multiplied by the urgency factor (1.15x or 1.05x). Only the **Top 5** candidates scoring above **10 points** are persisted.

---

## 4. Nuances & Recent Enhancements (Walkthrough)

### Remote vs. Local Heuristics

One of the most significant recent changes is the removal of the explicit `is_remote` column in favor of an **Implicit Heuristic**.

- **The Nuance**: We now treat `coverage_area_radius === null` as the single source of truth for remote services. This simplifies the DB schema and allows the UI to dynamically toggle proximity logic based on a single numeric field.

### HRD Merging Logic

Standalone Human Rights Defenders (HRDs) often operate without a fixed "Service" address but are vital for protection.

- **The Change**: The algorithm now performs a `LEFT JOIN` or separate query to find verified profiles with the title "Human rights defender" who **do not** have a linked `support_service`. It synthesizes a candidate object for them so they are weighted identically to formal organizations.

### The "Address Snapshot" (Privacy & Speed)

When a match is found, we store the provider's Bio and Location (City/Country) in the `matched_services.description` and `matched_services.notes` columns.

- **Why?**: This creates a "snapshot" of the provider's status at the time of the match. If the provider later edits their profile, the survivor's match record retains the context that led to the connection, and it avoids complex triple-joins when loading the survivor's dashboard list.

### Real-time Escalation Flow

Matching isn't just a one-time event.

- **The Flow**: If a survivor initially submits a "Record Only" report (no match), they can later click "Request Help". This triggers the `/api/reports/[id]/escalate` route, which flips the `record_only` bit and **reruns the entire matching engine**. This ensures help is available exactly when the survivor is ready for it.
