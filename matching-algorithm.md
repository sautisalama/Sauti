# Survivor-Professional Matching System

## Overview

The platform implements an automated matching system that connects survivors reporting abuse with relevant professional service providers. The core matching logic is implemented in the `matchReportWithServices` action, which evaluates multiple factors:

- Service type compatibility and priority weighting
- Geographic distance calculation using Haversine formula
- Professional's defined coverage area
- Service availability status

## Technical Implementation

### 1. Report Submission Flow

When a survivor submits a report through the platform:

1. The report data is submitted via POST `/api/reports`
2. The system stores the report in the Supabase database
3. The matching algorithm is triggered automatically
4. Email notifications are sent to configured recipients
5. Real-time updates are pushed to relevant professionals

#### Reference implementation:

typescript:app/api/reports/route.ts
startLine: 11
endLine: 74

### 2. Matching Algorithm Details

The matching service implements a scoring system that:

1. Calculates service compatibility scores:

   - Matches required services with professional service types
   - Applies priority weighting based on service order
   - Higher scores for primary service matches

2. Evaluates geographic proximity:

   - Uses Haversine formula for accurate distance calculation
   - Considers professional's coverage radius (default 50km)
   - Scores inversely proportional to distance

3. Selects best matches:
   - Filters services above score threshold
   - Sorts by total score
   - Returns top 3 matching professionals

#### Reference implementation:

typescript:app/actions/match-services.ts
startLine: 26
endLine: 121

### 3. Real-time Updates

The system leverages Supabase's real-time capabilities for:

1. Professional Dashboard:

   - Live updates of new matches
   - Real-time status changes
   - Immediate match notifications

2. Survivor Dashboard:
   - Match status updates
   - Service provider responses
   - Case progress tracking

#### Reference implementation:

typescript:app/dashboard/views/ProfesionalView.tsx
startLine: 135
endLine: 193

### 4. Security Measures

The system implements several security measures:

1. Authentication checks:

   - Required for all sensitive operations
   - Session validation on API routes
   - User type-specific access controls

2. Data ownership verification:
   - Report ownership validation
   - Service provider verification
   - Match status update authorization

#### Reference implementation:

typescript:app/api/reports/[id]/route.ts
startLine: 4
endLine: 44

## Database Schema

### Reports Table

- `report_id`: UUID primary key
- `user_id`: Foreign key to users (optional for anonymous reports)
- `type_of_incident`: Enum of incident types
- `required_services`: Array of required service types
- `latitude`, `longitude`: Geographic coordinates
- `submission_timestamp`: Timestamp
- `urgency`: Enum of urgency levels

### Support Services Table

- `id`: UUID primary key
- `user_id`: Foreign key to users
- `service_types`: Comma-separated list of services
- `coverage_area_radius`: Number (kilometers)
- `latitude`, `longitude`: Service location
- `availability`: Service availability status

### Matched Services Table

- `id`: UUID primary key
- `report_id`: Foreign key to reports
- `service_id`: Foreign key to support services
- `match_score`: Numeric score
- `match_date`: Timestamp
- `status`: Match status enum

## Future Enhancements

Planned improvements to the matching system:

1. Machine Learning Integration:

   - Pattern recognition for service matching
   - Predictive scoring based on historical success
   - Dynamic coverage area optimization

2. Enhanced Geographic Matching:

   - Multi-point service coverage areas
   - Public transport accessibility
   - Service capacity balancing

3. Automated Follow-up:
   - Status update reminders
   - Service delivery verification
   - Feedback collection and analysis

````markdown
# Survivor-Professional Matching System

## Overview

The platform implements an automated matching system that connects survivors reporting abuse with relevant professional service providers. The core matching logic is implemented in the `matchReportWithServices` action, which evaluates multiple factors:

- Service type compatibility and priority weighting
- Geographic distance calculation using Haversine formula
- Professional's defined coverage area
- Service availability status

## Technical Implementation

### 1. Report Submission Flow

When a survivor submits a report through the platform:

1. The report data is submitted via POST `/api/reports`
2. The system stores the report in the Supabase database
3. The matching algorithm is triggered automatically
4. Email notifications are sent to configured recipients
5. Real-time updates are pushed to relevant professionals

Reference implementation:

```typescript:app/api/reports/route.ts
startLine: 11
endLine: 74
```
````

### 2. Matching Algorithm Details

The matching service implements a scoring system that:

1. Calculates service compatibility scores:

   - Matches required services with professional service types
   - Applies priority weighting based on service order
   - Higher scores for primary service matches

2. Evaluates geographic proximity:

   - Uses Haversine formula for accurate distance calculation
   - Considers professional's coverage radius (default 50km)
   - Scores inversely proportional to distance

3. Selects best matches:
   - Filters services above score threshold
   - Sorts by total score
   - Returns top 3 matching professionals

Reference implementation:

```typescript:app/actions/match-services.ts
startLine: 26
endLine: 121
```

### 3. Real-time Updates

The system leverages Supabase's real-time capabilities for:

1. Professional Dashboard:

   - Live updates of new matches
   - Real-time status changes
   - Immediate match notifications

2. Survivor Dashboard:
   - Match status updates
   - Service provider responses
   - Case progress tracking

Reference implementation:

```typescript:app/dashboard/_views/ProfesionalView.tsx
startLine: 135
endLine: 193
```

### 4. Security Measures

The system implements several security measures:

1. Authentication checks:

   - Required for all sensitive operations
   - Session validation on API routes
   - User type-specific access controls

2. Data ownership verification:
   - Report ownership validation
   - Service provider verification
   - Match status update authorization

Reference implementation:

```typescript:app/api/reports/[id]/route.ts
startLine: 4
endLine: 44
```

## Database Schema

### Reports Table

- `report_id`: UUID primary key
- `user_id`: Foreign key to users (optional for anonymous reports)
- `type_of_incident`: Enum of incident types
- `required_services`: Array of required service types
- `latitude`, `longitude`: Geographic coordinates
- `submission_timestamp`: Timestamp
- `urgency`: Enum of urgency levels

### Support Services Table

- `id`: UUID primary key
- `user_id`: Foreign key to users
- `service_types`: Comma-separated list of services
- `coverage_area_radius`: Number (kilometers)
- `latitude`, `longitude`: Service location
- `availability`: Service availability status

### Matched Services Table

- `id`: UUID primary key
- `report_id`: Foreign key to reports
- `service_id`: Foreign key to support services
- `match_score`: Numeric score
- `match_date`: Timestamp
- `status`: Match status enum

## Future Enhancements

Planned improvements to the matching system:

1. Machine Learning Integration:

   - Pattern recognition for service matching
   - Predictive scoring based on historical success
   - Dynamic coverage area optimization

2. Enhanced Geographic Matching:

   - Multi-point service coverage areas
   - Public transport accessibility
   - Service capacity balancing

3. Automated Follow-up:
   - Status update reminders
   - Service delivery verification
   - Feedback collection and analysis

```

This documentation provides a technical overview of the matching system's implementation while maintaining readability for developers who need to understand or contribute to the system.

```
