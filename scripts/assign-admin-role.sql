-- Script to assign admin role to a user
-- Replace 'USER_EMAIL_HERE' with the actual email of the user you want to make admin

-- Example usage:
-- UPDATE profiles 
-- SET is_admin = true, admin_verified_at = NOW(), admin_verified_by = (SELECT id FROM profiles WHERE email = 'admin@example.com' LIMIT 1)
-- WHERE email = 'USER_EMAIL_HERE';

-- To assign admin role to a specific user by email:
UPDATE profiles 
SET 
    is_admin = true, 
    admin_verified_at = NOW(),
    admin_verified_by = (SELECT id FROM profiles WHERE email = 'oliverwai9na@gmail.com' LIMIT 1)
WHERE email = 'USER_EMAIL_HERE';

-- To check if the update was successful:
SELECT 
    id, 
    email, 
    full_name, 
    user_type, 
    is_admin, 
    admin_verified_at,
    verification_status
FROM profiles 
WHERE email = 'USER_EMAIL_HERE';

-- To list all current admins:
SELECT 
    id, 
    email, 
    full_name, 
    user_type, 
    is_admin, 
    admin_verified_at
FROM profiles 
WHERE is_admin = true
ORDER BY admin_verified_at DESC;
