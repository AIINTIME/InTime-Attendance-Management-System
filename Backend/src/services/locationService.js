const env = require("../config/env");
const { haversineDistanceMeters } = require("../utils/geoDistance");
const { ApiError } = require("../middleware/errorMiddleware");

function assertValidCoordinates(latitude, longitude) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    Number.isNaN(latitude) ||
    Number.isNaN(longitude)
  ) {
    throw new ApiError(422, "A valid location is required.", "INVALID_LOCATION");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new ApiError(422, "The reported location is out of range.", "INVALID_LOCATION");
  }
}

/**
 * Backend is authoritative for the office geofence (spec section 25).
 * Returns the computed distance in meters; throws if outside the radius.
 */
function verifyWithinOfficeRadius(latitude, longitude) {
  assertValidCoordinates(latitude, longitude);

  const distanceMeters = haversineDistanceMeters(
    latitude,
    longitude,
    env.OFFICE_LATITUDE,
    env.OFFICE_LONGITUDE
  );

  if (distanceMeters > env.OFFICE_RADIUS_METERS) {
    const err = new ApiError(
      422,
      "You are outside the office attendance area. Please move closer to the office and try again.",
      "OUTSIDE_OFFICE_RADIUS"
    );
    err.distanceMeters = Math.round(distanceMeters);
    throw err;
  }

  return Math.round(distanceMeters);
}

module.exports = { assertValidCoordinates, verifyWithinOfficeRadius };
