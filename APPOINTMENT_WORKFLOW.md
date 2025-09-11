# Sauti Appointment System: Complete Workflow Guide

This document explains how the appointment system works in Sauti, from the moment a survivor creates a report to scheduling and managing appointments with professionals.

## 📋 Overview

The Sauti appointment system creates a seamless flow connecting survivors who need help with professionals who can provide support. The system includes automated matching, professional scheduling, and comprehensive appointment management.

## 🔄 Complete Workflow

### 1. **Report Creation** (Survivor Side)

**What happens when a survivor creates a report:**

1. **Survivor fills out abuse report** through the authenticated report form
   - Incident details, urgency level, required services
   - Contact preferences and consent information
   - Location data (if consent given)

2. **Report is saved to database** with status `pending`
   - Assigned unique `report_id`
   - Marked as `ismatched: false`
   - Status set to `match_status: pending`

3. **Automatic service matching begins**
   - System runs matching algorithm (`matchReportWithServices()`)
   - Finds professionals with relevant support services
   - Creates entries in `matched_services` table

---

### 2. **Service Matching** (Automated Process)

**How the system connects survivors with professionals:**

```
Report Created → Matching Algorithm → Matched Services → Professional Notifications
```

1. **Algorithm analyzes report:**
   - Incident type (domestic_violence, sexual_assault, etc.)
   - Required services (counseling, legal_aid, medical, etc.)
   - Location/proximity (if location sharing enabled)
   - Urgency level (high, medium, low)

2. **Finds compatible professionals:**
   - Professionals with matching `service_types`
   - Active support services in the database
   - Geographic proximity (if applicable)

3. **Creates match records:**
   ```sql
   INSERT INTO matched_services (
     report_id,
     service_id,
     match_status_type: 'pending',
     match_score
   )
   ```

4. **Professionals receive notifications** about potential matches

---

### 3. **Professional Review** (Professional Side)

**How professionals evaluate and respond to matches:**

1. **Professional views match in dashboard:**
   - **Cases Tab** shows pending matches
   - Can see anonymized report details
   - Incident description and required services
   - Urgency indicators and match score

2. **Professional can take actions:**
   - ✅ **Accept** - Agree to help this survivor
   - ❌ **Decline** - Not able to help (with optional reason)
   - 📝 **Request more info** - Need clarification before deciding

3. **When professional accepts:**
   - Match status changes to `accepted`
   - Report status changes to `accepted`
   - Report marked as `ismatched: true`
   - **Appointment scheduling becomes available**

---

### 4. **Appointment Scheduling** (Both Sides)

**Three ways appointments can be created:**

#### Option A: Professional Schedules (Internal)
1. **Professional goes to accepted match**
2. **Clicks "Schedule Appointment" button**
3. **Enhanced scheduler opens:**
   - Calendar date picker (weekdays only)
   - Time slot selection (9 AM - 5 PM)
   - Appointment type selection (consultation, therapy, etc.)
   - Duration selection (30, 45, 60, 90, 120 minutes)
   - Professional notes field

4. **Appointment is created:**
   ```sql
   INSERT INTO appointments (
     professional_id,
     survivor_id,
     appointment_date,
     appointment_type,
     duration_minutes,
     status: 'confirmed',
     created_via: 'dashboard'
   )
   ```

#### Option B: Public Booking (External)
1. **Professional shares public booking link:** `/schedule/sauti-{professional-id}`
2. **Anyone can visit and book directly:**
   - Professional profile and services shown
   - Available time slots displayed
   - Client information form
   - Emergency contact collection
   - Session type selection

3. **Creates appointment with status `requested`:**
   - Professional must confirm before it's finalized
   - Email notifications sent to both parties

#### Option C: Cal.com Integration (Professional)
1. **Professional sets up Cal.com link in settings**
2. **Cal.com embedded in Scheduling tab**
3. **Clients book through professional Cal.com system**
4. **Appointments sync back to Sauti system**

---

### 5. **Appointment Management** (Both Sides)

**How appointments are managed once scheduled:**

#### **For Survivors:**
- **View appointments** in Dashboard → Appointments tab
- **See appointment details:** date, time, professional info
- **Add to calendar:** Google Calendar, Outlook, Yahoo, ICS download
- **Send messages** via integrated chat
- **View appointment status:** confirmed, requested, completed, cancelled

#### **For Professionals:**
- **View all appointments** in Dashboard → Appointments tab
- **Manage appointment details:**
  - Update status (confirm, complete, cancel, reschedule)
  - Add professional notes (private, for record keeping)
  - View survivor contact information
  - Access related report details
- **Calendar integration:**
  - Sync with Google Calendar automatically
  - Add to any calendar provider
  - Download ICS files
- **Communication:**
  - Chat directly with survivor
  - Call if phone number provided

---

### 6. **Google Calendar Integration** 🗓️

