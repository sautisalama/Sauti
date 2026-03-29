# Sauti Salama: Matching Engine — Complete System Specification

**Version:** 2.0  
**Classification:** Internal Engineering & Product Reference  
**Purpose:** Single Source of Truth for Matching Algorithm, Case Lifecycle, UX Flows, and Edge Case Handling

---

## Table of Contents

1. [Platform Overview & Philosophy](#1-platform-overview--philosophy)
2. [Actor Taxonomy](#2-actor-taxonomy)
3. [The Matching Problem — Framing](#3-the-matching-problem--framing)
4. [Algorithm Research & Inspiration](#4-algorithm-research--inspiration)
5. [Data Model for Matching](#5-data-model-for-matching)
6. [The Matching Pipeline — Complete Specification](#6-the-matching-pipeline--complete-specification)
7. [Temporal Cascade Protocol](#7-temporal-cascade-protocol)
8. [Case Lifecycle State Machine](#8-case-lifecycle-state-machine)
9. [Scheduling & Appointment System](#9-scheduling--appointment-system)
10. [Privacy & Data Masking Framework](#10-privacy--data-masking-framework)
11. [Chat & Communication Layer](#11-chat--communication-layer)
12. [Case Completion & Archival](#12-case-completion--archival)
13. [Load Balancing & Capacity Management](#13-load-balancing--capacity-management)
14. [HRD Escalation Protocol](#14-hrd-escalation-protocol)
15. [UX Flows — In-Depth Specification](#15-ux-flows--in-depth-specification)
16. [Notification System](#16-notification-system)
17. [Edge Case Compendium](#17-edge-case-compendium)
18. [Scoring Reference Tables](#18-scoring-reference-tables)

---

## 1. Platform Overview & Philosophy

Sauti Salama is a gender-based violence (GBV) survivor support platform operating as a two-sided marketplace connecting survivors with verified support professionals. Unlike a traditional marketplace, the stakes of a failed or delayed match are not commercial — they are human. Every minute a survivor's case goes unattended is a minute a person in crisis receives no help.

### Core Design Principles

**Principle 1 — Zero Dead Cases.**  
The system must guarantee that every submitted case eventually reaches an active professional. No case should silently expire without action. This drives the entire Temporal Cascade design.

**Principle 2 — Survivor-First Privacy.**  
A survivor's identity, contact details, and incident description are classified information. Professionals operate on need-to-know access: they see only what is required to make a commitment, and full details are unlocked only after a binding scheduling commitment is made.

**Principle 3 — Quality Before Speed, But Speed Matters.**  
The primary matching objective is clinical fit — the right professional for the specific incident type. Speed is the secondary objective, activated when quality matches fail to engage in a timely manner. The Temporal Cascade trades quality for speed in a controlled, deliberate manner.

**Principle 4 — Bilateral Case Closure.**  
A case is not complete until both the professional and the survivor agree it is complete. No unilateral archival is permitted.

**Principle 5 — Continuous Coverage.**  
When a professional completes a case, the system immediately checks for unmatched cases and attempts to reassign. A professional with no active cases is a resource being wasted.

**Principle 6 — Professional Sovereignty Over Scheduling.**  
Professionals define their available hours. Survivors choose from those hours. The system enforces these constraints rigorously and does not allow out-of-bounds scheduling.

---

## 2. Actor Taxonomy

Understanding the actor model is prerequisite to understanding all matching logic.

### 2.1 Survivor

Any person who submits a report of abuse or GBV. A survivor may be:

- **Self-reporting:** Directly describing their own experience.
- **Proxy-reporting:** Reporting on behalf of another (e.g., a parent reporting for a child, a community member reporting for a neighbour). The report carries an `is_on_behalf` flag but is otherwise treated identically.
- **Anonymous:** Choosing not to register an account. Their data is stored with reduced linkability.
- **Registered:** Has a platform account, enabling persistent case tracking and direct notifications.

A survivor's case is referred to as a **report** in system terminology and a **case** from the professional's perspective.

### 2.2 Professional

Any verified individual or organisation providing support services. Sub-types:

**Individual Professionals:**

- Doctors / Medical practitioners
- Mental Health Experts (therapists, counsellors, psychologists)
- Lawyers
- Paralegals
- Human Rights Defenders (HRDs)

**Organisational Professionals:**

- Law Firms
- Hospitals and Clinics
- NGOs (local and international)
- Rescue Centres / Shelters
- Child Protection Organisations

All professionals must pass a verification process before appearing in matching candidate pools. Verification status is a hard gate — unverified entities never receive cases.

> **Special note on Professional-as-Survivor:** A professional may submit a report in their personal capacity as a survivor. In this scenario, they are treated exclusively as a survivor for that report. Their professional account and cases are entirely separate. The system does not conflate these roles.

### 2.3 Human Rights Defender (HRD)

HRDs occupy a unique hybrid position. They are:

- Verified professionals on the platform
- Specialists in navigating complex, multi-service cases
- The **safety net** of the matching system — they are activated when primary matching fails or when a case requires coordination across multiple service domains

HRDs have a broader mandate than specialists. While a Lawyer focuses on legal aid, an HRD may coordinate legal, shelter, and mental health support simultaneously. They act as case managers when the primary matching system cannot find a single specialist capable of covering all required services.

HRDs are integrated into the Temporal Cascade (Section 7) as the escalation layer, activated at defined time thresholds.

### 2.4 Platform Administrator

Administrators do not participate in matching. Their role is to verify professionals, moderate the platform, and access aggregate statistics. They cannot intervene in individual matches except to remove a professional (which would trigger re-matching).

---

## 3. The Matching Problem — Framing

The Sauti Salama matching problem is formally a **constrained, weighted bipartite matching problem** with temporal decay and multi-objective scoring.

**Left set:** Unmatched survivor reports, each characterised by a vector of needs, constraints, and attributes.

**Right set:** Available verified professionals, each characterised by a vector of capabilities, constraints, and current load.

**Objective:** Find an assignment that maximises total match quality (fitness of professional to survivor's needs) subject to:

- Hard constraints (verification, geographic feasibility, consent restrictions)
- Soft constraints (proximity, language, availability alignment)
- Fairness constraints (load balancing — no professional should be overwhelmed while another is idle)
- Temporal constraints (the match must be completed within defined time windows, or the system widens the search)

Unlike a one-shot assignment problem, this system operates in **real time** with a continuous stream of new cases and professionals accepting or declining matches. It is closer to an **online bipartite matching problem** than a classical offline Hungarian algorithm application.

---

## 4. Algorithm Research & Inspiration

### 4.1 Uber's Dynamic Dispatch

Uber's core matching challenge — connecting riders with drivers in real time — shares structural DNA with Sauti Salama's problem. Key lessons:

**Surge and Demand Heatmaps:** Uber weights supply toward demand clusters. Sauti Salama should monitor geographic incident density and ensure professional coverage maps align with historical report geography. Regions with high incident rates but low professional coverage should be flagged for administrative attention.

**ETA as Primary Signal:** Uber optimises primarily on time-to-pickup, with all other factors secondary. Sauti Salama must weight time-to-engagement appropriately, especially for high-urgency cases where a geographically suboptimal but faster professional outranks a clinically superior but slower one.

**Batching for Efficiency:** Uber batches match decisions across short time windows (500ms) rather than processing each request atomically. For Sauti Salama, incoming reports can be processed in near-real-time batches (e.g., every 2 minutes) to enable global optimisation across the candidate pool rather than greedy first-come assignment.

### 4.2 Gale-Shapley Stable Matching

The Gale-Shapley algorithm solves the stable matching problem, ensuring no pair of (survivor, professional) would both prefer each other over their current matches. While strict Gale-Shapley is not directly applicable (survivors don't rank professionals proactively), the stability concept is valuable:

A match is considered **stable** if no unmatched professional would score higher for the given report than the matched professional. The scoring algorithm should be designed to produce near-stable outcomes, minimising the probability of a superior match being left out.

In practice, the system's top-5 candidate selection creates a **match set** rather than a single match, allowing for professional refusal without requiring a full re-run of the algorithm.

### 4.3 The Travelling Salesman Problem (TSP) — Geographic Clustering

TSP teaches that optimal routing requires considering the full set of destinations simultaneously rather than greedily choosing the next closest. Applied to Sauti Salama:

When multiple unmatched reports exist in a geographic region, the system should not simply match each report to the nearest professional independently. It should consider the full set of reports and professionals together, distributing cases to minimise total distance (maximise total proximity score) while respecting load constraints. This **geographic clustering** approach ensures that a professional serving Nairobi Central is not matched with five cases while a professional serving Westlands serves one case even if Westlands has three unmatched reports.

### 4.4 Hospital Residency Matching (NRMP)

The US medical residency matching system (National Resident Matching Program) is one of the most studied real-world implementations of Gale-Shapley. Key lessons:

**Preference lists are asymmetric:** Hospitals (professionals) and residents (survivors) have different preference structures. NRMP handles this via resident-proposing GS, which is optimal for residents. Sauti Salama, as a survivor-centric platform, should analogously optimise for survivor outcomes — the best-fit professional from the survivor's perspective, not the easiest case for the professional.

**Couples matching:** NRMP handles couples who must be placed in the same region. Analogously, Sauti Salama must handle cases requiring multiple service types (e.g., both legal and mental health), ensuring the matched professionals can collectively cover all needs.

### 4.5 E-Commerce Recommendation Systems (Collaborative Filtering)

Modern recommendation systems use collaborative filtering — "users like you preferred X" — alongside content-based filtering — "this item matches your stated preferences." Sauti Salama should incorporate a lightweight version:

**Content-based filtering** (primary): Match based on explicit attributes — incident type, required services, location, language, special needs.

**Historical performance signals** (secondary): If data exists, professionals with higher survivor satisfaction ratings on similar case types should receive a marginal score bonus. This prevents a "cold start" for survivors while rewarding consistently high-quality professionals over time.

### 4.6 Auction Theory and Mechanism Design

Economists use mechanism design to create systems where rational self-interest aligns with socially optimal outcomes. For Sauti Salama:

**The professional's decision to accept or decline** a match is an individual rational choice. The system should structure incentives (reputation, case visibility, platform standing) so that accepting appropriate cases is the dominant strategy for professionals.

**Information asymmetry:** Professionals have incomplete information about the case before accepting. The phased disclosure model (Section 10) manages this — enough information to make an informed commitment, but not so much that sensitive data is unnecessarily exposed.

---

## 5. Data Model for Matching

The matching algorithm consumes data from four primary entities. This section defines every field and its role in the algorithm.

### 5.1 Report (Survivor Case)

| Field                    | Type                  | Algorithm Role                                                                                                                      |
| ------------------------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `type_of_incident`       | Enum                  | Primary driver of Clinical Specialty Map lookup. Determines primary and secondary service type weights.                             |
| `required_services`      | Text[]                | Explicit survivor service requests. Each matching service earns a significant score bonus.                                          |
| `urgency`                | Enum: high/medium/low | Applies a final score multiplier and weights the Availability Matrix. High urgency also activates the accelerated Temporal Cascade. |
| `latitude` / `longitude` | Float                 | Origin point for Haversine distance calculations against professional locations.                                                    |
| `preferred_language`     | Enum                  | Triggers language match bonus against professional's registered languages.                                                          |
| `gender`                 | Enum                  | Triggers gender preference bonus when survivor has specified a gender preference for their professional.                            |
| `consent`                | Enum: yes/no          | Hard filter gate for legal services when consent is withheld.                                                                       |
| `additional_info`        | JSONB                 | Parsed for `special_needs` sub-object containing `disabled`, `queer_support`, `child_involved` flags.                               |
| `record_only`            | Boolean               | Skip matching entirely for non-child cases. Child cases override this flag.                                                         |
| `submission_timestamp`   | Timestamp             | Drives the Temporal Cascade timing calculations.                                                                                    |
| `is_on_behalf`           | Boolean               | Contextual flag — does not change matching logic but informs professional context.                                                  |
| `is_matched`             | Boolean               | Prevents re-running matching on already-matched reports unless triggered by re-matching events.                                     |

### 5.2 Support Service (Professional Service Entity)

| Field                                    | Type         | Algorithm Role                                                                      |
| ---------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| `service_types`                          | Enum         | Compared against Clinical Specialty Map for primary/secondary classification.       |
| `coverage_area_radius`                   | Integer (km) | Maximum distance within which the service operates. NULL = remote/nationwide.       |
| `latitude` / `longitude`                 | Float        | Destination point for proximity calculation.                                        |
| `availability`                           | String       | Matched against Availability Scoring Matrix using report urgency as the cross-axis. |
| `verification_status`                    | Enum         | Hard gate: only `verified` status passes.                                           |
| `is_active`                              | Boolean      | Hard gate: inactive services are excluded.                                          |
| `is_banned` / `is_permanently_suspended` | Boolean      | Hard gates: banned services are excluded.                                           |
| `specialises_in_disability`              | Boolean      | Specialty match flag for `additional_info.disabled`.                                |
| `specialises_in_queer_support`           | Boolean      | Specialty match flag for `additional_info.queer_support`.                           |
| `specialises_in_children`                | Boolean      | Specialty match flag for child cases.                                               |

### 5.3 Professional Profile

| Field                                | Type     | Algorithm Role                                                                   |
| ------------------------------------ | -------- | -------------------------------------------------------------------------------- |
| `professional_title`                 | String   | Mapped to Professional Authority Matrix for incident-specific expertise scoring. |
| `settings.matching_traits.languages` | String[] | Compared against `report.preferred_language` for language bonus.                 |
| `settings.matching_traits.gender`    | String   | Compared against `report.gender` for gender preference bonus.                    |
| `verification_status`                | Enum     | Hard gate for standalone professionals (HRDs, Paralegals).                       |
| `bio` / `city` / `country`           | String   | Snapshotted into the match record for survivor-facing display.                   |
| `out_of_office`                      | Boolean  | Hard gate: OOO professionals are excluded from matching.                         |

### 5.4 Matched Services (Active Cases)

| Field               | Type    | Algorithm Role                                                                                         |
| ------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| `match_status_type` | Enum    | Determines whether a case counts toward a professional's active load.                                  |
| `feedback`          | JSONB   | Parsed for `is_prof_complete` flag to exclude from load count when professional has marked completion. |
| `match_score`       | Integer | Stored for audit, reporting, and potential future collaborative filtering signals.                     |
| `match_reason`      | String  | Human-readable explanation of match rationale for audit and survivor-facing display.                   |

---

## 6. The Matching Pipeline — Complete Specification

The matching pipeline is a sequential multi-stage process. Each stage either eliminates candidates (hard filters) or modifies their scores (soft scoring). The pipeline is deterministic given the same inputs.

### Stage 0: Pre-Flight Checks

Before any candidate evaluation, the system validates the report:

1. **Record-Only Gate:** If `record_only = true` and the incident is not `child_abuse` or `child_labor`, matching is aborted. The report is stored without a match. Child cases always proceed regardless of this flag.

2. **Already-Matched Gate:** If `is_matched = true` and no re-matching trigger is present, the pipeline aborts. This prevents duplicate matches from concurrent calls.

3. **Minimum Data Gate:** If the report lacks `type_of_incident`, the algorithm falls back to the `other` incident category rather than erroring. The system never fails to attempt a match.

### Stage 1: Candidate Aggregation

The system compiles a unified candidate pool from two sources:

**Source A — Support Services:** All services where:

- `is_active = true`
- `is_banned = false`
- `is_permanently_suspended = false`
- `verification_status = verified`
- Owner profile has `out_of_office = false`

**Source B — Standalone Professionals:** Individual profiles (HRDs and Paralegals) where:

- `verification_status = verified`
- Profile not already represented in Source A (prevents double-counting)
- `is_banned = false`

Each candidate is normalised into a **Candidate Object** with a unified schema regardless of source:

```
CandidateObject {
  source_type:          'service' | 'profile'
  entity_id:            UUID
  owner_user_id:        UUID
  display_name:         String
  service_capabilities: String[]   // array of service type strings
  professional_title:   String
  latitude:             Float | null
  longitude:            Float | null
  coverage_radius_km:   Integer
  is_remote:            Boolean     // true if coverage_radius is null
  availability_profile: String
  specialises_disability: Boolean
  specialises_queer:    Boolean
  specialises_children: Boolean
  matching_traits:      Object      // { languages: [], gender: '' }
  bio_snapshot:         String | null
  location_snapshot:    String | null
}
```

### Stage 2: Hard Filters (Eliminations)

Hard filters remove candidates that are **never appropriate** for this report, regardless of score. A candidate failing any hard filter receives a sentinel score of -∞ and is excluded from all further processing.

**Hard Filter 1 — Consent Restriction:**  
If `report.consent = 'no'` and the case is not a child case, any candidate whose primary title is `Lawyer` or `Law Firm` is eliminated. Survivors who have withheld legal consent must not receive legal service matches. Exception: if legal consent is re-granted in a subsequent report update, re-matching is triggered.

**Hard Filter 2 — Service Type Relevance:**  
A candidate must offer at least one service type that appears in either the `primary` or `secondary` lists of the incident's Clinical Specialty Map, OR in the survivor's explicitly requested services (`required_services`). Candidates with zero relevant service types are eliminated. Exception: `type_of_incident = 'other'` — all candidates pass this filter.

**Hard Filter 3 — Geographic Hard Boundary:**  
For non-remote candidates, if the calculated Haversine distance between report and professional exceeds `coverage_radius_km × 2.5`, the candidate is eliminated unless the report age exceeds 24 hours (see Stage 7 — Temporal Relaxation).

**Hard Filter 4 — Child Case Specialisation:**  
For `child_abuse` and `child_labor` incidents, any candidate with no relevant child-related capability (`specialises_in_children = false` AND service type excludes `child_protection`) receives a -50 score penalty (not elimination, as even general services may provide partial help in emergencies).

### Stage 3: Clinical Specialty Scoring (+0 to +45 points)

This stage scores how well the professional's capabilities match the clinical requirements of the incident.

**Clinical Specialty Map:**

| Incident Type | Primary Services              | Secondary Services                       |
| ------------- | ----------------------------- | ---------------------------------------- |
| physical      | medical, legal                | mental_health, shelter                   |
| emotional     | mental_health                 | legal, shelter                           |
| sexual        | medical, mental_health, legal | shelter                                  |
| financial     | legal, financial_assistance   | mental_health                            |
| child_abuse   | legal, medical                | mental_health, shelter, child_protection |
| child_labor   | legal, child_protection       | mental_health, shelter                   |
| neglect       | medical, mental_health        | shelter, legal, child_protection         |
| trafficking   | legal, police_reporting       | shelter, mental_health                   |
| stalking      | legal, police_reporting       | mental_health                            |
| cyber         | legal                         | mental_health                            |
| racial        | legal                         | mental_health                            |
| other         | (all pass)                    | (all pass)                               |

**Scoring:**

- **Primary match:** +25 points
- **Secondary match:** +15 points
- **Explicitly requested by survivor (`required_services`):** +20 points (stackable with primary/secondary)
- **Maximum from this stage:** 25 + 20 = 45 points (primary match for explicitly requested service)

A candidate matching only as secondary on a service that was also explicitly requested scores 15 + 20 = 35 points for that service.

### Stage 4: Proximity Scoring (+0 to +20 points)

**For Non-Remote Candidates:**

```
distance = haversine(report.lat, report.lon, candidate.lat, candidate.lon)

if distance ≤ coverage_radius:
    proximity_score = 20 × (1 - distance / coverage_radius)
elif report_age_hours > 24:
    proximity_score = 5   // temporal relaxation bonus — still available, just further
else:
    proximity_score = -10  // outside area, not temporally relaxed
```

The score is linear within the coverage radius — a professional at the exact centre of their coverage area scores 20, one at the boundary scores 0, one beyond but temporally relaxed scores +5.

**For Remote Candidates:**

Remote professionals (those serving without geographic restriction) receive a flat +15 points. They are not penalised for distance but also not rewarded as highly as a local professional who is very close.

**For Candidates with No Location Data:**

If either the report or the candidate has no coordinates, proximity scoring is skipped (scores 0). The candidate remains in the pool and may match on other dimensions.

### Stage 5: Professional Authority Scoring (+0 to +10 points)

This stage rewards domain expertise — the clinical equivalence between a professional's title and the incident type.

**Authority Matrix:**

| Professional Title    | physical | emotional | sexual | financial | child_abuse | child_labor | neglect | trafficking | stalking | cyber | racial | other |
| --------------------- | -------- | --------- | ------ | --------- | ----------- | ----------- | ------- | ----------- | -------- | ----- | ------ | ----- |
| Doctor                | 10       | 3         | 10     | 0         | 8           | 0           | 8       | 0           | 0        | 0     | 0      | 2     |
| Mental Health Expert  | 5        | 10        | 8      | 0         | 5           | 3           | 6       | 4           | 5        | 4     | 4      | 5     |
| Lawyer                | 8        | 0         | 8      | 10        | 10          | 10          | 0       | 10          | 10       | 10    | 10     | 4     |
| Paralegal             | 4        | 4         | 4      | 6         | 6           | 8           | 4       | 6           | 6        | 6     | 6      | 4     |
| Human Rights Defender | 4        | 6         | 4      | 4         | 8           | 8           | 6       | 8           | 6        | 6     | 8      | 10    |
| Law Firm              | 8        | 0         | 8      | 10        | 10          | 10          | 0       | 10          | 10       | 8     | 10     | 4     |
| Rescue Centre         | 8        | 4         | 6      | 0         | 8           | 8           | 6       | 6           | 4        | 0     | 0      | 4     |
| Hospital / Clinic     | 10       | 2         | 10     | 0         | 8           | 0           | 8       | 0           | 0        | 0     | 0      | 2     |
| Local NGO             | 4        | 6         | 4      | 6         | 6           | 6           | 6       | 6           | 4        | 4     | 6      | 8     |

Authority scores are additive to the running total.

### Stage 6: Availability Alignment (+1 to +10 points)

**Availability Scoring Matrix (rows = availability profile, columns = case urgency):**

| Availability Profile        | High Urgency | Medium Urgency | Low Urgency |
| --------------------------- | ------------ | -------------- | ----------- |
| 24/7                        | 10           | 8              | 5           |
| weekdays_extended (7am–8pm) | 6            | 10             | 8           |
| weekdays_9_5                | 3            | 8              | 10          |
| weekends                    | 4            | 6              | 8           |
| flexible                    | 7            | 8              | 8           |
| by_appointment              | 1            | 5              | 8           |

A 24/7 professional is essential for high-urgency cases. A business-hours professional is well-suited to low-urgency cases where scheduling flexibility matters more than immediate response.

### Stage 7: Demographic & Special Needs Alignment (+0 to +40 points)

**Language Match:** +15 points if the candidate's registered languages include the survivor's `preferred_language`. No penalty for no match — language is additive only.

**Gender Preference:** +10 points if the candidate's registered gender matches the survivor's stated gender preference. No penalty for no match.

**Disability Specialisation:** +15 points if `additional_info.special_needs.disabled = true` AND `candidate.specialises_disability = true`.

**Queer Support Specialisation:** +15 points if `additional_info.special_needs.queer_support = true` AND `candidate.specialises_queer = true`.

**Note on double-counting prevention:** Special needs bonuses only apply if the survivor has flagged that specific need. A disability-specialist professional is not rewarded for that specialisation on a case where no disability need was flagged.

### Stage 8: Load Balancing (Dynamic Adjustment)

This stage prevents professional burnout and ensures equitable case distribution.

**Active Case Count:** Query all matches for this professional that are:

- Status not in `[declined, completed, cancelled]`
- AND professional has not marked `is_prof_complete = true` in the feedback field

**Scoring Adjustment:**

```
if active_count = 0:
    load_score = +30    // "High immediate capacity" bonus — pull idle professionals to front
elif active_count = 1:
    load_score = -8
elif active_count = 2:
    load_score = -16
elif active_count = 3:
    load_score = -24
elif active_count >= 4:
    load_score = -40    // Effectively deprioritised — only receives case if no alternatives exist
```

The +30 bonus for idle professionals is a deliberate design choice. When a professional completes a case, they immediately become highly attractive for pending unmatched cases. This creates a natural flow where professionals move from case to case without long idle periods and survivors without matches are quickly served.

**Maximum active cases before hard exclusion:** Professionals with 5 or more truly active cases are hard-excluded from new matches. Accepting a 6th case with 5 already active would compromise service quality.

### Stage 9: Urgency Multiplier

After all additive scoring is complete, the final raw score is multiplied by an urgency factor:

- **High urgency:** × 1.2
- **Medium urgency:** × 1.1
- **Low urgency:** × 1.0

This ensures that for high-urgency cases, small score differences between candidates are amplified, and the system more aggressively selects the top candidate.

### Stage 10: Final Selection and Persistence

**Selection:**

1. Filter all candidates to those with final score ≥ 10.
2. Sort descending by final score.
3. Select top 5 candidates.

**Fallback — No candidates above threshold:**

If the filtered pool is empty but candidates exist with score > 0:

- Relax threshold to score > -50
- Select top 3 candidates
- Flag match records with `is_fallback_match = true` for administrative visibility

**Fallback — No candidates above -50:**

If the entire candidate pool is below -50, the report is flagged as `requires_manual_review` and an administrator alert is generated. This is the only scenario where the system cannot produce an automated match.

**Persistence:**

For each selected candidate, a match record is created:

- `match_score`: final rounded integer score
- `match_reason`: comma-joined array of positive reason strings
- `match_status_type`: `pending`
- `escalation_required`: true for child cases
- Bio and location data snapshotted from professional profile
- `survivor_id` linked for notification routing

The report is updated: `is_matched = true`, `match_status = pending`.

---

## 7. Temporal Cascade Protocol

The Temporal Cascade is the system's answer to a fundamental problem: what happens when the best-matched professional doesn't act? The cascade systematically widens the pool over time, trading match quality for responsiveness.

This is directly inspired by Uber's driver assignment cascade — if the nearest driver doesn't accept within N seconds, the request expands to a wider radius with additional drivers.

### 7.1 Phase 0 — Initial Match (t = 0)

The top 5 matched candidates receive the case. The case is visible only to these 5 professionals. Each sees the case on their dashboard with a "New Case — Action Required" indicator.

### 7.2 Phase 1 — Urgency Nudge (t = 10 minutes for high urgency, t = 20 minutes for medium/low)

If no professional has clicked to view the case details:

- A push notification is sent: "You have a pending case awaiting review."
- The case card on the professional's dashboard is elevated with a visual urgency indicator.

### 7.3 Phase 2 — Extended Primary Pool (t = 20 minutes)

If no professional among the top 5 has accepted and scheduled within 20 minutes:

- The system re-runs the scoring algorithm for this report.
- Candidates 6 through 15 (previously excluded) are now eligible.
- These additional candidates receive the case notification.
- Original top 5 remain assigned and continue to see the case.
- The case card now shows a subtle "Awaiting Professional Confirmation" status to the survivor (no urgency language — purely informational).

### 7.4 Phase 3 — Full Professional Pool (t = 12 hours)

If the case remains unscheduled after 12 hours:

- All verified professionals on the platform whose service types match the incident's primary or secondary categories are now eligible.
- HRDs whose specialties include the relevant incident type are added to the visible pool.
- An escalation notification is sent to all newly eligible professionals: "Case requiring [service type] support — needs urgent attention."
- The case is tagged internally as `cascade_level_2`.

### 7.5 Phase 4 — Full HRD Pool (t = 18 hours)

If the case remains unscheduled after 18 hours:

- All verified HRDs on the platform are now eligible, regardless of specialty alignment.
- HRDs see the case with a "Multi-service case — your support needed" framing.
- The case is tagged internally as `cascade_level_3`.
- An administrator alert is generated: "Case X has been unscheduled for 18 hours."

### 7.6 Phase 5 — Administrative Escalation (t = 24 hours)

If the case reaches 24 hours without a professional accepting and scheduling:

- The case is escalated to platform administrators with a critical alert.
- Administrators may manually assign the case or reach out to professionals directly.
- The case is tagged `requires_administrative_intervention`.

### 7.7 High-Urgency Acceleration

For cases marked `urgency = high`, all Phase timing is halved:

- Phase 2 activates at t = 10 minutes (not 20)
- Phase 3 activates at t = 6 hours (not 12)
- Phase 4 activates at t = 9 hours (not 18)
- Phase 5 activates at t = 12 hours (not 24)

### 7.8 Temporal Relaxation of Geographic Constraints

As the cascade progresses, geographic hard filters are relaxed:

- At Phase 2: Hard boundary relaxed from `radius × 2.5` to `radius × 4`
- At Phase 3: Geographic hard boundary removed entirely — all verified professionals globally are candidates
- Remote professionals receive priority elevation in late phases as they are the most geographically flexible

---

## 8. Case Lifecycle State Machine

A case progresses through a defined set of states. The following is the complete state machine — every valid transition and its trigger.

```
                         ┌─────────────────────────────────────────────┐
                         │           CASE SUBMITTED                     │
                         │        (report submitted by survivor)        │
                         └──────────────────┬──────────────────────────┘
                                            │
                              [Matching engine runs]
                                            │
                         ┌──────────────────▼──────────────────────────┐
                         │               PENDING                        │
                         │  Case matched, awaiting professional action  │
                         └──────────────────┬──────────────────────────┘
                                            │
                        [Professional clicks case & schedules meeting]
                                            │
                         ┌──────────────────▼──────────────────────────┐
                         │             PROPOSED                         │
                         │  Professional proposed meeting time(s)       │
                         │  Survivor notified to review                 │
                         └────────┬────────────────────┬───────────────┘
                                  │                    │
                [Survivor accepts time]    [Survivor requests reschedule]
                                  │                    │
          ┌───────────────────────▼──┐   ┌─────────────▼───────────────┐
          │        ACCEPTED          │   │    RESCHEDULE_REQUESTED      │
          │  Chat created            │   │  Professional sees new       │
          │  Appointment confirmed   │   │  preferred times             │
          │  Full details unlocked   │   └────────────┬────────────────┘
          └──────┬────────────────┘                   │
                 │                      [Professional proposes new time]
                 │                                    │
                 │                       ┌────────────▼─────────────────┐
                 │                       │    PENDING_SURVIVOR           │
                 │                       │  Back to survivor for         │
                 │                       │  final confirmation           │
                 │                       └────────────┬─────────────────┘
                 │                                    │
                 │                       [Survivor accepts]
                 │                                    │
                 │                       ┌────────────▼─────────────────┐
                 │                       │         ACCEPTED              │
                 └───────────────────────┘  (merges with left path)     │
                                            └──────────┬───────────────┘
                                                       │
                                   [Support engagement happens via chat]
                                                       │
                                         ┌─────────────▼──────────────┐
                                         │ COMPLETION_PENDING          │
                                         │ One party marks complete    │
                                         │ Other receives notification │
                                         └─────────────┬──────────────┘
                                                       │
                                     [Both parties mark complete]
                                                       │
                                         ┌─────────────▼──────────────┐
                                         │         COMPLETED           │
                                         │  Case archived for both     │
                                         │  Re-matching triggered      │
                                         │  for idle professional      │
                                         └────────────────────────────┘

[At any PENDING or PROPOSED state, professional may DECLINE]
          │
          ▼
      DECLINED → System selects next candidate from match pool
               → If pool exhausted, re-runs matching engine
               → If report > 12hrs, widens to Phase 3 pool
```

### State Descriptions

**PENDING:** The case has been matched and professionals have been notified. No professional has yet committed to a meeting time. The Temporal Cascade is actively running.

**PROPOSED:** A professional has committed to proposing specific meeting times. The case is now awaiting survivor confirmation. The Temporal Cascade pauses for this case once a proposal is made (the professional is actively engaged).

**PENDING_SURVIVOR:** Used in the reschedule flow when the professional has proposed new times in response to a survivor's reschedule request.

**RESCHEDULE_REQUESTED:** The survivor has received a meeting proposal but has requested different times. The professional must respond.

**ACCEPTED:** Both parties have agreed on a meeting time. A secure chat room has been created. The appointment is confirmed. Full case details are now visible to the professional.

**COMPLETION_PENDING:** One party has marked the case as complete. The other party has been notified and must confirm. The case remains accessible to both parties.

**COMPLETED:** Both parties have confirmed completion. The case moves to the archive for both the survivor and the professional. Re-matching for any pending unmatched cases is triggered for the now-available professional.

**DECLINED:** A professional has declined the case. If this was the only remaining candidate in the pool, re-matching is triggered. If candidates remain in the pool, the next highest-scoring candidate is elevated.

**CANCELLED:** The survivor has withdrawn the case before acceptance. No re-matching occurs.

---

## 9. Scheduling & Appointment System

The scheduling system is the commitment mechanism — it converts a tentative match into a confirmed professional-survivor engagement. It must balance professional scheduling autonomy with survivor accessibility.

### 9.1 Professional Availability Registration

Professionals register their availability when setting up their service. The availability profile has two layers:

**Layer 1 — Schedule Template:** A recurring weekly schedule defining available days and time blocks.

```
Example:
  Monday:    09:00–12:00, 14:00–17:00
  Tuesday:   09:00–12:00, 14:00–17:00
  Wednesday: Unavailable
  Thursday:  09:00–17:00
  Friday:    09:00–13:00
```

**Layer 2 — Availability Blocks:** One-off exceptions that override the template — holidays, vacations, personal blocks.

The scheduling system computes available slots by applying the template and subtracting any exception blocks and already-booked appointments.

### 9.2 Professional Scheduling Flow

When a professional clicks a case card and chooses to proceed:

**Step 1 — Case Preview:** They see the anonymised case summary (Section 10) and make an initial decision to proceed.

**Step 2 — Scheduling Modal:** A scheduling interface appears with two options:

- **Meet Now:** Immediately proposes the current time slot (if they are currently available per their registered schedule). This generates a system-created appointment starting within 15 minutes.
- **Schedule Later:** Opens the scheduling calendar.

**Step 3 — Calendar View:** The professional sees their available slots for the next 14 days. They may select one or propose up to three alternative times for the survivor to choose from.

**Step 4 — Confirmation:** Selecting a time or proposing times generates the `PROPOSED` state transition, notifies the survivor, and locks that time slot in the professional's calendar (tentatively).

### 9.3 Survivor Confirmation Flow

Upon receiving the "Professional Has Proposed Meeting" notification:

**Step 1 — Notification Landing:** Clicking the notification opens the case detail card, now showing a new "Pending Confirmation" indicator.

**Step 2 — Proposal Review:** The survivor sees:

- Professional's anonymised profile (name, title, organisation type)
- The proposed meeting time(s)
- A brief statement of what to expect from the session

**Step 3 — Decision:**

- **Accept:** Confirms the meeting. If multiple times were proposed, they select one. Case transitions to `ACCEPTED`.
- **Reschedule:** Opens a simplified calendar showing the professional's available slots. Survivor selects preferred alternatives. Case transitions to `RESCHEDULE_REQUESTED`.

**Step 4 — Post-Acceptance:** Survivor sees a confirmation screen with meeting date, time, and instructions for joining the chat.

### 9.4 Slot Availability Calculation

To generate available time slots for a professional:

```
available_slots = template_slots(date)
                  - availability_blocks(date)
                  - existing_confirmed_appointments(date)
                  - tentative_slots(date)  // proposed but not yet confirmed
```

Slot duration defaults to 60 minutes. The system presents slots in the survivor's local timezone (derived from their report's location data or browser timezone if registered).

### 9.5 Meeting Medium

The initial consultation happens via the in-platform secure chat (Section 11). If both parties agree to a different modality (phone call, video call via external platform), they may arrange this directly within the chat after the `ACCEPTED` state is reached. The platform's primary commitment remains the in-platform secure messaging interface.

---

## 10. Privacy & Data Masking Framework

Privacy in Sauti Salama is not optional — it is a clinical requirement. Survivors may face real danger if their identity, location, or incident details are disclosed to the wrong person. The masking framework defines exactly what is visible to whom at each case state.

### 10.1 Pre-Acceptance View (Professional sees case in PENDING state)

The professional sees a **Case Summary Card** containing:

| Field                | Displayed As                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Survivor Name        | Not shown                                                                                                |
| Age                  | Age category: "Child (under 12)", "Adolescent (13–17)", "Adult (18–35)", "Adult (36–60)", "Senior (60+)" |
| Gender               | Full gender identity: "Female", "Male", "Non-binary", "Prefer not to say"                                |
| Location             | General region only: city or district name. Not coordinates, not street.                                 |
| Incident Type        | Full incident type: "Physical abuse", "Sexual violence", etc.                                            |
| Urgency              | Full urgency level with visual indicator                                                                 |
| Required Services    | List of requested support types                                                                          |
| Special Needs        | Displayed if present: "Requires disability-accessible support", "Requires queer-affirming support"       |
| Incident Description | Not shown                                                                                                |
| Contact Details      | Not shown                                                                                                |
| Full Name            | Not shown                                                                                                |

**Rationale:** The professional has enough information to determine whether they are clinically appropriate and willing to engage, without any identifying information about the survivor.

### 10.2 Post-Acceptance View (Case in ACCEPTED state)

After the survivor confirms the meeting:

| Field                | Displayed As                                         |
| -------------------- | ---------------------------------------------------- |
| Survivor Name        | First name only (or anonymous username if anonymous) |
| Full Name            | Shown                                                |
| Age                  | Exact age (if provided)                              |
| Location             | Full location as provided in report                  |
| Incident Description | Full text                                            |
| Contact Details      | Phone, email (if provided and consent = yes)         |
| Required Services    | Full list                                            |
| Special Needs        | Full detail                                          |
| Media/Evidence       | If uploaded, accessible via secure link              |

### 10.3 Survivor View of Professional Profile

Survivors see a different disclosure gradient:

**Before Acceptance (case in PENDING):**

- Professional's first name only
- Professional title
- Organisation type (e.g., "Law Firm", "NGO")
- General service area (e.g., "Nairobi, Kenya")
- Specialisations (child-focused, disability-accessible, etc.)
- Match reason summary ("Matched based on legal expertise for your case type")

**After Acceptance:**

- Full name
- Organisation name
- Direct contact details (if professional has opted to share)
- Professional bio

### 10.4 Anonymous Survivors

Survivors who choose not to register or who report anonymously:

- Are assigned a system-generated anonymous identifier (e.g., "Reported Case #4892")
- Their name shown to professionals is "Anonymous Survivor" in all states
- No contact details are ever shared
- Communication happens exclusively via in-platform chat
- Case archival is maintained system-side but survivor cannot access it unless they later register and link their submission token

---

## 11. Chat & Communication Layer

The in-platform chat is the primary communication channel between survivor and professional after the `ACCEPTED` state.

### 11.1 Chat Room Creation

A chat room is created automatically when the case transitions to `ACCEPTED`. The chat room:

- Is associated with exactly one match record
- Has exactly two participants: the survivor and the professional
- Has a type of `support_match`
- Cannot be joined by any third party (including platform administrators, except in abuse/emergency situations)

### 11.2 System Messages

The chat opens with a system-generated message (not from either party):

> "This secure chat has been created for your case. All messages are encrypted and confidential. Your conversation will only be visible to you and your matched professional."

Additional system messages are generated for key lifecycle events:

- When a meeting time is confirmed: "Meeting confirmed for [date] at [time]."
- When one party marks the case complete: "Your professional has indicated this case is complete. Please review and confirm."

### 11.3 Message Types

The chat supports:

- **Text messages:** Standard text communication
- **File attachments:** Documents, images (survivors may share evidence with their professional)
- **Voice notes:** Audio messages for survivors who struggle with written communication
- **Location sharing:** If the survivor needs to share their location with the professional for in-person services

### 11.4 Chat Moderation and Safety

The chat system has a passive content moderation layer. Messages flagged by the moderation system are reviewed by an administrator. Neither party is informed when a message is flagged. This is a safety mechanism for detecting abuse of the platform (e.g., a professional attempting to contact a survivor outside the platform).

### 11.5 Chat Persistence

Chat history is retained as part of the case record. When a case is archived (COMPLETED state), the chat history moves to the archive and remains accessible to both parties. Neither party can delete chat history.

---

## 12. Case Completion & Archival

### 12.1 Completion Initiation

Either the professional or the survivor may initiate case completion at any time after the case is in the `ACCEPTED` state.

**Professional initiates completion:**

1. Professional clicks "Mark Case as Complete" on their case dashboard.
2. System prompts: "Are you sure? This indicates you have completed the support you can provide for this case."
3. Professional confirms. The match record's `feedback` field is updated with `is_prof_complete: true`.
4. Case transitions to `COMPLETION_PENDING`.
5. Survivor receives notification: "Your professional has completed their work on your case. Please review and confirm if you agree."
6. Survivor's case card shows a "Completion Pending" banner with a call-to-action: "Mark as Complete and Archive."

**Survivor initiates completion:**

1. Survivor clicks "I No Longer Need Support" or "Mark as Complete" on their case card.
2. System prompts: "This will close your case. You can reopen a new report at any time if you need further support."
3. Survivor confirms. The match record's `feedback` field is updated with `is_survivor_complete: true`.
4. Case transitions to `COMPLETION_PENDING`.
5. Professional receives notification: "The survivor has indicated the case is complete. Please review and confirm."

### 12.2 Bilateral Confirmation

When both parties have confirmed completion:

- Case transitions to `COMPLETED`.
- The case is archived in both the survivor's and the professional's case history.
- The chat room enters a read-only state — both parties can read history but cannot send new messages.
- **Re-matching trigger:** The system immediately checks for unmatched pending reports and attempts to match this now-available professional.

### 12.3 Unilateral Completion Timeout

If the second party does not confirm completion within 7 days of the first party confirming:

- A reminder notification is sent to the pending party.
- If still unconfirmed after 14 days, the case is automatically archived as `COMPLETED_AUTO`.
- Both parties receive a final notification.
- Automatic completion is flagged for administrator awareness but does not trigger manual review.

### 12.4 The Archive

The archive is a read-only repository of completed cases. For survivors, it represents their history of received support. For professionals, it represents their completed caseload. Archive records include:

- Full case details (at the post-acceptance disclosure level)
- Full chat history
- Appointment records
- Match metadata (score, reasons, timeline)
- Professional's case notes (if added)

---

## 13. Load Balancing & Capacity Management

### 13.1 Active Case Definition

A case is considered "truly active" (counting toward a professional's load) if ALL of the following are true:

- Match status is not `declined`, `completed`, `cancelled`, or `completed_auto`
- The professional has not set `is_prof_complete = true` in the feedback field

This dual-check is critical. When a professional marks completion but the survivor hasn't confirmed, the case should no longer consume the professional's capacity — they have finished their work, and the open status is awaiting the survivor's administrative confirmation, not active professional engagement.

### 13.2 Capacity Limits

| Active Case Count | Status        | New Match Eligibility                          |
| ----------------- | ------------- | ---------------------------------------------- |
| 0                 | High Capacity | Highest priority — receives +30 load bonus     |
| 1                 | Normal        | Standard scoring                               |
| 2                 | Moderate Load | -16 penalty                                    |
| 3                 | High Load     | -24 penalty                                    |
| 4                 | Near Capacity | -40 penalty (still eligible but deprioritised) |
| 5+                | At Capacity   | Hard excluded from new matches                 |

### 13.3 Proactive Re-Matching on Case Completion

When a professional's active case count drops to 0 (either by completion or decline), the system:

1. Queries for unmatched reports submitted in the last 7 days (ordered by submission timestamp, oldest first — prioritise longest-waiting survivors).
2. Runs the matching pipeline for each unmatched report.
3. If this professional scores ≥ 10 for any report, they are matched and notified.
4. Maximum 5 proactive matches are attempted per trigger to prevent over-processing.

This proactive mechanism ensures the "idle professional problem" is resolved automatically — professionals who finish cases do not need to wait for new reports to come in.

### 13.4 Out-of-Office (OOO) Handling

When a professional activates OOO mode:

- They are immediately removed from all new matching candidate pools.
- Their currently `PENDING` matches (those not yet accepted) are re-run through the matching engine to find alternative candidates. The original professional remains in the pool but is demoted.
- Cases already in `ACCEPTED` or later states are not disrupted — the professional is expected to honour existing commitments even when OOO, or to communicate directly with the survivor via chat.
- When OOO is deactivated, the proactive re-matching trigger fires.

---

## 14. HRD Escalation Protocol

Human Rights Defenders serve as the platform's safety net — ensuring that no survivor falls through the gaps of specialised matching.

### 14.1 Primary HRD Activation Triggers

HRDs are added to the candidate pool in two scenarios:

**Scenario A — Temporal Cascade Phase 3/4:** As described in Section 7, HRDs are included as time thresholds are crossed. This is the most common activation path.

**Scenario B — Multi-Service Cases with No Single Provider:** If a survivor's report lists multiple required services (e.g., both medical and legal) and no single verified provider covers both, the matching engine may identify an HRD as the most appropriate coordinator. The HRD accepts the case and coordinates with specialist services on the survivor's behalf.

### 14.2 HRD Case Management

When an HRD accepts a case:

- They see the full case summary (pre-acceptance masked view, same as other professionals)
- Post-acceptance, they see full details
- They have access to a "Coordination Panel" that allows them to internally flag the case as requiring additional service referrals
- They may share the case (with survivor consent) to a specialist service using the case-sharing mechanism

### 14.3 HRD-to-Specialist Case Transfer

An HRD may determine that a specialist would be better suited. They initiate a case transfer:

1. HRD selects "Refer to Specialist" in the coordination panel.
2. HRD identifies the target specialist (by service type or specific provider).
3. System sends a case-share invitation to the target specialist.
4. Target specialist sees anonymised case summary.
5. Target specialist accepts or declines the referral.
6. If accepted: A new match record is created linking the specialist to the case. The HRD may choose to remain on the case as coordinator or transition fully.
7. If declined: HRD is notified and may try another specialist.

### 14.4 HRD Geographic Coverage

HRDs operate with a 100km default coverage radius but are not hard-excluded by geography in Phase 3/4 of the cascade. Their value is coordination and advocacy, which can be performed remotely. An HRD in Nairobi can coordinate support for a survivor in Mombasa.

---

## 15. UX Flows — In-Depth Specification

### 15.1 Survivor Report Submission Flow

**Step 1 — Entry Point:** Survivor taps "Get Help" or "Report Incident" on the homepage.

**Step 2 — Anonymity Choice:** Before any data is collected, the survivor is offered the choice: "Continue anonymously" or "Continue with your account." Both paths lead to the same report form. Anonymous survivors cannot receive push notifications but receive SMS/email if contact details are provided.

**Step 3 — Report Form (Progressive Disclosure):** The form reveals fields progressively to avoid overwhelming the survivor at the outset.

- Screen 1: Incident type selection (visual icons + text labels)
- Screen 2: Urgency self-assessment ("How urgent is your need?") with gentle language
- Screen 3: Location (auto-detected or manually entered — survivor may choose "I'd prefer not to share my exact location")
- Screen 4: Required services (pre-selected based on incident type, survivor may add/remove)
- Screen 5: Special needs and preferences (language, professional gender preference, disability/queer support needs)
- Screen 6: Additional context (free text, optional)
- Screen 7: Consent (clear, plain-language explanation of what sharing consent means for legal services)
- Screen 8: Contact preferences (how to receive updates — push, SMS, email, none)
- Screen 9: Review and submit

**Step 4 — Immediate Post-Submission:** Survivor sees a confirmation screen:

> "Your report has been received. We are finding the best-matched professional for your situation. You will be notified as soon as a match is confirmed — typically within a few minutes."

A real-time progress indicator (subtle, not anxiety-inducing) shows the matching engine at work.

**Step 5 — Match Notification:** When a match is found, survivor's dashboard case card updates with "Match Found — Awaiting Professional Confirmation."

**Step 6 — Meeting Proposal Notification:** When the professional proposes a meeting time, the survivor receives a notification. Tapping it opens the meeting proposal UI.

**Step 7 — Post-Confirmation:** After accepting a meeting, the survivor sees:

- Meeting date and time
- Professional summary (name, title, organisation)
- "Open Chat" button (active immediately, even before the meeting time)
- Calendar integration prompt (add to Google Calendar / Apple Calendar)

### 15.2 Professional Case Engagement Flow

**Step 1 — Case Notification:** Professional receives a push/email notification: "New case awaiting your support" with anonymised case type.

**Step 2 — Dashboard Case Card:** The case appears on the professional's dashboard with:

- Case anonymised summary (gender, age category, incident type, urgency level)
- Match score displayed as a suitability indicator (not a raw number — shown as "Excellent Match", "Good Match", "Potential Match")
- Time-since-submission indicator
- Two primary actions: "Schedule Support Session" and "I Cannot Take This Case"

**Step 3 — Scheduling Modal (on "Schedule Support Session"):**

```
┌──────────────────────────────────────────────┐
│  Schedule a Support Session                   │
│                                              │
│  Case: Female adult, physical abuse          │
│  Urgency: High                               │
│                                              │
│  ○ Meet Now (9:00 AM — I'm available now)    │
│                                              │
│  ○ Schedule Later                            │
│                                              │
│  [Show my available times for next 14 days]  │
│                                              │
│  Propose up to 3 time options to the survivor│
│  ┌─────────────────────────┐                 │
│  │ Thu Mar 29 – 10:00 AM  ✓│                 │
│  │ Thu Mar 29 – 2:00 PM    │                 │
│  │ Fri Mar 30 – 9:00 AM    │                 │
│  └─────────────────────────┘                 │
│                                              │
│  [Send Proposals to Survivor]                │
└──────────────────────────────────────────────┘
```

**Step 4 — Proposal Sent State:** Case card updates to "Awaiting Survivor Confirmation" with the proposed times displayed. Professional cannot edit the proposal after submission (to prevent confusion for the survivor). They may cancel and re-propose if necessary with a written reason.

**Step 5 — Survivor Confirms:** Professional receives notification: "Your session has been confirmed for [date/time]. Case details are now fully available." The case card expands to show full survivor details and the "Open Secure Chat" button.

**Step 6 — Active Case Management:** Professional has access to:

- Case summary (full post-acceptance view)
- Secure chat
- Appointment details
- Case notes (private, not visible to survivor)
- Case recommendations (can be optionally shared with survivor)
- "Mark Case as Complete" button (available at any time after ACCEPTED)

### 15.3 Declination Flow

When a professional chooses "I Cannot Take This Case":

**Step 1 — Reason Prompt:**

```
Why are you unable to take this case?
○ Outside my area of expertise
○ Geographic distance — unable to serve this location
○ Caseload full — too many active cases
○ Scheduling conflict — cannot find a suitable time
○ Other (please specify)
```

**Step 2 — Confirmation:** "Thank you for letting us know. We will notify the survivor that we are finding a new professional."

**Step 3 — System Action:**

- Match record updated to `declined` with reason.
- Next highest-scoring candidate in the match pool is elevated and notified.
- If no candidates remain in pool, re-matching is triggered.
- Survivor does not see the declination — they see "We are finalising your match" until a new professional accepts.

### 15.4 Reschedule Flow (Survivor-Initiated)

When a survivor receives a meeting proposal they cannot accommodate:

**Step 1:** Survivor taps "Request Different Time."

**Step 2:** Survivor sees the professional's available slots for the next 14 days and selects 1–3 preferred alternatives.

**Step 3:** Survivor optionally adds a message: "I am only available on weekends."

**Step 4:** Professional receives notification: "The survivor has requested to reschedule." Case transitions to `RESCHEDULE_REQUESTED`.

**Step 5:** Professional reviews the survivor's preferred times. If any work, they select one and resubmit. If none work, they may propose entirely new times. Case moves back to `PENDING_SURVIVOR`.

**Step 6:** Process repeats until agreement is reached. If 3 rounds of reschedule fail, the system prompts the professional to consider declining and the system re-matches.

### 15.5 Case Completion Flow (Visual)

**Professional's View:**

```
┌─────────────────────────────────────────────────┐
│  Case #4892 — Female adult, physical abuse       │
│  Status: ACTIVE                                   │
│                                                   │
│  [Open Chat]  [View Case Notes]  [Appointments]  │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │  ✓ Mark Case as Complete                    │ │
│  │  Tap when you have completed all support     │ │
│  │  you can provide for this case.             │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

After professional marks complete:

```
┌─────────────────────────────────────────────────┐
│  Case #4892                                      │
│  Status: COMPLETION PENDING — Awaiting Survivor  │
│                                                   │
│  You have marked this case as complete.           │
│  Waiting for the survivor to confirm.             │
│  Chat remains open for any final messages.        │
└─────────────────────────────────────────────────┘
```

**Survivor's View after professional marks complete:**

```
┌─────────────────────────────────────────────────┐
│  Your case                                       │
│  ┌─────────────────────────────────────────────┐ │
│  │  ℹ️  Your professional has completed their   │ │
│  │  work on this case.                          │ │
│  │                                              │ │
│  │  Do you feel your support needs have been    │ │
│  │  met?                                        │ │
│  │                                              │ │
│  │  [Yes, Archive This Case]                    │ │
│  │  [No, I Still Need Help]                     │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

If survivor selects "No, I Still Need Help," the case reverts to `ACCEPTED` state, the professional is notified, and they may either continue support or initiate a case transfer to another professional.

---

## 16. Notification System

### 16.1 Notification Taxonomy

| Event                     | Recipient                  | Channel            | Priority | Message                                               |
| ------------------------- | -------------------------- | ------------------ | -------- | ----------------------------------------------------- |
| Match found               | Professional               | Push + Email       | High     | "New case awaiting your support"                      |
| Case unactioned 10min     | Professional               | Push               | Urgent   | "A case needs your immediate attention"               |
| Case unactioned 20min     | Extended professional pool | Push + Email       | Urgent   | "Case needs support professional"                     |
| Meeting proposed          | Survivor                   | Push + SMS + Email | High     | "A professional has proposed meeting times"           |
| Meeting confirmed         | Professional               | Push               | High     | "Session confirmed. Case details now available."      |
| Reschedule requested      | Professional               | Push               | Medium   | "Survivor has requested different times"              |
| New time proposed         | Survivor                   | Push + SMS         | High     | "A new meeting time has been proposed"                |
| Case completion initiated | Other party                | Push + Email       | Medium   | "Case marked as complete — please review"             |
| Case fully completed      | Both                       | Push               | Low      | "Case archived. Thank you."                           |
| New chat message          | Recipient                  | Push               | Medium   | "New message in your case"                            |
| 12hr cascade              | HRDs (related)             | Push + Email       | High     | "Case requiring support has been unattended 12 hours" |
| 18hr cascade              | All HRDs                   | Push + Email       | Urgent   | "Urgent case requires HRD support"                    |
| 24hr cascade              | Administrators             | Dashboard + Email  | Critical | "Case requires administrative intervention"           |

### 16.2 Notification Rate Limiting

To prevent notification fatigue:

- A professional receives no more than 3 case-related notifications per hour during normal hours.
- Critical urgency cases bypass rate limiting.
- Survivors receive no more than 1 notification per case per hour during active case flow.
- System messages (completion, archival) are always delivered regardless of rate limiting.

### 16.3 Contact Preference Respect

The survivor's stated contact preference (`contact_preference`) gates notification channels:

- `phone_call`: Platform attempts to arrange via professional's coordination
- `sms`: SMS notifications are sent for high-priority events
- `email`: Email notifications for all events
- `do_not_contact`: Only in-platform notifications. No SMS, no email. The survivor must check the dashboard.

---

## 17. Edge Case Compendium

### 17.1 Professional Reports a Case as a Survivor

**Situation:** A verified professional creates a report for themselves as a survivor.

**Handling:** The system detects the user is flagged as a professional (`user_type = professional`). It creates the report with `is_survivor_role = true`. The matching engine excludes this professional from their own case's candidate pool. Their professional account and case dashboard remain entirely separate. Their case is matched to another professional in the standard flow.

### 17.2 All Professionals Decline a Case

**Situation:** Every professional in the extended pool declines the case.

**Handling:**

1. All HRDs are notified regardless of specialty alignment.
2. If all HRDs also decline, an administrator critical alert is fired.
3. Administrator may manually assign, contact a professional directly, or refer to an external partner organisation.
4. The case remains in `PENDING` with `cascade_level = ADMIN_REQUIRED`.

### 17.3 Professional Goes OOO Mid-Case

**Situation:** A professional with an `ACCEPTED` case activates OOO mode.

**Handling:** If the case is in `ACCEPTED` or later state, the professional has made a scheduling commitment. Activating OOO does not remove them from this case. The system:

- Sends a reminder: "You have active cases. Please communicate with your survivor before activating out-of-office mode."
- OOO is permitted, but the case is not reassigned automatically.
- If the survivor sends a message in chat and receives no response for 48 hours, a system alert prompts the administrator to investigate.
- The survivor may initiate a case transfer request from the chat (a "I need a different professional" option) which triggers re-matching.

### 17.4 Survivor Becomes Unreachable After Matching

**Situation:** A match is confirmed but the survivor never responds to meeting proposals, notifications time out, and the professional cannot reach them.

**Handling:**

- After 14 days of no survivor response to a proposal, the professional may initiate a "No Response — Case Unresolvable" closure.
- The case transitions to `CANCELLED` with reason `no_survivor_response`.
- The match record is archived.
- No penalty is applied to the professional's capacity count.

### 17.5 Duplicate Reports (Same Survivor, Same Incident)

**Situation:** A survivor submits multiple reports for the same incident (e.g., due to confusion or system re-submission).

**Handling:**

- The system detects likely duplicates by comparing `user_id`, `type_of_incident`, and `submission_timestamp` (within 1 hour window).
- If a likely duplicate is detected, the survivor is shown: "It looks like you may have already submitted a similar report. Do you want to continue or view your existing report?"
- If confirmed as duplicate, the new submission is discarded.
- If the survivor confirms it is a new/updated report, both are processed independently.
- Anonymous survivors cannot be de-duplicated — each anonymous submission is treated as independent.

### 17.6 Multi-Service Case with No Single Provider

**Situation:** A survivor requests medical and legal support, but no verified professional covers both, and all medical professionals are at capacity while legal professionals are available.

**Handling:**

- The matching engine runs with a multi-service score aggregation: a candidate covering one of the two requested services is scored, with a penalty for the uncovered service.
- An HRD is elevated in scoring as a coordinator candidate.
- The match may produce two separate matches: one legal, one medical (multi-match scenario).
- If multi-match is created, each professional sees only their relevant portion of the case in the pre-acceptance view.
- The survivor's case card shows multiple "Pending Professionals" under one case.

### 17.7 Professional Banned Mid-Case

**Situation:** An administrator bans a professional who has active accepted cases.

**Handling:**

- All `PENDING` and `PROPOSED` matches for this professional are immediately moved to `DECLINED`.
- `ACCEPTED` and `COMPLETION_PENDING` cases are flagged `requires_reassignment`.
- Each affected survivor receives a notification: "Your assigned professional is no longer available. We are finding you a replacement urgently."
- The matching engine immediately re-runs for each affected report as high-urgency.
- The chat room is preserved (read-only) for the survivor's records.

### 17.8 Geographic Mismatch — Survivor Location Unreliable

**Situation:** A survivor reports from a location far from their actual location (e.g., displaced person, traveller, VPN user skewing location).

**Handling:**

- The system uses the reported location as the primary signal.
- If the proximity scores result in no candidates above threshold (empty primary pool), the geographic hard filter is relaxed to a 500km radius.
- If still no candidates, remote professionals are elevated.
- The survivor is shown a note in the UX: "We're matching you with the best available support for your situation, which may include remote professionals."

### 17.9 Child Case with Record-Only Flag

**Situation:** A professional submitting on behalf of a child checks "record only" believing no intervention is needed, but the incident qualifies as child abuse or child labor.

**Handling:**

- The system overrides the `record_only` flag for child abuse and child labor cases.
- Matching proceeds regardless of the flag.
- The professional who submitted the report is shown: "Due to the nature of this case, mandatory matching protocols apply. A specialist will be assigned."
- The match is flagged `escalation_required = true`.

### 17.10 Professional Has No Active Cases But No Reports Exist

**Situation:** The proactive re-matching trigger fires for an idle professional but there are no unmatched reports.

**Handling:**

- No action taken. The professional's dashboard shows their "ready" status.
- When the next report is submitted, this professional receives the +30 capacity bonus and is highly likely to be among the top matches.

### 17.11 Reschedule Loop

**Situation:** Survivor and professional are in a back-and-forth reschedule loop with no resolution.

**Handling:**

- After 3 rounds of reschedule without acceptance, the system surfaces a mediation prompt to both parties:
  - To professional: "You and the survivor have been unable to agree on a time. Would you like to propose a remote/async session or transfer the case to another professional?"
  - To survivor: "We understand scheduling is difficult. Would you like to be matched with a different professional who may have more flexible availability?"
- If the survivor chooses re-matching, the case is re-processed with a "scheduling flexibility" weighting boost (availability score weighted 2×).

---

## 18. Scoring Reference Tables

### 18.1 Complete Score Contribution Summary

| Dimension                                | Maximum Contribution | Notes                                     |
| ---------------------------------------- | -------------------- | ----------------------------------------- |
| Clinical Specialty (Primary)             | +25                  | Once per candidate                        |
| Clinical Specialty (Explicit Request)    | +20                  | Stackable with Primary/Secondary          |
| Clinical Specialty (Secondary)           | +15                  | Once per candidate                        |
| Load Bonus (0 active cases)              | +30                  | Mutually exclusive with load penalty      |
| Proximity (within radius)                | +20                  | Linear from 0 at boundary to 20 at center |
| Remote Service                           | +15                  | Flat bonus                                |
| Demographic — Language                   | +15                  | Only if preferred_language set            |
| Demographic — Special Needs (per flag)   | +15                  | Up to 2 flags = +30                       |
| Professional Authority                   | +10                  | Per title-incident lookup                 |
| Demographic — Gender                     | +10                  | Only if gender preference set             |
| Availability Alignment                   | +10                  | Per urgency matrix                        |
| **Theoretical Maximum (pre-multiplier)** | **~170**             |                                           |
| Urgency Multiplier (High)                | ×1.2                 | Applied after sum                         |
| Urgency Multiplier (Medium)              | ×1.1                 | Applied after sum                         |

### 18.2 Hard Filter Summary

| Filter                   | Condition                                               | Result                               |
| ------------------------ | ------------------------------------------------------- | ------------------------------------ |
| Verification             | `verification_status ≠ verified`                        | Eliminated                           |
| Active Status            | `is_active = false`                                     | Eliminated                           |
| Ban Status               | `is_banned = true` OR `is_permanently_suspended = true` | Eliminated                           |
| OOO Status               | `out_of_office = true`                                  | Eliminated                           |
| Capacity                 | ≥5 truly active cases                                   | Eliminated                           |
| Consent-Legal            | `consent = no` AND title is Lawyer/Law Firm             | -∞ (eliminated)                      |
| Service Relevance        | Zero matching service types for incident                | Eliminated (except 'other' incident) |
| Geographic Hard Boundary | `distance > radius × 2.5` AND report age < 24hrs        | Eliminated                           |

### 18.3 State Transition Permission Matrix

| From State           | To State             | Permitted By                      |
| -------------------- | -------------------- | --------------------------------- |
| PENDING              | PROPOSED             | Professional (on scheduling)      |
| PENDING              | DECLINED             | Professional                      |
| PENDING              | CANCELLED            | Survivor                          |
| PROPOSED             | PENDING_SURVIVOR     | Survivor (reschedule request)     |
| PROPOSED             | ACCEPTED             | Survivor (confirms time)          |
| PROPOSED             | DECLINED             | Professional (withdraws proposal) |
| PENDING_SURVIVOR     | RESCHEDULE_REQUESTED | Professional (cannot accommodate) |
| PENDING_SURVIVOR     | ACCEPTED             | Survivor (confirms new time)      |
| RESCHEDULE_REQUESTED | PENDING_SURVIVOR     | Professional (proposes new times) |
| ACCEPTED             | COMPLETION_PENDING   | Either party                      |
| ACCEPTED             | CANCELLED            | Survivor (with reason)            |
| COMPLETION_PENDING   | COMPLETED            | Second party confirms             |
| COMPLETION_PENDING   | ACCEPTED             | Second party rejects completion   |
| COMPLETION_PENDING   | COMPLETED_AUTO       | 14-day timeout                    |

---

_End of Sauti Salama Matching Engine Specification v2.0_

_This document supersedes all prior matching specifications and code-level comments. Implementations must conform to this specification. Discrepancies between implementation and this document should be resolved in favour of this document._
