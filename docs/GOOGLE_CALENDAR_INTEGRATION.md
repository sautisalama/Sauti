# Google Calendar Integration Setup

This guide covers how to set up Google Calendar integration for **Sauti Salama**. Once configured, professionals and users can connect their Google Calendar to sync appointments automatically.

---

## 1. Create a Google Cloud Project

1. Visit the [Google Cloud Console](https://console.cloud.google.com/).
2. Click **Select a project** → **New Project**.
3. Name it (e.g., `Sauti Salama Calendar`) and click **Create**.
4. Select your new project from the project picker.

## 2. Enable the Google Calendar API

1. Navigate to **APIs & Services** → **Library**.
2. Search for **Google Calendar API**.
3. Click on it and press **Enable**.

## 3. Configure the OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**.
2. Select **External** user type → **Create**.
3. Fill in the required fields:
   - **App name**: Sauti Salama
   - **User support email**: your email
   - **Developer contact**: your email
4. Click **Save and Continue**.
5. Under **Scopes**, click **Add or Remove Scopes** and add:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
6. Click **Save and Continue** through the remaining steps.

> **Note**: While in "Testing" mode, only test users you add can use the OAuth flow. Add your email under **Test users**. For production, submit the app for Google verification.

## 4. Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**.
2. Click **Create Credentials** → **OAuth client ID**.
3. Application type: **Web application**.
4. Name: `Sauti Calendar Integration`.
5. Add **Authorized redirect URIs**:
   - Development: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
6. Click **Create** and note down the **Client ID** and **Client Secret**.

## 5. Set Environment Variables

Add the following to your `.env.local` file:

```env
# Google Calendar Integration
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALENDAR_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

For production (`.env.prod`):

```env
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_CALENDAR_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
```

## 6. Database Setup (Optional)

The integration stores tokens in the `profiles` table. If you need to add the column:

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS google_calendar_tokens JSONB DEFAULT NULL;
```

The `calendar_sync_enabled` column should already exist. If not:

```sql
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT FALSE;
```

---

## Architecture

### OAuth Flow

```
User clicks "Connect Google Calendar"
    → GET /api/auth/google (generates OAuth URL with state)
    → Redirects to Google consent screen
    → User grants access
    → Google redirects to /api/auth/google/callback
    → Callback exchanges code for tokens
    → Tokens stored in profiles.google_calendar_tokens
    → User redirected to /dashboard/profile?section=calendar
```

### API Routes

| Route                        | Method | Description                                |
| ---------------------------- | ------ | ------------------------------------------ |
| `/api/auth/google`           | GET    | Initiates OAuth, redirects to Google       |
| `/api/auth/google/callback`  | GET    | Handles OAuth callback, stores tokens      |
| `/api/calendar/sync`         | POST   | Syncs appointments to/from Google Calendar |
| `/api/calendar/create-event` | POST   | Creates a single calendar event            |

### Key Files

| File                                                      | Purpose                                                    |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `lib/google-calendar-oauth.ts`                            | OAuth2 client, token management, Calendar API helpers      |
| `lib/google-calendar.ts`                                  | ICS file generation, calendar URL generation (client-safe) |
| `hooks/useCalendarStatus.ts`                              | React hook for calendar connection state                   |
| `app/dashboard/profile/calendar-integration-settings.tsx` | Settings UI component                                      |
| `app/dashboard/_components/CalendarConnection.tsx`        | Legacy calendar card component                             |
| `app/dashboard/_components/CalendarConnectionStatus.tsx`  | Legacy status display component                            |

### Token Storage

Tokens are stored as JSONB in `profiles.google_calendar_tokens`:

```json
{
	"access_token": "ya29.xxx",
	"refresh_token": "1//xxx",
	"expiry_date": 1700000000000,
	"token_type": "Bearer",
	"scope": "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly"
}
```

> **Security Note**: In a production environment, tokens should be encrypted before storage. Consider using a secrets manager or server-side encryption.

---

## Troubleshooting

| Issue                               | Solution                                                                                 |
| ----------------------------------- | ---------------------------------------------------------------------------------------- |
| "Google Calendar is not configured" | Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set in `.env.local`             |
| "redirect_uri_mismatch"             | Ensure `GOOGLE_CALENDAR_REDIRECT_URI` matches the URI configured in Google Cloud Console |
| OAuth flow fails silently           | Check the browser console and server logs for errors                                     |
| Tokens not saving                   | Ensure the `google_calendar_tokens` column exists in the `profiles` table                |
| "Access denied" error               | Add your email as a test user in Google Cloud Console OAuth consent screen               |
