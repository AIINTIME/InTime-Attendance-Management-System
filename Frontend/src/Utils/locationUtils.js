import { OFFICE_LOCATION } from "./constants";

/**
 * Wraps navigator.geolocation in a Promise. This is for UX only -- the
 * backend independently validates the office geofence and never trusts
 * a client-reported distance.
 */
export function getCurrentPosition({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("LOCATION_UNAVAILABLE"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error("LOCATION_PERMISSION_DENIED"));
        } else if (error.code === error.TIMEOUT) {
          reject(new Error("LOCATION_TIMEOUT"));
        } else {
          reject(new Error("LOCATION_UNAVAILABLE"));
        }
      },
      { enableHighAccuracy: true, timeout, maximumAge: 0 }
    );
  });
}

const EARTH_RADIUS_METERS = 6371000;
function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export function distanceFromOfficeMeters(latitude, longitude) {
  return haversineDistanceMeters(
    latitude,
    longitude,
    OFFICE_LOCATION.latitude,
    OFFICE_LOCATION.longitude
  );
}

export function isWithinOfficeRadius(latitude, longitude) {
  return distanceFromOfficeMeters(latitude, longitude) <= OFFICE_LOCATION.radiusMeters;
}
