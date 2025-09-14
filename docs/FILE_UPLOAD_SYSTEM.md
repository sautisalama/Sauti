# Enhanced File Upload System for Professional Accreditation

## Overview

This document describes the comprehensive file upload system implemented for professional accreditation documents in the Sauti Salama platform. The system supports role-based file organization, service-specific document management for NGO users, and secure file storage with proper access controls.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [User Roles and Permissions](#user-roles-and-permissions)
3. [File Upload Flow](#file-upload-flow)
4. [Folder Structure](#folder-structure)
5. [Service Validation for NGO Users](#service-validation-for-ngo-users)
6. [Security Implementation](#security-implementation)
7. [Database Schema](#database-schema)
8. [API Endpoints](#api-endpoints)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

## System Architecture

### Components

1. **File Upload Service** (`lib/file-upload.ts`)

   - Handles file validation, upload, and organization
   - Manages user-based folder structure
   - Provides service-specific upload capabilities

2. **Service Validation Service** (`lib/service-validation.ts`)

   - Validates NGO user service creation
   - Prevents conflicting service types
   - Provides validation feedback

3. **Enhanced UI Components**

   - `EnhancedProfessionalDocumentsForm` - For NGO users with multiple services
   - `ProfessionalDocumentsForm` - For individual professionals
   - Service selection and document management interfaces

4. **Database Layer**
   - Enhanced profiles table with file metadata
   - Service-specific file organization
   - Verification status tracking

## User Roles and Permissions

### Professional Users

- Can upload accreditation documents for their single service type
- Files stored in: `accreditation/{user_id}/`
- Limited to one service type per account

### NGO Users

- Can create multiple services in different fields
- Files organized by service: `accreditation/{user_id}/{service_type}/{service_id}/`
- Service type validation prevents conflicts
- Can manage documents per service

### Survivor Users

- Cannot upload accreditation documents
- Can upload report media files
- Limited to report-related uploads

## File Upload Flow

### 1. File Selection and Validation

```typescript
// File validation includes:
- File size limits (10MB for accreditation, 5MB for profile, 50MB for reports)
- File type validation (PDF, images, documents)
- File name sanitization
- Security checks for malicious files
```

### 2. Service Selection (NGO Users Only)

```typescript
// NGO users must select a service before uploading
- Service must be in a different field group than existing services
- Field groups: Legal, Medical/Mental Health, Shelter/Financial, Other
- Validation prevents conflicting service types
```

### 3. File Upload Process

```typescript
// Upload process:
1. Validate file and user permissions
2. Generate secure file path based on user and service
3. Upload to appropriate Supabase storage bucket
4. Generate public URL
5. Update database with file metadata
6. Return upload confirmation
```

### 4. Verification Status Update

```typescript
// Automatic verification status updates:
- Files uploaded → Status: "under_review"
- Admin verification → Status: "verified" or "rejected"
- Status changes trigger notifications
```

## Folder Structure

### Standard Structure

```
accreditation-files/
├── accreditation/
│   └── {user_id}/
│       ├── document1.pdf
│       ├── document2.jpg
│       └── ...
```

### NGO Service-Specific Structure

```
accreditation-files/
├── accreditation/
│   └── {user_id}/
│       ├── legal/
│       │   └── {service_id}/
│       │       ├── license.pdf
│       │       └── certification.jpg
│       ├── medical/
│       │   └── {service_id}/
│       │       ├── medical_license.pdf
│       │       └── degree_certificate.jpg
│       └── shelter/
│           └── {service_id}/
│               ├── facility_license.pdf
│               └── registration.pdf
```

### Profile Images

```
profile-images/
├── profile/
│   └── {user_id}/
│       ├── avatar.jpg
│       └── profile_photo.png
```

### Report Media

```
report-media/
├── reports/
│   └── {report_id}/
│       ├── image1.jpg
│       ├── audio1.webm
│       └── ...
```

## Service Validation for NGO Users

### Field Group Definitions

| Field Group | Services                      | Description                                    |
| ----------- | ----------------------------- | ---------------------------------------------- |
| Legal       | legal                         | Legal services, court representation, advocacy |
| Medical     | medical, mental_health        | Healthcare and mental health services          |
| Shelter     | shelter, financial_assistance | Housing and financial support services         |
| Other       | other                         | Specialized services not in other categories   |

### Validation Rules

1. **Single Field Group Rule**: NGO users cannot create services in the same field group
2. **Service Type Validation**: Each service must have appropriate accreditation documents
3. **Document Requirements**: Different service types require different document types

### Example Validation Scenarios

```typescript
// ✅ ALLOWED: Different field groups
Existing: legal;
New: medical, shelter, financial_assistance, other;

// ❌ NOT ALLOWED: Same field group
Existing: legal;
New: legal;

// ❌ NOT ALLOWED: Related services
Existing: medical;
New: mental_health;
```

## Security Implementation

### File Upload Security

1. **File Type Validation**

   - Whitelist of allowed MIME types
   - File extension verification
   - Content-type checking

2. **File Size Limits**

   - 10MB for accreditation documents
   - 5MB for profile images
   - 50MB for report media

3. **File Name Sanitization**

   - Remove dangerous characters
   - Generate secure file names
   - Prevent path traversal attacks

4. **Access Control**
   - User-specific folder access
   - Service-specific permissions for NGO users
   - Public read access for verification

### Database Security

1. **Row Level Security (RLS)**

   - Users can only access their own data
   - Service-specific access controls
   - Admin override capabilities

2. **Storage Policies**
   - Bucket-level access controls
   - Folder-based permissions
   - Public read for verification

## Database Schema

### Enhanced Profiles Table

```sql
ALTER TABLE profiles
ADD COLUMN accreditation_files_metadata JSONB DEFAULT '[]'::jsonb,
ADD COLUMN profile_image_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN verification_status TEXT DEFAULT 'pending',
ADD COLUMN verification_notes TEXT,
ADD COLUMN last_verification_check TIMESTAMP WITH TIME ZONE;
```

### Enhanced Support Services Table

```sql
ALTER TABLE support_services
ADD COLUMN accreditation_files_metadata JSONB DEFAULT '[]'::jsonb,
ADD COLUMN verification_status TEXT DEFAULT 'pending',
ADD COLUMN verification_notes TEXT,
ADD COLUMN last_verification_check TIMESTAMP WITH TIME ZONE;
```

### File Metadata Structure

```json
{
	"title": "Professional License",
	"url": "https://storage.url/file.pdf",
	"uploadedAt": "2024-01-01T00:00:00Z",
	"fileSize": 1024000,
	"fileType": "application/pdf",
	"serviceId": "uuid",
	"serviceType": "legal"
}
```

## API Endpoints

### File Upload Endpoints

1. **Upload Accreditation Document**

   ```typescript
   POST /api/upload/accreditation
   Body: {
     file: File,
     serviceId?: string,
     serviceType?: string
   }
   ```

2. **Upload Profile Image**

   ```typescript
   POST / api / upload / profile;
   Body: {
   	file: File;
   }
   ```

3. **Get User Files**
   ```typescript
   GET /api/files/user/{userId}
   Query: {
     fileType: 'accreditation' | 'profile' | 'report',
     serviceId?: string
   }
   ```

### Service Management Endpoints

1. **Create Support Service** (with validation)

   ```typescript
   POST /api/support-services
   Body: {
     name: string,
     service_types: SupportServiceType,
     // ... other fields
   }
   ```

2. **Get User Services**
   ```typescript
   GET /api/support-services
   Returns: Service[] with validation status
   ```

## Best Practices

### File Upload Best Practices

1. **File Validation**

   - Always validate file types and sizes on both client and server
   - Use whitelist approach for allowed file types
   - Implement virus scanning for uploaded files

2. **File Organization**

   - Use user-specific folders for security
   - Implement service-specific organization for NGO users
   - Use descriptive file names with timestamps

3. **Error Handling**

   - Provide clear error messages to users
   - Implement retry mechanisms for failed uploads
   - Log all upload attempts for auditing

4. **Performance Optimization**
   - Implement file compression for large files
   - Use CDN for file delivery
   - Implement lazy loading for file lists

### Security Best Practices

1. **Access Control**

   - Implement principle of least privilege
   - Use role-based access controls
   - Regular access review and cleanup

2. **File Security**

   - Scan uploaded files for malware
   - Implement content validation
   - Use secure file storage with encryption

3. **Data Protection**
   - Encrypt sensitive file metadata
   - Implement data retention policies
   - Regular security audits

### User Experience Best Practices

1. **Upload Interface**

   - Clear progress indicators
   - Drag-and-drop support
   - File preview capabilities

2. **Document Management**

   - Easy file organization
   - Search and filter capabilities
   - Bulk operations support

3. **Verification Process**
   - Clear status indicators
   - Progress tracking
   - Feedback mechanisms

## Troubleshooting

### Common Issues

1. **Upload Failures**

   - Check file size limits
   - Verify file type is allowed
   - Ensure user has proper permissions

2. **Service Validation Errors**

   - Verify user type is 'ngo' for multiple services
   - Check service type compatibility
   - Ensure proper field group separation

3. **File Access Issues**
   - Verify storage bucket policies
   - Check user authentication
   - Ensure proper folder permissions

### Debug Queries

```sql
-- Check user file statistics
SELECT get_user_file_stats('user-uuid-here');

-- Check verification status
SELECT id, user_type, verification_status, last_verification_check
FROM profiles
WHERE user_type IN ('professional', 'ngo');

-- Check service validation
SELECT user_id, service_types, verification_status
FROM support_services
WHERE user_id = 'user-uuid-here';

-- Clean up orphaned files
SELECT cleanup_orphaned_files();
```

### Monitoring

1. **File Upload Metrics**

   - Upload success/failure rates
   - File size distributions
   - Storage usage by user

2. **Verification Metrics**

   - Verification completion rates
   - Average verification time
   - Rejection reasons

3. **Performance Metrics**
   - Upload response times
   - File access times
   - Storage utilization

## Implementation Checklist

### Database Setup

- [ ] Run `enhanced_file_upload_system.sql`
- [ ] Verify bucket creation and policies
- [ ] Test RLS policies
- [ ] Verify function creation

### Code Implementation

- [ ] Implement `FileUploadService`
- [ ] Implement `ServiceValidationService`
- [ ] Update UI components
- [ ] Add API endpoints

### Testing

- [ ] Test file upload for all user types
- [ ] Test service validation for NGO users
- [ ] Test file access controls
- [ ] Test verification workflow

### Deployment

- [ ] Deploy database changes
- [ ] Deploy code changes
- [ ] Test in production environment
- [ ] Monitor system performance

## Support and Maintenance

### Regular Maintenance Tasks

1. **File Cleanup**

   - Run orphaned file cleanup monthly
   - Archive old verification documents
   - Monitor storage usage

2. **Security Updates**

   - Review access controls quarterly
   - Update file type whitelists as needed
   - Monitor for security vulnerabilities

3. **Performance Monitoring**
   - Monitor upload success rates
   - Track storage usage growth
   - Optimize file delivery

### Contact Information

For technical support or questions about the file upload system:

- Email: tech-support@sautisalama.org
- Documentation: [Internal Wiki Link]
- Issue Tracking: [GitHub Issues Link]

---

_Last Updated: January 2024_
_Version: 1.0.0_
