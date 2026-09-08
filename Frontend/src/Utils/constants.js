export const API_URL = import.meta.env.VITE_API_URL || "/api";

export const OFFICE_LOCATION = {
  latitude: Number(import.meta.env.VITE_OFFICE_LATITUDE) || 22.512507119278705,
  longitude: Number(import.meta.env.VITE_OFFICE_LONGITUDE) || 88.39119924866769,
  radiusMeters: Number(import.meta.env.VITE_OFFICE_RADIUS_METERS) || 30,
};

export const ATTENDANCE_STATUS = {
  ON_TIME: { label: "On Time", color: "success" },
  SLIGHT_LATE: { label: "Slight Late", color: "warning" },
  VERY_LATE: { label: "Very Late", color: "danger" },
};

export const LOGIN_TYPE = {
  OFFICE: "OFFICE",
  DISTANCE: "DISTANCE",
};

export const GOOGLE_MAPS_QUERY_URL = (latitude, longitude) =>
  `https://www.google.com/maps?q=${latitude},${longitude}`;

// Dev-only convenience for the login screens' "Autofill" button -- never
// rendered in a production build (gated by import.meta.env.DEV at the call
// site). Update these if your local seed credentials differ.
export const DEMO_CREDENTIALS = {
  employee: { email: "employee@intime.local", password: "Employee123!" },
  admin: { email: "admin@intime.local", password: "ChangeMe123!" },
};
