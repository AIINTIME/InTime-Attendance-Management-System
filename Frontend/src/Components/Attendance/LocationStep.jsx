import { useEffect, useRef, useState } from "react";
import { MapPin, XCircle } from "lucide-react";
import { getCurrentPosition, distanceFromOfficeMeters } from "../../Utils/locationUtils";
import { OFFICE_LOCATION } from "../../Utils/constants";

const LOCATION_ERROR_MESSAGES = {
  LOCATION_PERMISSION_DENIED:
    "Location permission was denied. Please enable location access for this site and try again.",
  LOCATION_TIMEOUT: "Fetching your location timed out. Please try again.",
  LOCATION_UNAVAILABLE: "We couldn't determine your location. Please try again.",
};

const LOW_ACCURACY_THRESHOLD_METERS = 100;

/**
 * mode: "OFFICE" shows the live distance-from-office readout (UX only --
 * the backend independently re-validates the 30m geofence); "DISTANCE"
 * just confirms a location was captured.
 */
export default function LocationStep({ mode, onLocated, onCancel }) {
  const [status, setStatus] = useState("fetching"); // fetching | low-accuracy | error
  const [errorMessage, setErrorMessage] = useState("");
  const [position, setPosition] = useState(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    fetchLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchLocation() {
    setStatus("fetching");
    setErrorMessage("");
    try {
      const pos = await getCurrentPosition();
      setPosition(pos);

      if (pos.accuracy && pos.accuracy > LOW_ACCURACY_THRESHOLD_METERS) {
        setStatus("low-accuracy");
        return;
      }

      onLocated(pos);
    } catch (err) {
      setStatus("error");
      setErrorMessage(LOCATION_ERROR_MESSAGES[err.message] || "We couldn't determine your location.");
    }
  }

  const distance =
    mode === "OFFICE" && position ? Math.round(distanceFromOfficeMeters(position.latitude, position.longitude)) : null;

  return (
    <div className="flow-step location-step">
      {status === "fetching" && (
        <>
          <div className="radar-wrapper">
            <span className="radar-ring" />
            <span className="radar-ring" style={{ animationDelay: "0.7s" }} />
            <span className="radar-ring" style={{ animationDelay: "1.4s" }} />
            <div className="radar-core">
              <MapPin size={28} />
            </div>
          </div>
          <h3>Fetching your location…</h3>
          <p>
            {mode === "OFFICE"
              ? `Checking you're within the ${OFFICE_LOCATION.radiusMeters}m office zone.`
              : "Capturing your current location for this attendance record."}
          </p>
        </>
      )}

      {status === "low-accuracy" && (
        <>
          <div className="passkey-icon-circle error">
            <MapPin size={32} />
          </div>
          <h3>Location accuracy is low</h3>
          <p>
            Your device reported an approximate accuracy of ~{Math.round(position.accuracy)}m. For a
            reliable result, move to an open area and try again.
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={() => onLocated(position)}>
              Continue Anyway
            </button>
            <button type="button" className="btn btn-primary" onClick={fetchLocation}>
              Retry
            </button>
          </div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="passkey-icon-circle error">
            <XCircle size={32} />
          </div>
          <h3>Location unavailable</h3>
          <p>{errorMessage}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={fetchLocation}>
              Try Again
            </button>
          </div>
        </>
      )}

      {mode === "OFFICE" && distance !== null && status === "fetching" && (
        <div className="flow-hint">Distance from office: {distance}m</div>
      )}
    </div>
  );
}
