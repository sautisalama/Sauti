# Google Maps API Setup

To enable location services in the Sauti application, you need to configure the Google Maps API.

## 1. Get an API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Library**.
4. Search for and enable the following APIs:
   - **Maps JavaScript API**: Renders the interactive map.
   - **Places API**: Enables the search autocomplete feature.
   - **Geocoding API**: (Optional but recommended) Allows converting coordinates to addresses.
5. Navigate to **APIs & Services > Credentials**.
6. Click **Create Credentials** and select **API Key**.
7. Copy the generated API Key.

## 2. Configure Environment Variables

1. Open your `.env.local` file in the root directory.
2. Add the following variable:

   ```bash
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

## 3. Restrict Your API Key (Recommended)

1. In the Google Cloud Console, go to the credentials page and edit your API Key.
2. Under **Application restrictions**, select **HTTP referrers (web sites)**.
3. Add your domains (e.g., `localhost:3000`, `your-production-domain.com`).
4. Under **API restrictions**, select **Restrict key** and choose the APIs you enabled (Maps JS, Places, Geocoding).
5. Save changes.

> **Note**: Changes to API key restrictions may take up to 5 minutes to propagate.
