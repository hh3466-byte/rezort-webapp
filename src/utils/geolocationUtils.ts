/**
 * Utility functions for Geolocation, Reverse Geocoding (Hebrew),
 * and 1-Click Navigation (Waze & Google Maps)
 */

export interface GeolocationCoordinates {
  lat: number;
  lng: number;
}

export interface GeocodedAddressResult {
  address: string;
  city?: string;
  street?: string;
  houseNumber?: string;
  coordinates: GeolocationCoordinates;
  rawDisplayName?: string;
}

/**
 * Get current browser GPS coordinates with high accuracy
 */
export async function getCurrentCoordinates(): Promise<GeolocationCoordinates> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    throw new Error('דפדפן זה אינו תומך בזיהוי מיקום GPS');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            reject(new Error('הגישה למיקום נדחתה. יש לאשר הרשאת מיקום בהגדרות הדפדפן, או להקליד את הכתובת ידנית.'));
            break;
          case error.POSITION_UNAVAILABLE:
            reject(new Error('לא ניתן לקלוט אות GPS כרגע. אנא הקלד את הכתובת ידנית.'));
            break;
          case error.TIMEOUT:
            reject(new Error('זיהוי המיקום ארך זמן רב מדי. אנא נסה שוב או הקלד ידנית.'));
            break;
          default:
            reject(new Error('שגיאה באיתור המיקום. אנא הקלד את הכתובת ידנית.'));
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 60000,
      }
    );
  });
}

/**
 * Reverse geocode latitude and longitude to a human-readable Hebrew street address
 */
export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<GeocodedAddressResult> {
  // 1. Primary provider: OpenStreetMap Nominatim with Hebrew language
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=he&zoom=18&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};

      const road = addr.road || addr.street || addr.pedestrian || addr.footway || '';
      const houseNumber = addr.house_number || '';
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || '';

      let formatted = '';
      if (road && houseNumber && city) {
        formatted = `${road} ${houseNumber}, ${city}`;
      } else if (road && city) {
        formatted = `${road}, ${city}`;
      } else if (city) {
        formatted = city;
      } else if (data.display_name) {
        formatted = data.display_name.split(',').slice(0, 3).join(',').trim();
      }

      if (formatted) {
        return {
          address: formatted,
          city,
          street: road,
          houseNumber,
          coordinates: { lat, lng },
          rawDisplayName: data.display_name,
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode failed, attempting fallback provider:', err);
  }

  // 2. Secondary fallback provider: BigDataCloud client API
  try {
    const fallbackUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=he`;
    const fRes = await fetch(fallbackUrl);
    if (fRes.ok) {
      const fData = await fRes.json();
      const city = fData.city || fData.locality || '';
      const principalSubdiv = fData.principalSubdivision || '';
      const formatted = [city, principalSubdiv].filter(Boolean).join(', ');

      if (formatted) {
        return {
          address: formatted,
          city,
          coordinates: { lat, lng },
          rawDisplayName: formatted,
        };
      }
    }
  } catch (fErr) {
    console.warn('Secondary reverse geocode failed:', fErr);
  }

  return {
    address: `נ.צ. ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    coordinates: { lat, lng },
  };
}

/**
 * Generate 1-click Waze navigation URL
 */
export function getWazeNavigationUrl(address: string, coords?: { lat: number; lng: number }): string {
  if (coords && coords.lat && coords.lng) {
    return `https://waze.com/ul?ll=${coords.lat},${coords.lng}&navigate=yes`;
  }
  return `https://waze.com/ul?q=${encodeURIComponent(address)}&navigate=yes`;
}

/**
 * Generate 1-click Google Maps navigation URL
 */
export function getGoogleMapsNavigationUrl(address: string, coords?: { lat: number; lng: number }): string {
  if (coords && coords.lat && coords.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}
