export const reverseGeocodeToDistrict = async (lat: number, lng: number): Promise<string | null> => {
    if (typeof window === "undefined") return null;

    const apiKey = process.env.NEXT_PUBLIC_LOCATIONIQ_API_KEY;
    if (!apiKey) {
        console.warn("LocationIQ API key is missing. Skipping reverse geocoding.");
        return null; // Gracefully degrade if API key isn't set yet
    }

    // Attempt to retrieve from localStorage cache
    const cacheKey = `geocode_${lat.toFixed(4)}_${lng.toFixed(4)}`;
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            return cached;
        }
    } catch (e) {
        // Ignored, just proceed to network request
    }

    try {
        const response = await fetch(
            `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${lat}&lon=${lng}&format=json`,
            {
                // Optional: LocationIQ doesn't require specific headers, but polite user agent is good practice
                headers: {
                    "Accept-Language": "en-US,en;q=0.9"
                }
            }
        );

        if (!response.ok) {
            throw new Error(`LocationIQ returned ${response.status}`);
        }

        const data = await response.json();
        
        if (data.address) {
            // Prioritize level 8 and 6 equivalents
            const area = 
                data.address.suburb || 
                data.address.city_district || 
                data.address.district || 
                data.address.neighbourhood || 
                data.address.neighborhood || 
                data.address.city || 
                data.address.town || 
                data.address.village;

            if (area) {
                // Save to cache
                try {
                    localStorage.setItem(cacheKey, area);
                } catch (e) {
                    // Ignore localStorage quotas
                }
                return area;
            }
        }

        return null;
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return null;
    }
};

export const reverseGeocodeAddress = async (lat: number, lng: number): Promise<string | null> => {
    if (typeof window === "undefined") return null;

    const apiKey = process.env.NEXT_PUBLIC_LOCATIONIQ_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await fetch(
            `https://us1.locationiq.com/v1/reverse.php?key=${apiKey}&lat=${lat}&lon=${lng}&format=json`,
            { headers: { "Accept-Language": "en-US,en;q=0.9" } }
        );

        if (!response.ok) return null;

        const data = await response.json();
        return data.display_name || null;
    } catch (error) {
        console.error("Reverse geocoding failed:", error);
        return null;
    }
};

/**
 * Perform a forward geocode to find coordinates from a search string (debounced context)
 */
export const forwardGeocode = async (query: string): Promise<{ lat: number, lon: number, display_name: string }[]> => {
    if (typeof window === "undefined" || !query.trim()) return [];

    const apiKey = process.env.NEXT_PUBLIC_LOCATIONIQ_API_KEY;
    if (!apiKey) {
        return [];
    }

    try {
        const response = await fetch(
            `https://us1.locationiq.com/v1/search.php?key=${apiKey}&q=${encodeURIComponent(query)}&format=json&limit=5`,
            {
                headers: {
                    "Accept-Language": "en-US,en;q=0.9"
                }
            }
        );

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        if (Array.isArray(data)) {
            return data.map((item: any) => ({
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon),
                display_name: item.display_name
            }));
        }
        return [];
    } catch (error) {
        console.error("Forward geocoding failed:", error);
        return [];
    }
};
