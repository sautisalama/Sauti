# Enhanced Appointment & Scheduling System

## Overview

This document outlines the comprehensive appointment and scheduling system integrated into the Sauti platform. The system provides seamless appointment management with Google Calendar integration, professional scheduling capabilities, and a clean user experience.

## Features Implemented

### 1. Appointment Management
- **Appointment Cards with Calendar Integration**: Enhanced appointment cards showing detailed information with Add to Calendar functionality
- **Multi-Calendar Support**: Google Calendar, Outlook, Office 365, Yahoo Calendar, and ICS file downloads
- **Status Management**: Confirmed, cancelled, and completed appointment statuses
- **Real-time Updates**: Live appointment status updates using Supabase real-time subscriptions

### 2. Google Calendar Integration
- **OAuth 2.0 Authentication**: Secure Google Calendar API integration
- **Automatic Event Creation**: Appointments automatically synced to Google Calendar
- **Event Updates & Deletion**: Bi-directional sync for appointment changes
- **Multiple Calendar Providers**: Support for various calendar applications

### 3. Professional Scheduling System
- **Cal.com Integration**: Embedded Cal.com scheduling for professionals
- **Advanced Time Slot Management**: Intelligent availability management
- **Public Booking Pages**: Professional-specific public scheduling links
- **Customizable Appointment Types**: Different session types with varying durations

### 4. Reports-Appointments Integration
- **Linked Data Display**: Reports now show related appointments with clickable links
- **Status Indicators**: Visual indicators for appointment statuses in reports
- **Navigation Integration**: Easy navigation between reports and appointments

## Implementation Details

### Core Components

#### 1. AddToCalendarButton Component
```typescript
// Location: app/dashboard/_components/AddToCalendarButton.tsx
// Features:
// - Multi-provider calendar support
// - Google Calendar API integration
// - ICS file generation
// - Toast notifications
```

#### 2. Enhanced Appointment Scheduler
```typescript
// Location: app/dashboard/_components/EnhancedAppointmentScheduler.tsx
// Features:
// - Advanced time slot management
// - Multiple appointment types
// - Availability checking
// - Professional notes
```

#### 3. Cal.com Scheduler
```typescript
// Location: app/dashboard/_components/CalScheduler.tsx
// Features:
// - Cal.com embedding
// - Configuration management
// - Share link generation
// - Professional dashboard integration
```

#### 4. Public Scheduling
```typescript
// Location: app/_components/EnhancedPublicScheduler.tsx
// Features:
// - Public appointment booking
// - Client information collection
// - Email notifications
// - Professional confirmation workflow
```

### API Endpoints

#### 1. Google Calendar Integration
- `POST /api/calendar/create-event` - Create calendar events
- `GET /api/auth/google-calendar/callback` - OAuth callback

#### 2. Public Appointments
- `POST /api/appointments/public` - Public appointment booking

### Database Schema Updates

The system requires the following database schema additions:

```sql
-- Add Google Calendar fields to profiles table
ALTER TABLE profiles ADD COLUMN google_calendar_token TEXT;
ALTER TABLE profiles ADD COLUMN google_calendar_refresh_token TEXT;
ALTER TABLE profiles ADD COLUMN cal_link TEXT;

-- Add appointment fields
ALTER TABLE appointments ADD COLUMN google_calendar_event_id TEXT;
ALTER TABLE appointments ADD COLUMN appointment_type TEXT;
ALTER TABLE appointments ADD COLUMN duration_minutes INTEGER DEFAULT 60;
ALTER TABLE appointments ADD COLUMN emergency_contact TEXT;
ALTER TABLE appointments ADD COLUMN created_via TEXT DEFAULT 'dashboard';

-- Add public booking support to profiles
ALTER TABLE profiles ADD COLUMN is_public_booking BOOLEAN DEFAULT FALSE;
```

## Configuration

### Environment Variables
```env
# Google Calendar Integration
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Cal.com Integration (Optional)
CALCOM_API_KEY=your_calcom_api_key

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Google Calendar Setup
1. Create a Google Cloud Project
2. Enable the Google Calendar API
3. Create OAuth 2.0 credentials
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/google-calendar/callback`
   - `https://yourdomain.com/api/auth/google-calendar/callback`

## Usage Guide

### For Professionals

#### Setting Up Scheduling
1. Navigate to Dashboard → Scheduling tab
2. Configure your Cal.com link (optional)
3. Set availability preferences
4. Share your booking link: `/schedule/sauti-{your-id}`

#### Managing Appointments
1. View appointments in the Appointments tab
2. Use the Add to Calendar button to sync appointments
3. Update appointment status as needed
4. Add professional notes for record keeping

### For Survivors/Clients

#### Booking Appointments
1. Visit the professional's public booking page
2. Select appointment type and preferred time
3. Fill in contact information
4. Submit appointment request
5. Receive confirmation email

#### Calendar Integration
1. Click "Add to Calendar" on appointment cards
2. Choose your preferred calendar provider
3. Appointment is automatically added to your calendar

## Best Practices

### Security
- All appointments require professional confirmation
- Client data is encrypted in transit and at rest
- Google Calendar tokens are securely stored
- Public booking pages validate all input

### User Experience
- Clean, intuitive interface design
- Real-time updates and notifications
- Mobile-responsive design
- Accessibility compliance (WCAG 2.1)

### Data Management
- Automatic cleanup of expired tokens
- Appointment history retention
- Privacy-compliant data handling
- GDPR compliance for EU users

## Testing

### Unit Tests
Run the following tests to ensure functionality:

```bash
# Test Google Calendar integration
npm test -- calendar

# Test appointment booking
npm test -- appointments

# Test public scheduling
npm test -- public-scheduler
```

### Manual Testing Checklist
- [ ] Google Calendar OAuth flow
- [ ] Appointment creation and updates
- [ ] Public booking functionality
- [ ] Calendar synchronization
- [ ] Email notifications
- [ ] Mobile responsiveness

## Troubleshooting

### Common Issues

#### Google Calendar Not Connecting
1. Verify OAuth credentials are correct
2. Check redirect URIs match exactly
3. Ensure Google Calendar API is enabled
4. Verify user has granted necessary permissions

#### Appointments Not Syncing
1. Check database connections
2. Verify real-time subscriptions are active
3. Ensure proper error handling is in place
4. Check API rate limits

#### Public Booking Issues
1. Verify email sending functionality
2. Check database schema is up to date
3. Ensure proper form validation
4. Test appointment confirmation workflow

## Future Enhancements

### Planned Features
- [ ] Advanced recurring appointments
- [ ] Integration with more calendar providers
- [ ] SMS notifications
- [ ] Video call integration (Zoom, Meet)
- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Advanced availability rules
- [ ] Waiting list functionality

### Technical Improvements
- [ ] Enhanced error handling
- [ ] Performance optimizations
- [ ] Improved accessibility features
- [ ] Advanced testing coverage
- [ ] Documentation improvements

## Support

For technical support or questions about the appointment system:
1. Check this documentation first
2. Review the troubleshooting section
3. Check the application logs
4. Contact the development team

## Changelog

### Version 1.0.0 (Current)
- Initial implementation
- Google Calendar integration
- Cal.com integration
- Public booking system
- Reports integration
- Enhanced UI/UX

---

*Last updated: September 11, 2024*
*Version: 1.0.0*
