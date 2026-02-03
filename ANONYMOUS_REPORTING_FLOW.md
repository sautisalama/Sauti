# Anonymous Reporting Flow - Documentation

This document explains the "Anonymous with Persistence" system implemented for Sauti Salama. This flow allows survivors to report incidents instantly while ensuring they can return to their data securely without providing personal information upfront.

## 1. Initial Reporting & Account Creation

When a survivor clicks **"Get Support Now"** or starts the report flow anonymously:

1. **Form Completion**: The user fills out the incident details (location, type of abuse, description, etc.).
2. **Password Choice**: At the end of the form, the user is prompted to create their own password.
   - _Note: This password is required for them to log back in later._
3. **Credential Generation**: Upon submission, the backend automatically:
   - Generates a human-readable username (e.g., `brave-heart-7k3x`).
   - Creates a virtual email: `brave-heart-7k3x@anon.sautisalama.org`.
4. **Supabase Auth**: A new user is created in Supabase Auth using this virtual email and the user's password.
5. **Profile Linking**: A profile is created in the `profiles` table with:
   - `is_anonymous: true`
   - `anon_username: 'brave-heart-7k3x'`
   - `user_type: 'survivor'`

## 2. Immediate Post-Submission

After the account is created:

1. **Auto-Login**: The user is automatically signed in using their new credentials.
2. **Dashboard Redirect**: The user is redirected to the dashboard.
3. **Credentials Banner**: A prominent banner appears on the survivor's dashboard:
   - Shows their generated **Username**.
   - Reminds them of the **Password** they created.
   - Provides a **Copy** button for easy saving.

## 3. Service Matching

The report is processed immediately:

- The `matchReportWithServices` logic triggers instantly.
- Matched support organizations appear on the survivor's dashboard right away.
- Survivors can start chatting with professionals immediately through their anonymous identity.

## 4. Upgrading to Permanent Account

If a survivor decides they want to link a real email address (for password recovery, notifications, etc.):

1. **Upgrade Trigger**: User clicks "Create Permanent Account" in the dashboard banner or profile settings.
2. **Email Entry**: User enters a valid, personal email address.
3. **Email Update**: The system updates the Supabase Auth user's email.
4. **Verification**: A standard verification email is sent to the new address.
5. **Data Preservation**: All existing reports, chats, and matches are preserved because the `user_id` remains the same. The `is_anonymous` flag is eventually set to `false`.

## 5. Anonymous Mode Toggle (Existing Users)

For users who already have permanent accounts but want to report or chat anonymously:

- **Toggle**: Found in **Settings > Preferences**.
- **Behavior**: When enabled, it activates a separate "Anonymous Mode" hook that masks their identity in chat interfaces, utilizing a session-based anonymous ID.

---

## Technical Summary

| Component         | Logic                                                              |
| :---------------- | :----------------------------------------------------------------- |
| **Auth**          | standard Supabase Auth (Virtual Email + User Password)             |
| **Storage**       | Consolidated in `profiles` table (`anon_username`, `is_anonymous`) |
| **Virtual Email** | `{username}@anon.sautisalama.org` (Exempt from actual mailing)     |
| **Persistence**   | Permanent via `auth.users` and `profiles`                          |
| **Security**      | RLS policies ensure users only see their own anonymous data        |
