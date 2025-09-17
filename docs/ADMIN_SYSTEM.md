# Admin System Documentation

## Overview

The admin system provides comprehensive platform management capabilities for verified administrators. Admins can verify users and services, manage bans, view platform statistics, and monitor service coverage areas. This system uses proper PostgreSQL enum types for better data integrity and performance.

## Recent Updates

- ✅ **Fixed database schema issues** - Corrected column references (`user_type` instead of `role`)
- ✅ **Implemented enum types** - Better performance and data integrity
- ✅ **Fixed RLS policy recursion** - Resolved infinite recursion in admin policies
- ✅ **Consolidated files** - Removed v2 suffixes, single source of truth

## Features

### 1. Role Management

- **Admin Role**: Users can be assigned admin privileges while maintaining their primary role (survivor, professional, or NGO)
- **Role Switching**: Admins can toggle between their regular user dashboard and admin dashboard
- **Access Control**: Admin features are only accessible to users with `is_admin = true`

### 2. Verification System

- **User Verification**: Review and verify professional and NGO accounts
- **Service Verification**: Review and verify support services
- **Document Review**: Access uploaded accreditation documents
- **Status Management**: Set verification status (pending, under_review, verified, rejected)
- **Notes System**: Add verification notes and comments

### 3. User Management

- **User Listing**: View all users with filtering and search capabilities
- **Ban Management**: Ban/unban users with reason tracking
- **Status Overview**: Monitor verification status across all users
- **Audit Trail**: Track all admin actions with timestamps

### 4. Service Management

- **Service Listing**: View all support services with filtering
- **Coverage Management**: Monitor service coverage areas and locations
- **Service Verification**: Verify service providers and their offerings
- **Availability Control**: Activate/deactivate services

### 5. Statistics Dashboard

- **User Counts**: Total survivors, professionals, NGOs, and admins
- **Verification Stats**: Pending, verified, and rejected counts
- **Service Stats**: Active, pending, and banned services
- **Real-time Updates**: Statistics update automatically

### 6. Coverage Map

- **Geographic Visualization**: View service coverage areas on a map
- **Filtering**: Filter by service type, verification status, and activity
- **Location Data**: Display service locations and coverage radii
- **Statistics**: Coverage area statistics and service distribution

## Database Schema

### New Tables

#### admin_actions

Tracks all admin actions for audit purposes:

```sql
- id: UUID (Primary Key)
- admin_id: UUID (Foreign Key to profiles)
- action_type: VARCHAR(50) (verify_user, ban_user, etc.)
- target_type: VARCHAR(20) (user, service)
- target_id: UUID (profile_id or service_id)
- details: JSONB (action-specific data)
- created_at: TIMESTAMP
```

#### admin_statistics

Caches platform statistics for performance:

```sql
- id: UUID (Primary Key)
- stat_type: VARCHAR(50) (user_counts, service_counts, etc.)
- stat_data: JSONB (statistical data)
- updated_at: TIMESTAMP
```

### Modified Tables

#### profiles

Added admin and verification fields:

```sql
- is_admin: BOOLEAN (default false)
- admin_verified_at: TIMESTAMP
- admin_verified_by: UUID (foreign key)
- is_banned: BOOLEAN (default false)
- banned_at: TIMESTAMP
- banned_by: UUID (foreign key)
- ban_reason: TEXT
- verification_status: VARCHAR(20) (pending, verified, rejected, under_review)
- verification_notes: TEXT
- verification_updated_at: TIMESTAMP
```

#### support_services

Added verification and ban fields:

```sql
- verification_status: VARCHAR(20)
- verification_notes: TEXT
- verification_updated_at: TIMESTAMP
- verified_by: UUID (foreign key)
- verified_at: TIMESTAMP
- is_active: BOOLEAN (default true)
- is_banned: BOOLEAN (default false)
- banned_at: TIMESTAMP
- banned_by: UUID (foreign key)
- ban_reason: TEXT
```

## API Endpoints

### Admin Statistics

```
GET /api/admin/stats
```

Returns platform statistics for the admin dashboard.

### Verification Management

```
POST /api/admin/verify
Body: {
  targetType: "user" | "service",
  targetId: string,
  action: "verify" | "reject",
  notes?: string
}
```

### Ban Management

```
POST /api/admin/ban
Body: {
  targetType: "user" | "service",
  targetId: string,
  action: "ban" | "unban",
  reason?: string
}
```

## Setup Instructions

### 1. Database Migration

Run the migration script to set up the admin system:

```sql
-- Execute migrations/admin_role_system.sql in Supabase
```

### 2. Assign Admin Role

Use the provided script to assign admin privileges:

```sql
-- Update scripts/assign-admin-role.sql with the target email
-- Execute in Supabase SQL editor
```

### 3. Environment Variables

Ensure these environment variables are set:

```env
NEXT_PUBLIC_APP_URL=your_app_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Usage Guide

### For Administrators

1. **Access Admin Dashboard**

   - Log in with an admin account
   - Use the role switcher in the sidebar to switch to "Admin Mode"
   - Navigate to the Admin Dashboard

2. **Verify Users**

   - Go to the "Verification" tab
   - Review pending user applications
   - Click "Review" to examine documents and details
   - Approve or reject with notes

3. **Verify Services**

   - Switch to "Services" tab in verification queue
   - Review service applications and documents
   - Verify or reject services with appropriate notes

4. **Manage Users**

   - Use the "Users" tab to view all users
   - Filter by role, status, or ban status
   - Ban/unban users as needed
   - Search for specific users

5. **Manage Services**

   - Use the "Services" tab to view all services
   - Filter by type, status, or ban status
   - Activate/deactivate services
   - Monitor service coverage

6. **View Coverage Map**
   - Use the "Coverage" tab to see service locations
   - Filter by service type and verification status
   - Monitor geographic distribution of services

### For Developers

1. **Adding New Admin Features**

   - Create new API routes in `/app/api/admin/`
   - Add corresponding UI components in `/app/dashboard/admin/_components/`
   - Update the admin dashboard page to include new features

2. **Customizing Verification Process**

   - Modify verification status options in the database
   - Update verification UI components
   - Add new verification criteria as needed

3. **Extending Statistics**
   - Add new stat types to `admin_statistics` table
   - Update the `admin_dashboard_stats` view
   - Modify `AdminStatsCards` component

## Security Considerations

1. **Access Control**

   - All admin routes check for admin privileges
   - RLS policies prevent non-admin access to sensitive data
   - Admin actions are logged for audit purposes

2. **Data Protection**

   - Survivor email addresses are not exposed to admins
   - Sensitive user data is protected by RLS policies
   - Admin actions are tracked and logged

3. **Audit Trail**
   - All admin actions are logged in `admin_actions` table
   - Includes admin ID, action type, target, and details
   - Timestamps for all actions

## Troubleshooting

### Common Issues

1. **Admin Role Not Working**

   - Check if `is_admin = true` in profiles table
   - Verify RLS policies are correctly set
   - Ensure user is properly authenticated

2. **Verification Not Updating**

   - Check database triggers are working
   - Verify API endpoints are accessible
   - Check for JavaScript errors in browser console

3. **Statistics Not Loading**
   - Verify `admin_dashboard_stats` view exists
   - Check database permissions
   - Ensure API routes are working

### Support

For technical support or questions about the admin system, please refer to the main project documentation or contact the development team.