**Seamless calendar synchronization:**

#### **Setup Process:**
1. **User connects Google Calendar:**
   - OAuth 2.0 authentication flow
   - Secure token storage in database
   - Automatic token refresh handling

2. **Appointment calendar events:**
   - Automatically created in Google Calendar
   - Include all relevant details
   - Set appropriate reminders
   - Update when appointment changes

#### **Calendar Features:**
- **Multi-provider support:** Google, Outlook, Yahoo, Apple
- **ICS file generation** for offline calendar apps
- **Automatic sync** when appointments change
- **Smart conflict detection**
- **Timezone handling**

---

### 7. **Reports-Appointments Integration** 📊

**How reports and appointments work together:**

#### **In Reports Tab:**
- **Enhanced report cards** show appointment status
- **Visual indicators** for appointment scheduling
- **Direct links** to related appointments
- **Status tracking:** shows appointment progress

#### **Report Status Flow:**
```
Report Created → Matched → Accepted → Appointment Scheduled → Session Completed
```

#### **Data Linking:**
- Reports link to `matched_services`
- Matched services link to `appointments`
- Full traceability from report to resolution
- Comprehensive case management view

---

## 🎯 Key Features

### **Smart Scheduling**
- **Availability checking** prevents double-booking
- **Business hours enforcement** (9 AM - 5 PM, weekdays)
- **Duration-based scheduling** (30-120 minute sessions)
- **Conflict detection** across all booking methods

### **Multi-Channel Booking**
- **Internal dashboard** for matched cases
- **Public booking pages** for direct scheduling
- **Cal.com integration** for professional workflows
- **Mobile-responsive** design for all interfaces

### **Communication Integration**
- **Built-in chat system** for secure messaging
- **Email notifications** for appointment updates
- **Calendar reminders** through Google Calendar
- **Phone contact** when provided

### **Professional Tools**
- **Comprehensive dashboard** for appointment management
- **Professional notes** for case documentation
- **Status management** with workflow controls
- **Calendar synchronization** with external systems

### **Security & Privacy**
- **Row-level security** for data protection
- **Secure authentication** for all operations
- **Encrypted token storage** for calendar integration
- **Privacy-compliant** data handling

---

## 🔧 Technical Implementation

### **Database Schema**
```sql
-- Key relationships
reports → matched_services → appointments
profiles (professional/survivor) → appointments
appointments → google_calendar_events
```

### **API Endpoints**
- `POST /api/appointments` - Create appointment from match
- `POST /api/appointments/public` - Public booking creation
- `POST /api/calendar/create-event` - Google Calendar integration
- `GET /api/auth/google-calendar/callback` - OAuth handling

### **Real-time Features**
- **Live appointment updates** via Supabase subscriptions
- **Automatic status synchronization**
- **Real-time availability checking**
- **Instant notification delivery**

---

## 🎨 User Experience

### **For Survivors:**
1. **Simple reporting** process with clear forms
2. **Automatic matching** - no additional action needed
3. **Easy appointment booking** with multiple options
4. **Clear appointment management** with calendar integration
5. **Secure communication** with professionals

### **For Professionals:**
1. **Efficient match review** with relevant information
2. **Flexible scheduling** options for different workflows
3. **Comprehensive appointment management**
4. **Professional notes** for case tracking
5. **Calendar integration** with existing systems

---

## 🚀 Getting Started

### **As a Survivor:**
1. Create a report describing your situation
2. Wait for professional matches (usually within 24 hours)
3. Professional will contact you to schedule appointment
4. Use appointment management tools to track sessions

### **As a Professional:**
1. Set up your support services in the dashboard
2. Review incoming matches in the Cases tab
3. Accept matches you can help with
4. Schedule appointments using your preferred method
5. Manage ongoing appointments and case notes

### **Setting Up Scheduling:**
1. Configure your availability preferences
2. Connect Google Calendar for sync (optional)
3. Set up Cal.com integration (optional)
4. Share your public booking link with clients
5. Customize appointment types and durations

---

## 📞 Support Features

### **Crisis Management:**
- **High-priority matching** for urgent cases
- **Emergency contact collection** during booking
- **Crisis intervention** appointment types
- **24/7 availability** options for critical cases

### **Case Continuity:**
- **Complete case history** from report to resolution
- **Professional notes** for session tracking
- **Follow-up scheduling** for ongoing support
- **Multi-session** appointment management

---

## 🔮 Future Enhancements

**Planned Features:**
- **SMS notifications** for appointment reminders
- **Video call integration** (Zoom, Google Meet)
- **Recurring appointment** scheduling
- **Advanced analytics** for case outcomes
- **Multi-language support** for diverse communities
- **Mobile app** for enhanced accessibility

---

The Sauti appointment system creates a comprehensive support ecosystem that seamlessly connects survivors with professional help, ensuring no one falls through the cracks and everyone gets the support they need. 💙
