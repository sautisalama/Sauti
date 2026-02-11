# Calendar UI Improvements

## Changes Made

### 1. Unified Calendar Design

- Implemented a custom calendar component replacing the default `UIDateCalendar`.
- Added support for **Week** and **Month** views with toggle buttons.
- Styled to match the `ProfessionalView` dashboard aesthetic (blue accents, rounded corners).

### 2. Smart Agenda & Notifications

- Below the calendar, appointments for the selected date are now listed with detailed information (Service Name, Time, Status).
- **"Upcoming This Week"**: If today is selected and has no appointments, the next 3 upcoming appointments for the week are automatically displayed.
- Clear empty states when no activities are found.

### 3. Files Updated

- `app/dashboard/cases/cases-master-detail.tsx`: Calendar logic integrated with case appointments.
- `app/dashboard/reports/reports-master-detail.tsx`: Calendar logic integrated with report appointments.

## Verifying Changes

1. Navigate to `/dashboard/cases` or `/dashboard/reports`.
2. Toggle between Week and Month views.
3. Select a date with an appointment (marked with a blue dot or color).
4. Verify the list below updates correctly.
5. Select today (if empty) to see potential "Upcoming This Week" items.
