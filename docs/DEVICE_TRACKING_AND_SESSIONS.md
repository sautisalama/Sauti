# Device Tracking and Session Management (V2)

This document outlines the enhanced implementation of device tracking and server-side session validation in Sauti Salama. The system has been upgraded from a simple tracking list to a robust session management flow that allows for real-time revocation of access across different devices.

## 1. Core Architecture

### Dedicated Data Storage

Unlike the previous implementation which stored all data in a generic `settings` column, V2 uses dedicated columns in the `profiles` table:

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
	ip?: string; // (Planned) Last active IP
}
```

---

## 2. The Session Lifecycle

### Phase 1: Identification & Multi-Layer Persistence

Device identification relies on a unique UUID (`ss_device_id`) that is persisted in two places:

1. **`localStorage`**: Ensures the ID survives across browser sessions and tab closes.
2. **`HttpOnly` Cookie**: Mirroring the ID into a secure cookie allows Sauti Salama to access the device identity in **Server Components** and **API Routes**.

### Phase 2: Registration & Heartbeat

The registration flow is managed by the client-side `<DeviceRegistration />` component:

- **Registration**: On the first visit of a session, if device tracking is enabled, the device details are merged into the `profiles.devices` column.
- **Heartbeat**: To keep the list current, the `last_active` timestamp is updated periodically if it hasn't been refreshed in the last 5 minutes.

### Phase 3: Server-Side Validation (The "Lock")

This is the most critical security improvement. The `getUser()` utility in `utils/supabase/server.ts` now performs a mandatory session check:

1. It extracts the `ss_device_id` from the secure HttpOnly cookie.
2. It fetches the user's `profiles.devices` list.
3. If `device_tracking_enabled` is **ON**, it verifies that the current `deviceId` exists in the authorized list.
4. **Result**: If the device is not found (meaning it was revoked), `getUser()` returns `null`, denying access to data and forcing a client-side redirect to login.

---

## 3. Revocation & Management

Users manage their security through the **Privacy & Security** dashboard.

- **Revoking a Single Device**: Clicking "Revoke" removes that specific ID from the `devices` table. The next time that device makes a server request, it will be rejected.
- **Logging Out Others**: Filters the `devices` array to only contain the current device ID.
- **Disabling Tracking**: Disabling the feature clears the `devices` array entirely and disables the server-side enforce check.

---

## 4. Investigations & Recommendations

### Current Flow Assessment

| Feature            | Implementation                       | Security Level                         |
| :----------------- | :----------------------------------- | :------------------------------------- |
| **Identification** | Dual Layer (LocalStorage + Cookie)   | High (Prevents tampering, enables SSR) |
| **Validation**     | Server-Side check in `getUser()`     | High (Immediate effect on data access) |
| **UX**             | Relative timestamps & Active markers | Excellent                              |

### Potential Issues & Mitigations

1. **Cookie/Storage Desync**: If a user clears cookies but not localStorage, we might lose the server-side link temporarily.
   - _Mitigation_: The `getOrCreateDeviceId` utility and `DeviceRegistration` component are designed to re-sync the cookie from localStorage automatically on the first client interaction.
2. **Database Load**: Frequent `last_active` updates could strain the DB.
   - _Mitigation_: We only update the timestamp if it's older than 5 minutes.
3. **Public/Shared Devices**: Users might forget to logout or revoke.
   - _Mitigation_: Recommend implementing a "Session Expiry" logic where devices older than 30 days are automatically pruned from the active list.

### Future Roadmap (Recommendations)

1. **Geo-IP Enhancement**: Currently, location is derived from timezone. Integrating an IP-based geo-location service would provide City/Country level accuracy.
2. **Security Notifications**: Trigger an email notification via a Supabase Edge Function whenever a **new** device ID is registered for the first time.
3. **Middleware Enforcement**: Move the session validation check into `middleware.ts` to block requests even earlier in the lifecycle, reducing server load for revoked sessions.
4. **Hardware Fingerprinting**: Consider integrating `FingerprintJS` to make the `device_id` even more stable, preventing it from changing if a user clears their browser data.
