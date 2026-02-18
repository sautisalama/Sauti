# Device Tracking and Session Management (V3)

This document outlines the enhanced implementation of device tracking and server-side session validation in Sauti Salama. The system has been upgraded to V3, which moves enforcement to the **Middleware** layer for immediate protection and implements a "Destructive Sign-Out" flow to prevent the dreaded "loop of death" (infinite redirection).

## 1. Core Architecture

### Dedicated Data Storage

V2 introduced and V3 maintains dedicated columns in the `profiles` table to avoid the complexity of nesting device data within generic settings:

- **`devices` (JSONB)**: Stores an array of active device sessions.
- **`settings` (JSONB)**: Stores general user preferences (including `device_tracking_enabled`).
- **`policies` (JSONB)**: Stores platform policy acceptance status.

### The Tracked Device Schema

```typescript
interface TrackedDevice {
	id: string; // Stable UUID (stored in localStorage & HttpOnly cookie)
	device_name: string; // e.g., "Chrome on Windows"
	browser: string;
	os: string;
	last_active: string; // ISO timestamp
	location?: string; // Timezone-based location hint
}
```

---

## 2. The Session Lifecycle

### Phase 1: Identification & Persistence

Device identification relies on a unique UUID (`ss_device_id`) that is persisted in two places:

1. **`localStorage`**: Serves as the primary stable storage for the ID.
2. **`HttpOnly` Cookie**: Mirroring the ID into a secure cookie allows the **Middleware** and **Server Components** to verify the device identity.

### Phase 2: Registration (The Auth Callback)

Unlike V1/V2 which relied heavily on client-side registration, V3 ensures the device is registered **during the authentication handshake**. In `/api/auth/callback/route.ts`:

- The server exchanges the auth code for a session.
- It immediately reads the `ss_device_id` cookie.
- It registers the device in the `profiles` table _before_ the user ever reaches the dashboard. This ensures the first redirect to `/dashboard` is authorized.

### Phase 3: Middleware Enforcement (The "Gatekeeper")

In V3, `middleware.ts` handles the heavy lifting of security enforcement:

1. **Identify**: It extracts the `ss_device_id` from the request cookies.
2. **Retrieve**: It fetches the user's `profiles.devices` list.
3. **Verify**: If `device_tracking_enabled` is **ON**, it checks if the current `deviceId` exists in the authorized list.
4. **Enforce**: If the device is NOT authorized:
   - It performs a **Destructive Sign-Out** (`supabase.auth.signOut()`) to clear the Supabase session cookies.
   - It redirects the user to `/signin?error=unauthorized_device`.
   - **Crucially**, it syncs the Supabase response cookies into the redirect response. This clears the session on the client immediately, preventing the browser from attempting to access `/dashboard` again with a "half-logged-in" state, thus **avoiding the infinite redirection loop**.

---

## 3. Revocation & Management

- **Real-time Revocation**: When an admin or user removes a device from the `devices` array in the DB, the **Middleware** catches this on the next page load or API request.
- **Logout Others**: The dashboard allows users to "Log out other sessions," which simply filters the `devices` array to only contain the ID of the device currently in use.
- **Heartbeat**: The client-side `<DeviceRegistration />` component continues to provide "Heartbeats," updating the `last_active` timestamp in the database every 5 minutes to keep the device list current without over-straining the database.

---

## 4. Stability & Security Metrics

| Feature             | Implementation                     | Security Level                          |
| :------------------ | :--------------------------------- | :-------------------------------------- |
| **Identification**  | Dual Layer (LocalStorage + Cookie) | High (SSR-ready)                        |
| **Enforcement**     | Middleware (V3)                    | Highest (Checks every request)          |
| **Loop Mitigation** | Destructive Sign-Out + Cookie Sync | Vital (UX stability)                    |
| **Registration**    | Auth Callback (Server-side)        | High (Prevents initial race conditions) |

---

## 5. Potential Issues & Mitigations

1. **Cookie Deletion**: If a user manually deletes the `ss_device_id` cookie but keeps their session, the middleware will treat them as an "Unknown Device."
   - _Mitigation_: The `DeviceRegistration` component on the client-side will promptly re-sync the cookie from `localStorage` upon its first render.
2. **Race Conditions**: A user logging in for the first time might hit the dashboard before registration finishes.
   - _Mitigation_: By performing registration in the `auth/callback` route, we ensure the DB is updated _before_ the browser is redirected to the dashboard.
3. **Database Load**: Middleware runs on every request within protected routes.
   - _Mitigation_: The Supabase client in Middleware uses the same session context, and lookups are performed via indexed UUIDs. For extremely high-traffic apps, session caching in Redis could be considered.

---

## 6. Future Roadmap

1. **Hardware Fingerprinting**: Integrating `FingerprintJS` to make the `device_id` even more resistant to browser clearing.
2. **Geo-IP Enhancement**: Converting timezone-based location hints into precise City/Country data using a Geo-IP provider.
3. **Security Webhooks**: Sending real-time emails/SMS when a "New Device" login is detected.
