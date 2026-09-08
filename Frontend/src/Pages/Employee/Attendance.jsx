import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import {
  getTodayAttendance,
  registerOfficeAttendance,
  registerDistanceAttendance,
  checkOutAttendance,
} from "../../Services/attendanceService";
import {
  registerPasskey,
  verifyPasskey,
  guessDeviceNickname,
} from "../../Services/passkeyService";
import { getCurrentPosition } from "../../Utils/locationUtils";
import { extractErrorMessage } from "../../Utils/validation";
import { formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { OFFICE_LOCATION, GOOGLE_MAPS_QUERY_URL } from "../../Utils/constants";
import CheckOutFlowModal from "../../Components/Attendance/CheckOutFlowModal";
import EarlyCheckOutWarningModal from "../../Components/Attendance/EarlyCheckOutWarningModal";
import "../../Styles/TakeAttendance.css";

/* Cache for reverse-geocoded place names */
const geocodeCache = new Map();

async function fetchReverseGeocode(lat, lng) {
  if (!lat || !lng) return null;
  const key = `${Number(lat).toFixed(4)},${Number(lng).toFixed(4)}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};
    const specific = addr.suburb || addr.neighbourhood || addr.road || addr.quarter || addr.commercial || addr.industrial;
    const city = addr.city || addr.town || addr.municipality || addr.state_district;
    let formatted = "";
    if (specific && city) {
      formatted = `${specific}, ${city}`;
    } else if (data.display_name) {
      formatted = data.display_name.split(",").slice(0, 2).join(",").trim();
    } else {
      formatted = city || "Location Detected";
    }
    geocodeCache.set(key, formatted);
    return formatted;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Real Google Map Embed with One-Click Open in Google Maps
───────────────────────────────────────────────────────────── */
function RealMapEmbed({ isCheckOut, lat, lng, address, accuracy }) {
  const validLat = lat != null && !isNaN(Number(lat)) ? Number(lat) : OFFICE_LOCATION.latitude;
  const validLng = lng != null && !isNaN(Number(lng)) ? Number(lng) : OFFICE_LOCATION.longitude;
  const googleMapsUrl = GOOGLE_MAPS_QUERY_URL(validLat, validLng);
  // Real Google Maps embed URL
  const embedUrl = `https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1s${validLat},${validLng}!6i15!3m1!1sen!5m1!1sen`;

  return (
    <a
      href={googleMapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`att-real-map-wrap ${isCheckOut ? "checkout" : "checkin"}`}
      title={`Click to open ${address || "location"} in Google Maps${accuracy ? ` (Accuracy: ±${accuracy}m)` : ""}`}
    >
      <iframe
        src={embedUrl}
        title={`Google Maps - ${address || "Attendance Location"}`}
        className="att-real-map-iframe"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="att-real-map-overlay">
        <span className="att-real-map-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="11" height="11">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          <span>Open in Maps</span>
        </span>
      </div>
    </a>
  );
}

/* ─────────────────────────────────────────────────────────────
   Empty State Graphic (Pastel Clipboard with Magnifying Glass)
───────────────────────────────────────────────────────────── */
function EmptyLoginGraphic() {
  return (
    <div className="att-empty-status-graphic">
      <svg viewBox="0 0 160 160" width="135" height="135" fill="none">
        {/* Soft Background Circle */}
        <circle cx="80" cy="80" r="70" fill="#f0f7ff" />

        {/* Clipboard back */}
        <rect x="42" y="32" width="62" height="84" rx="8" fill="#ffffff" stroke="#cbd5e1" strokeWidth="2.5" />
        {/* Clipboard Top Clip */}
        <rect x="58" y="24" width="30" height="12" rx="4" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
        <circle cx="73" cy="27" r="2" fill="#64748b" />

        {/* Document lines and checklist bullets */}
        <circle cx="53" cy="50" r="3.5" fill="#94a3b8" />
        <rect x="62" y="47" width="32" height="6" rx="3" fill="#cbd5e1" />

        <circle cx="53" cy="67" r="3.5" fill="#94a3b8" />
        <rect x="62" y="64" width="34" height="6" rx="3" fill="#cbd5e1" />

        <circle cx="53" cy="84" r="3.5" fill="#94a3b8" />
        <rect x="62" y="81" width="28" height="6" rx="3" fill="#cbd5e1" />

        {/* Sparkles */}
        <path d="M124,42 L127,33 L136,36 L127,39 Z" fill="#60a5fa" />
        <path d="M136,54 L138,48 L144,50 L138,52 Z" fill="#93c5fd" />

        {/* Magnifying Glass */}
        <g transform="translate(74, 60)">
          {/* Glass lens outer */}
          <circle cx="28" cy="28" r="20" fill="rgba(239, 246, 255, 0.85)" stroke="#0074F1" strokeWidth="5.5" />
          {/* Lens reflection shine */}
          <path d="M18,20 A13,13 0 0,1 30,15" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />
          {/* Handle */}
          <line x1="43" y1="43" x2="62" y2="62" stroke="#0056b3" strokeWidth="7" strokeLinecap="round" />
          <line x1="43" y1="43" x2="62" y2="62" stroke="#0074F1" strokeWidth="5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Analog Clock Graphic (Transparent SVG on Blue Card)
───────────────────────────────────────────────────────────── */
function AnalogClockGraphic({ time }) {
  const h = time.getHours() % 12;
  const m = time.getMinutes();
  const s = time.getSeconds();

  const hourDeg = (h / 12) * 360 + (m / 60) * 30;
  const minuteDeg = (m / 60) * 360 + (s / 60) * 6;
  const secondDeg = (s / 60) * 360;

  const cx = 70;
  const cy = 70;
  const r = 62;

  const ticks = Array.from({ length: 12 }, (_, i) => {
    const angle = (i / 12) * 2 * Math.PI - Math.PI / 2;
    const isQuarter = i % 3 === 0;
    const inner = isQuarter ? 48 : 53;
    const outer = 60;
    return {
      x1: cx + inner * Math.cos(angle),
      y1: cy + inner * Math.sin(angle),
      x2: cx + outer * Math.cos(angle),
      y2: cy + outer * Math.sin(angle),
      major: isQuarter,
    };
  });

  return (
    <svg className="att-clock-graphic" viewBox="0 0 140 140" fill="none">
      {/* Outer Dial Circle */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        stroke="rgba(255, 255, 255, 0.75)"
        strokeWidth="3"
        fill="rgba(255, 255, 255, 0.12)"
      />

      {/* Subtle Inner Guideline */}
      <circle
        cx={cx}
        cy={cy}
        r={r - 16}
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* Tick Marks */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke={t.major ? "#ffffff" : "rgba(255, 255, 255, 0.75)"}
          strokeWidth={t.major ? 2.5 : 1.5}
          strokeLinecap="round"
        />
      ))}

      {/* Hour Hand */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + 32 * Math.sin((hourDeg * Math.PI) / 180)}
        y2={cy - 32 * Math.cos((hourDeg * Math.PI) / 180)}
        stroke="#ffffff"
        strokeWidth="3.8"
        strokeLinecap="round"
      />

      {/* Minute Hand */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + 44 * Math.sin((minuteDeg * Math.PI) / 180)}
        y2={cy - 44 * Math.cos((minuteDeg * Math.PI) / 180)}
        stroke="rgba(255, 255, 255, 0.95)"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Second Hand */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + 49 * Math.sin((secondDeg * Math.PI) / 180)}
        y2={cy - 49 * Math.cos((secondDeg * Math.PI) / 180)}
        stroke="#7dd3fc"
        strokeWidth="1.8"
        strokeLinecap="round"
      />

      {/* Center Pivot */}
      <circle cx={cx} cy={cy} r="4.5" fill="#ffffff" />
      <circle cx={cx} cy={cy} r="2" fill="#0284c7" />
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main Take Attendance Page
───────────────────────────────────────────────────────────── */
export default function Attendance() {
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayAttendance, setTodayAttendance] = useState(undefined); // undefined = loading
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [showEarlyWarning, setShowEarlyWarning] = useState(false);
  const [pendingCheckOutMode, setPendingCheckOutMode] = useState(null);

  /* IN-CARD ATTENDANCE FLOW STATE */
  const [activeFlowCard, setActiveFlowCard] = useState(null); // null | "OFFICE" | "DISTANCE"
  const [flowAction, setFlowAction] = useState("CHECKIN"); // "CHECKIN" | "CHECKOUT"
  const [cardStep, setCardStep] = useState(null); // "reason" | "passkey-register" | "passkey-registering" | "passkey" | "location" | "submitting" | "success" | "error"
  const [cardError, setCardError] = useState("");
  const [distanceReason, setDistanceReason] = useState("");

  /* Address state resolved from real coordinates */
  const [checkInAddress, setCheckInAddress] = useState("");
  const [checkOutAddress, setCheckOutAddress] = useState("");

  /* 1-second interval for real-time digital and analog clock */
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  /* Fetch Today's Attendance record */
  const refreshToday = useCallback(async () => {
    try {
      const attendance = await getTodayAttendance();
      setTodayAttendance(attendance || null);
    } catch {
      setTodayAttendance(null);
    }
  }, []);

  useEffect(() => {
    refreshToday();
  }, [refreshToday]);

  /* Resolve Real Location Addresses via Reverse Geocoding */
  useEffect(() => {
    let isMounted = true;
    const resolveAddresses = async () => {
      const inLat = todayAttendance?.latitude;
      const inLng = todayAttendance?.longitude;
      if (inLat && inLng) {
        const addr = await fetchReverseGeocode(inLat, inLng);
        if (isMounted && addr) setCheckInAddress(addr);
      }
      const outLat = todayAttendance?.checkOutLatitude;
      const outLng = todayAttendance?.checkOutLongitude;
      if (outLat && outLng) {
        const addr = await fetchReverseGeocode(outLat, outLng);
        if (isMounted && addr) setCheckOutAddress(addr);
      }
    };
    resolveAddresses();
    return () => {
      isMounted = false;
    };
  }, [
    todayAttendance?.latitude,
    todayAttendance?.longitude,
    todayAttendance?.checkOutLatitude,
    todayAttendance?.checkOutLongitude,
  ]);

  /* Format digital time (HH:MM:SS AM/PM) */
  const hours = String(currentTime.getHours() % 12 || 12).padStart(2, "0");
  const minutes = String(currentTime.getMinutes()).padStart(2, "0");
  const seconds = String(currentTime.getSeconds()).padStart(2, "0");
  const ampm = currentTime.getHours() >= 12 ? "PM" : "AM";
  const digitalTimeStr = `${hours}:${minutes}:${seconds} ${ampm}`;

  /* Format date: e.g. "Monday, Sep 07, 2026" */
  const formattedDateStr = currentTime.toLocaleDateString("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const isCheckedIn = !!todayAttendance?.checkInTime;
  const isCheckedOut = !!todayAttendance?.checkOutTime;
  const checkedInMode = todayAttendance?.loginType; // "OFFICE" or "DISTANCE"
  const isOfficeCheckIn = isCheckedIn && (checkedInMode === "OFFICE" || !checkedInMode);
  const isDistanceCheckIn = isCheckedIn && checkedInMode === "DISTANCE";

  const inAccuracyMeters = todayAttendance?.locationAccuracy != null
    ? Math.round(todayAttendance.locationAccuracy)
    : (todayAttendance?.latitude ? 12 : null);

  const outAccuracyMeters = todayAttendance?.checkOutLocationAccuracy != null
    ? Math.round(todayAttendance.checkOutLocationAccuracy)
    : (todayAttendance?.locationAccuracy != null ? Math.round(todayAttendance.locationAccuracy) : (todayAttendance?.checkOutLatitude ? 12 : null));

  /* Calculate Live Working Time (with seconds) */
  let workingTimeDisplay = "0h 00m 00s";
  if (todayAttendance?.checkInTime) {
    let totalSecs = 0;
    if (todayAttendance.checkOutTime) {
      const checkInDate = new Date(todayAttendance.checkInTime);
      const checkOutDate = new Date(todayAttendance.checkOutTime);
      const diffMs = Math.max(0, checkOutDate.getTime() - checkInDate.getTime());
      totalSecs = Math.floor(diffMs / 1000);
    } else {
      const checkInDate = new Date(todayAttendance.checkInTime);
      const diffMs = Math.max(0, currentTime.getTime() - checkInDate.getTime());
      totalSecs = Math.floor(diffMs / 1000);
    }
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    workingTimeDisplay = `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }

  /* ══════════════════════════ IN-CARD FLOW HANDLERS ══════════════════════════ */

  // Cancel in-card flow and reset to normal card
  const handleCancelFlow = () => {
    setActiveFlowCard(null);
    setCardStep(null);
    setCardError("");
    setDistanceReason("");
    setFlowAction("CHECKIN");
  };

  // Start Office Login
  const handleStartOffice = () => {
    if (isCheckedIn) {
      toast.info("Attendance already registered for today.");
      return;
    }
    setActiveFlowCard("OFFICE");
    setFlowAction("CHECKIN");
    setCardError("");
    if (!user?.passkeyRegistered) {
      setCardStep("passkey-register");
    } else {
      executePasskey("OFFICE", "");
    }
  };

  // Start Remote Login
  const handleStartDistance = () => {
    if (isCheckedIn) {
      toast.info("Attendance already registered for today.");
      return;
    }
    setActiveFlowCard("DISTANCE");
    setFlowAction("CHECKIN");
    setCardError("");
    setDistanceReason("");
    setCardStep("reason");
  };

  // Distance: Reason submitted
  const handleReasonSubmit = (e) => {
    e.preventDefault();
    const trimmed = distanceReason.trim();
    if (!trimmed) return;
    if (!user?.passkeyRegistered) {
      setCardStep("passkey-register");
    } else {
      executePasskey("DISTANCE", trimmed);
    }
  };

  // Passkey Registration
  const handleRegisterBiometric = async () => {
    setCardStep("passkey-registering");
    setCardError("");
    try {
      await registerPasskey(guessDeviceNickname());
      updateUser({ passkeyRegistered: true });
      toast.success("Biometric passkey registered!");
      executePasskey(activeFlowCard, distanceReason);
    } catch (err) {
      setCardError(extractErrorMessage(err, "Passkey registration failed."));
      setCardStep("error");
    }
  };

  // Biometric Assertion for Check-In
  const executePasskey = async (mode, reasonText) => {
    setCardStep("passkey");
    setCardError("");
    try {
      const ticket = await verifyPasskey();
      executeLocation(mode, ticket, reasonText);
    } catch (err) {
      setCardError(err.message || "Biometric verification failed. Please try again.");
      setCardStep("error");
    }
  };

  // Geo Location
  const executeLocation = async (mode, ticket, reasonText) => {
    setCardStep("location");
    setCardError("");
    try {
      const pos = await getCurrentPosition();
      executeSubmission(mode, ticket, pos, reasonText);
    } catch (err) {
      const msg =
        err.message === "LOCATION_PERMISSION_DENIED"
          ? "Location permission was denied. Please allow location access."
          : "Could not determine your location. Please try again.";
      setCardError(msg);
      setCardStep("error");
    }
  };

  // Submit Check-In Attendance
  const executeSubmission = async (mode, ticket, pos, reasonText) => {
    setCardStep("submitting");
    setCardError("");
    try {
      const result =
        mode === "OFFICE"
          ? await registerOfficeAttendance({ ...pos, passkeyTicket: ticket })
          : await registerDistanceAttendance({ ...pos, reason: reasonText, passkeyTicket: ticket });

      setTodayAttendance(result);
      setCardStep("success");
      toast.success("Attendance marked successfully!");
      setTimeout(() => {
        setActiveFlowCard(null);
        setCardStep(null);
        setFlowAction("CHECKIN");
      }, 2600);
    } catch (err) {
      setCardError(extractErrorMessage(err, "We couldn't register your attendance."));
      setCardStep("error");
    }
  };

  // 8-hour shift target (28,800,000 ms)
  const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

  // In-Card Check Out Handlers
  const handleStartCheckOut = (mode) => {
    if (!todayAttendance || todayAttendance.checkOutTime) return;

    // Check if worked time is less than 8 hours
    if (todayAttendance.checkInTime) {
      const checkInDate = new Date(todayAttendance.checkInTime);
      const workedMs = currentTime.getTime() - checkInDate.getTime();
      if (workedMs < EIGHT_HOURS_MS) {
        setPendingCheckOutMode(mode);
        setShowEarlyWarning(true);
        return;
      }
    }

    proceedCheckOut(mode);
  };

  const proceedCheckOut = (mode) => {
    setActiveFlowCard(mode);
    setFlowAction("CHECKOUT");
    setCardError("");
    executeCheckOutPasskey();
  };

  const handleConfirmEarlyCheckOut = () => {
    setShowEarlyWarning(false);
    const mode = pendingCheckOutMode || todayAttendance?.loginType || "OFFICE";
    setPendingCheckOutMode(null);
    if (mode === "MODAL") {
      setShowCheckOut(true);
    } else {
      proceedCheckOut(mode);
    }
  };

  const executeCheckOutPasskey = async () => {
    setCardStep("passkey");
    setCardError("");
    try {
      const ticket = await verifyPasskey();
      executeCheckOutLocation(ticket);
    } catch (err) {
      setCardError(err.message || "Biometric verification failed. Please try again.");
      setCardStep("error");
    }
  };

  const executeCheckOutLocation = async (ticket) => {
    setCardStep("location");
    setCardError("");
    try {
      const pos = await getCurrentPosition();
      executeCheckOutSubmission(ticket, pos);
    } catch (err) {
      const msg =
        err.message === "LOCATION_PERMISSION_DENIED"
          ? "Location permission was denied. Please allow location access to check out."
          : "Could not determine your location for check-out. Please try again.";
      setCardError(msg);
      setCardStep("error");
    }
  };

  const executeCheckOutSubmission = async (ticket, pos) => {
    setCardStep("submitting");
    try {
      const result = await checkOutAttendance({
        passkeyTicket: ticket,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });
      setTodayAttendance(result);
      setCardStep("success");
      toast.success("Checked out successfully!");
      setTimeout(() => {
        setActiveFlowCard(null);
        setCardStep(null);
        setFlowAction("CHECKIN");
      }, 3000);
    } catch (err) {
      setCardError(extractErrorMessage(err, "We couldn't check you out. Please try again."));
      setCardStep("error");
    }
  };

  // Retry failed step
  const handleRetry = () => {
    setCardError("");
    if (flowAction === "CHECKOUT") {
      executeCheckOutPasskey();
      return;
    }
    if (activeFlowCard === "OFFICE") {
      handleStartOffice();
    } else if (activeFlowCard === "DISTANCE") {
      if (distanceReason.trim()) {
        if (!user?.passkeyRegistered) {
          setCardStep("passkey-register");
        } else {
          executePasskey("DISTANCE", distanceReason.trim());
        }
      } else {
        handleStartDistance();
      }
    }
  };

  // Check out handler
  const handleCheckOut = () => {
    if (!todayAttendance || todayAttendance.checkOutTime) return;
    if (todayAttendance.checkInTime) {
      const checkInDate = new Date(todayAttendance.checkInTime);
      const workedMs = currentTime.getTime() - checkInDate.getTime();
      if (workedMs < EIGHT_HOURS_MS) {
        setPendingCheckOutMode("MODAL");
        setShowEarlyWarning(true);
        return;
      }
    }
    setShowCheckOut(true);
  };

  const handleCheckOutSuccess = (attendance) => {
    setShowCheckOut(false);
    setTodayAttendance(attendance);
    toast.success("Checked out successfully!");
  };

  /* ─────────────────────────────────────────────────────────────
     Render In-Card Flow Content
  ───────────────────────────────────────────────────────────── */
  const renderCardFlowContent = (mode) => {
    const isGreen = mode === "DISTANCE";

    // 1. Distance Reason Input
    if (cardStep === "reason") {
      return (
        <div className="in-card-flow-body">
          <div className="in-card-icon-wrap green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="30" height="30">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3 className="in-card-flow-title">Remote Work Reason</h3>
          <p className="in-card-flow-desc">Please explain why you are marking attendance remotely today.</p>

          <form onSubmit={handleReasonSubmit} style={{ width: "100%" }}>
            <textarea
              className="in-card-textarea"
              placeholder="e.g. Working from home today, client visit, personal work..."
              maxLength={300}
              value={distanceReason}
              onChange={(e) => setDistanceReason(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="in-card-char-count">{distanceReason.length} / 300</div>

            <div className="in-card-actions">
              <button type="button" className="in-card-btn ghost" onClick={handleCancelFlow}>
                Cancel
              </button>
              <button
                type="submit"
                className="in-card-btn primary green"
                disabled={!distanceReason.trim()}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      );
    }

    // 2. Passkey Registration
    if (cardStep === "passkey-register" || cardStep === "passkey-registering") {
      return (
        <div className="in-card-flow-body">
          <div className={`in-card-icon-wrap ${isGreen ? "green" : ""} ${cardStep === "passkey-registering" ? "pulsing" : ""}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="32" height="32">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <h3 className="in-card-flow-title">Register Biometric</h3>
          <p className="in-card-flow-desc">
            Use your fingerprint, Face ID, or device PIN to securely authenticate attendance on this device.
          </p>

          <div className={`in-card-status-pill ${isGreen ? "green" : ""}`}>
            {cardStep === "passkey-registering" && <span className="in-card-spinner-sm" />}
            <span>{cardStep === "passkey-registering" ? "Waiting for device…" : "One-time setup"}</span>
          </div>

          <div className="in-card-actions" style={{ marginTop: "24px" }}>
            <button
              type="button"
              className="in-card-btn ghost"
              onClick={handleCancelFlow}
              disabled={cardStep === "passkey-registering"}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`in-card-btn primary ${isGreen ? "green" : ""}`}
              onClick={handleRegisterBiometric}
              disabled={cardStep === "passkey-registering"}
            >
              {cardStep === "passkey-registering" ? "Registering…" : "Register Passkey"}
            </button>
          </div>
        </div>
      );
    }

    // 3. Biometric Verification Step
    if (cardStep === "passkey") {
      return (
        <div className="in-card-flow-body">
          <div className={`in-card-icon-wrap ${flowAction === "CHECKOUT" ? "error" : isGreen ? "green" : ""} pulsing`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="34" height="34">
              <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
              <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
              <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
              <path d="M2 12a10 10 0 0 1 18-6" />
              <path d="M2 16h.01" />
              <path d="M21.8 16c.2-2 .131-5.354 0-6" />
              <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
              <path d="M8.65 22c.21-.66.45-1.32.57-2" />
              <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
            </svg>
          </div>
          <h3 className="in-card-flow-title">
            {flowAction === "CHECKOUT" ? "Biometric Check-Out" : "Biometric Verification"}
          </h3>
          <p className="in-card-flow-desc">
            {flowAction === "CHECKOUT"
              ? "Verify your fingerprint or Face ID to confirm check-out."
              : "Use your fingerprint, Face ID, or screen lock to verify your identity."}
          </p>

          <div className={`in-card-status-pill ${isGreen ? "green" : ""}`}>
            <span className="in-card-spinner-sm" />
            <span>Waiting for your device…</span>
          </div>

          <div className="in-card-actions" style={{ marginTop: "24px" }}>
            <button type="button" className="in-card-btn ghost" onClick={handleCancelFlow}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // 4. Geo Location Verification Step
    if (cardStep === "location") {
      return (
        <div className="in-card-flow-body">
          <div className={`in-card-icon-wrap ${isGreen ? "green" : ""} pulsing`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="34" height="34">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h3 className="in-card-flow-title">Verifying Geo Location</h3>
          <p className="in-card-flow-desc">
            {flowAction === "CHECKOUT"
              ? mode === "OFFICE"
                ? "Confirming your current coordinates within the office radius for check-out..."
                : "Verifying your check-out location is within 50m of your check-in location..."
              : mode === "OFFICE"
              ? "Confirming your current coordinates within the office radius..."
              : "Detecting and recording your remote location coordinates..."}
          </p>

          <div className={`in-card-status-pill ${isGreen ? "green" : ""}`}>
            <span className="in-card-spinner-sm" />
            <span>Locating position…</span>
          </div>

          <div className="in-card-actions" style={{ marginTop: "24px" }}>
            <button type="button" className="in-card-btn ghost" onClick={handleCancelFlow}>
              Cancel
            </button>
          </div>
        </div>
      );
    }

    // 5. Submitting Step
    if (cardStep === "submitting") {
      return (
        <div className="in-card-flow-body">
          <div className={`in-card-icon-wrap ${flowAction === "CHECKOUT" ? "error" : isGreen ? "green" : ""} pulsing`}>
            <span className="in-card-spinner-sm" style={{ width: "28px", height: "28px", borderWidth: "3px" }} />
          </div>
          <h3 className="in-card-flow-title">
            {flowAction === "CHECKOUT" ? "Recording Check-Out" : "Registering Attendance"}
          </h3>
          <p className="in-card-flow-desc">
            {flowAction === "CHECKOUT"
              ? "Finalizing shift hours and recording check-out..."
              : "Connecting to server and marking your check-in record..."}
          </p>

          <div className={`in-card-status-pill ${isGreen ? "green" : ""}`}>
            <span>Please wait…</span>
          </div>
        </div>
      );
    }

    // 6. Success Step
    if (cardStep === "success") {
      return (
        <div className="in-card-flow-body">
          <div className="in-card-icon-wrap green">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="34" height="34">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="in-card-flow-title">
            {flowAction === "CHECKOUT" ? "Checked Out Successfully!" : "Attendance Marked!"}
          </h3>
          <p className="in-card-flow-desc">
            {flowAction === "CHECKOUT"
              ? `Shift complete. Total working time: ${formatMinutesAsHours(
                  todayAttendance?.totalWorkingMinutes || 0
                )}`
              : "Your attendance has been recorded successfully."}
          </p>

          <div className="in-card-status-pill green">
            <span>{flowAction === "CHECKOUT" ? "✓ Shift Completed" : "✓ Checked In"}</span>
          </div>

          <div className="in-card-actions" style={{ marginTop: "24px" }}>
            <button type="button" className="in-card-btn primary green" onClick={handleCancelFlow}>
              Done
            </button>
          </div>
        </div>
      );
    }

    // 7. Error Step
    if (cardStep === "error") {
      return (
        <div className="in-card-flow-body">
          <div className="in-card-icon-wrap error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="34" height="34">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3 className="in-card-flow-title">
            {flowAction === "CHECKOUT" ? "Check-Out Failed" : "Verification Failed"}
          </h3>
          <p className="in-card-flow-desc">{cardError || "An error occurred during verification."}</p>

          <div className="in-card-actions" style={{ marginTop: "20px" }}>
            <button type="button" className="in-card-btn ghost" onClick={handleCancelFlow}>
              Cancel
            </button>
            <button
              type="button"
              className={`in-card-btn primary ${isGreen ? "green" : ""}`}
              onClick={handleRetry}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="take-attendance-page">
      {/* ══════════════════════════ TOP ROW ══════════════════════════ */}
      <div className="take-att-top-row">
        {/* ── Left Card: Live Time Gradient Card ── */}
        <div className="att-live-time-card">
          <div className="att-live-time-content">
            <div className="att-live-indicator">
              <span className="live-pulse-dot" />
              <span>Live Time</span>
            </div>
            <div className="att-huge-time">{digitalTimeStr}</div>
            <div className="att-date-str">{formattedDateStr}</div>
          </div>
          <div className="att-quote">"Small steps every day make big progress."</div>

          {/* Semi-transparent live analog clock on right */}
          <AnalogClockGraphic time={currentTime} />
        </div>

        {/* ── Right Card: Today's Attendance ── */}
        <div className="att-today-summary-card">
          <div className="att-summary-header">
            <div className="att-summary-title-wrap">
              <div className="att-summary-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <span className="att-summary-title">Today's Attendance</span>
            </div>
            <div className="att-live-update-badge">
              <span className="live-dot" />
              <span>Live Update</span>
            </div>
          </div>

          <div className="att-tiles-grid">
            {/* 1. Check-In Time */}
            <div className="att-tile green">
              <div className="att-tile-top">
                <div className="att-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <span className="att-tile-label">Check-In Time</span>
              </div>
              <div className="att-tile-value">
                {isCheckedIn ? formatTime(todayAttendance.checkInTime) : "-- : --"}
              </div>
              <span className="att-tile-badge">
                {isCheckedIn ? "Checked In" : "Not Marked"}
              </span>
            </div>

            {/* 2. Check-Out Time */}
            <div className="att-tile pink">
              <div className="att-tile-top">
                <div className="att-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </div>
                <span className="att-tile-label">Check-Out Time</span>
              </div>
              <div className="att-tile-value">
                {isCheckedOut ? formatTime(todayAttendance.checkOutTime) : "-- : --"}
              </div>
              <span
                className={`att-tile-badge ${
                  isCheckedOut ? "success" : isCheckedIn ? "active" : ""
                }`}
              >
                {isCheckedOut
                  ? "Checked Out"
                  : isCheckedIn
                  ? "Shift in Progress"
                  : "Not yet checked out"}
              </span>
            </div>

            {/* 3. Working Time */}
            <div className="att-tile purple">
              <div className="att-tile-top">
                <div className="att-tile-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <span className="att-tile-label">Working Time</span>
              </div>
              <div className="att-tile-value">{workingTimeDisplay}</div>
              <span className="att-tile-badge">{isCheckedOut ? "Completed" : "Live Counter"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════ MIDDLE ROW ══════════════════════════ */}
      <div className="take-att-middle-row">
        {/* ── 1. Office Login Card ── */}
        <div
          className={`att-mode-card office ${activeFlowCard === "OFFICE" ? "in-flow" : ""} ${
            activeFlowCard === "DISTANCE" ? "dimmed" : ""
          } ${isOfficeCheckIn && !isCheckedOut ? "active-session" : ""}`}
        >
          {activeFlowCard === "OFFICE" ? (
            <>
              <button
                type="button"
                className="in-card-cancel-btn"
                onClick={handleCancelFlow}
                title="Cancel verification"
              >
                ✕
              </button>
              {renderCardFlowContent("OFFICE")}
            </>
          ) : (
            <>
              <div className="att-mode-img-frame">
                <img
                  src="/Attendance/office-login.jpg"
                  alt="Office Login"
                  className="att-mode-img"
                />
              </div>
              <h2 className="att-mode-title">Office Login</h2>
              <p className={`att-mode-sub ${isOfficeCheckIn && !isCheckedOut ? "active" : ""}`}>
                {isOfficeCheckIn && !isCheckedOut ? "● Active Check-In Session" : "I am in office"}
              </p>

              <div className="att-mode-steps">
                {/* 1. Biometric */}
                <div className="att-step-row">
                  <div className="att-step-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                      <path d="M2 12a10 10 0 0 1 18-6" />
                      <path d="M2 16h.01" />
                      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
                    </svg>
                  </div>
                  <div className="att-step-texts">
                    <span className="att-step-title">Biometric</span>
                    <span className="att-step-desc">Verify using your device biometric</span>
                  </div>
                </div>

                {/* 2. Geo Location */}
                <div className="att-step-row">
                  <div className="att-step-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="att-step-texts">
                    <span className="att-step-title">Geo Location</span>
                    <span className="att-step-desc">We will verify your office network</span>
                  </div>
                </div>

                {/* 3. Mark Attendance */}
                <div className="att-step-row">
                  <div className="att-step-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  </div>
                  <div className="att-step-texts">
                    <span className="att-step-title">Mark Attendance</span>
                    <span className="att-step-desc">Complete your check-in</span>
                  </div>
                </div>
              </div>

              {isOfficeCheckIn && !isCheckedOut ? (
                <button
                  type="button"
                  className="att-action-btn checkout"
                  onClick={() => handleStartCheckOut("OFFICE")}
                  title="Click to check out from office"
                >
                  <span className="btn-chevron-circle checkout">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  <span>Check Out Now</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="att-action-btn office"
                  disabled={isCheckedIn}
                  onClick={handleStartOffice}
                >
                  <span className="btn-chevron-circle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                  <span>
                    {isCheckedOut
                      ? isOfficeCheckIn
                        ? "Checked Out"
                        : "Already Marked"
                      : isCheckedIn
                      ? "Already Marked"
                      : "Continue with Office Login"}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── 2. Remote Login Card ── */}
        <div
          className={`att-mode-card distance ${activeFlowCard === "DISTANCE" ? "in-flow" : ""} ${
            activeFlowCard === "OFFICE" ? "dimmed" : ""
          } ${isDistanceCheckIn && !isCheckedOut ? "active-session" : ""}`}
        >
          {activeFlowCard === "DISTANCE" ? (
            <>
              <button
                type="button"
                className="in-card-cancel-btn"
                onClick={handleCancelFlow}
                title="Cancel verification"
              >
                ✕
              </button>
              {renderCardFlowContent("DISTANCE")}
            </>
          ) : (
            <>
              <div className="att-mode-img-frame">
                <img
                  src="/Attendance/distance-login.jpg"
                  alt="Remote Login"
                  className="att-mode-img"
                />
              </div>
              <h2 className="att-mode-title">Remote Login</h2>
              <p className={`att-mode-sub ${isDistanceCheckIn && !isCheckedOut ? "active" : ""}`}>
                {isDistanceCheckIn && !isCheckedOut ? "● Active Check-In Session" : "I am working remotely"}
              </p>

              <div className="att-mode-steps">
                {/* 1. Biometric */}
                <div className="att-step-row">
                  <div className="att-step-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
                      <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
                      <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
                      <path d="M2 12a10 10 0 0 1 18-6" />
                      <path d="M2 16h.01" />
                      <path d="M21.8 16c.2-2 .131-5.354 0-6" />
                      <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
                      <path d="M8.65 22c.21-.66.45-1.32.57-2" />
                      <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
                    </svg>
                  </div>
                  <div className="att-step-texts">
                    <span className="att-step-title">Biometric</span>
                    <span className="att-step-desc">Verify using your device biometric</span>
                  </div>
                </div>

                {/* 2. Geo Location */}
                <div className="att-step-row">
                  <div className="att-step-icon-wrap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                  </div>
                  <div className="att-step-texts">
                    <span className="att-step-title">Geo Location</span>
                    <span className="att-step-desc">We will verify your current location</span>
                  </div>
                </div>

                {/* 3. Mark Attendance */}
                <div className="att-step-row">
                  <div className="att-step-icon-wrap green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  </div>
                  <div className="att-step-texts">
                    <span className="att-step-title">Mark Attendance</span>
                    <span className="att-step-desc">Complete your check-in</span>
                  </div>
                </div>
              </div>

              {isDistanceCheckIn && !isCheckedOut ? (
                <button
                  type="button"
                  className="att-action-btn checkout"
                  onClick={() => handleStartCheckOut("DISTANCE")}
                  title="Click to check out from remote session"
                >
                  <span className="btn-chevron-circle checkout">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="13" height="13">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  <span>Check Out Now</span>
                </button>
              ) : (
                <button
                  type="button"
                  className="att-action-btn distance"
                  disabled={isCheckedIn}
                  onClick={handleStartDistance}
                >
                  <span className="btn-chevron-circle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" width="12" height="12">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                  <span>
                    {isCheckedOut
                      ? isDistanceCheckIn
                        ? "Checked Out"
                        : "Already Marked"
                      : isCheckedIn
                      ? "Already Marked"
                      : "Continue with Remote Login"}
                  </span>
                </button>
              )}
            </>
          )}
        </div>

        {/* ── 3. Attendance / Login Status Card ── */}
        <div className="att-status-card att-process-card">
          {/* Header */}
          <div className="att-status-head">
            <div className="att-status-head-left">
              <div className="att-status-icon-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div>
                <h2 className="att-status-title">Login Status</h2>
                <p className="att-status-sub">
                  {isCheckedIn
                    ? "Your latest login and attendance details."
                    : "Your current login and attendance details will appear here."}
                </p>
              </div>
            </div>
            <div
              className="att-status-info-btn"
              title="Real-time attendance session, geo-coordinates, and authentication details"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="19" height="19">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
          </div>

          {!isCheckedIn ? (
            /* Empty State: No Login Data Yet */
            <div className="att-status-empty-body">
              <EmptyLoginGraphic />
              <h3 className="att-empty-title">No Login Data Yet</h3>
              <p className="att-empty-desc">
                Your login details, check-in/out time and location will be shown here after you give your attendance.
              </p>
            </div>
          ) : (
            /* Populated State: Attendance Data Available */
            <div className="att-status-active-body">
              {/* Status Banner */}
              <div className="att-status-banner">
                <div className="att-status-banner-left">
                  <span className={`att-status-pulse-dot ${isCheckedOut ? "completed" : ""}`} />
                  <div>
                    <div className="att-status-banner-title">
                      {isCheckedOut ? "Checked Out" : "Logged In"}
                    </div>
                    <div className="att-status-banner-desc">
                      {isCheckedOut
                        ? "Today's work session completed"
                        : "You are currently in an active session"}
                    </div>
                  </div>
                </div>
                <div className={`att-status-type-pill ${todayAttendance?.loginType === "DISTANCE" ? "distance" : "office"}`}>
                  {todayAttendance?.loginType === "DISTANCE" ? (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      <span>Remote Login</span>
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="14" height="14">
                        <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                        <line x1="9" y1="6" x2="15" y2="6" />
                        <line x1="9" y1="10" x2="15" y2="10" />
                        <line x1="9" y1="14" x2="15" y2="14" />
                        <line x1="9" y1="18" x2="15" y2="18" />
                      </svg>
                      <span>Office Login</span>
                    </>
                  )}
                </div>
              </div>

              {/* Check-In and Check-Out Cards Row */}
              <div className="att-status-cards-row">
                {/* 1. Check-In Card */}
                <div className="att-status-detail-card checkin">
                  <div className="att-status-card-top">
                    <div className="att-status-card-icon green">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="17" height="17">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                    </div>
                    <div className="att-status-card-title">Check-In</div>
                  </div>

                  <div className="att-status-location-box">
                    <div className="att-status-loc-icon">
                      <svg viewBox="0 0 24 24" fill="none" stroke="#0074F1" strokeWidth="2.2" width="16" height="16">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    </div>
                    <div className="att-status-loc-texts">
                      <span className="att-status-loc-name" title={checkInAddress || "Location"}>
                        {checkInAddress || "Location"}
                      </span>
                      <span className="att-status-loc-coords">
                        Lat {todayAttendance?.latitude ? Number(todayAttendance.latitude).toFixed(4) : Number(OFFICE_LOCATION.latitude).toFixed(4)}, Long {todayAttendance?.longitude ? Number(todayAttendance.longitude).toFixed(4) : Number(OFFICE_LOCATION.longitude).toFixed(4)}
                      </span>
                      {inAccuracyMeters != null && (
                        <span className="att-status-loc-accuracy">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="12" height="12">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                          </svg>
                          <span>Accuracy: ±{inAccuracyMeters}m</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <RealMapEmbed
                    isCheckOut={false}
                    lat={todayAttendance?.latitude}
                    lng={todayAttendance?.longitude}
                    address={checkInAddress}
                    accuracy={inAccuracyMeters}
                  />
                </div>

                {/* 2. Check-Out Card */}
                <div className={`att-status-detail-card checkout ${!isCheckedOut ? "pending" : ""}`}>
                  {isCheckedOut ? (
                    <>
                      <div className="att-status-card-top">
                        <div className="att-status-card-icon red">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="17" height="17">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                        </div>
                        <div className="att-status-card-title">Check-Out</div>
                      </div>

                      <div className="att-status-location-box">
                        <div className="att-status-loc-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="#0074F1" strokeWidth="2.2" width="16" height="16">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                            <circle cx="12" cy="10" r="3" />
                          </svg>
                        </div>
                        <div className="att-status-loc-texts">
                          <span className="att-status-loc-name" title={checkOutAddress || checkInAddress || "Location"}>
                            {checkOutAddress || checkInAddress || "Location"}
                          </span>
                          <span className="att-status-loc-coords">
                            Lat {(todayAttendance?.checkOutLatitude || todayAttendance?.latitude) ? Number(todayAttendance.checkOutLatitude || todayAttendance.latitude).toFixed(4) : Number(OFFICE_LOCATION.latitude).toFixed(4)}, Long {(todayAttendance?.checkOutLongitude || todayAttendance?.longitude) ? Number(todayAttendance.checkOutLongitude || todayAttendance.longitude).toFixed(4) : Number(OFFICE_LOCATION.longitude).toFixed(4)}
                          </span>
                          {outAccuracyMeters != null && (
                            <span className="att-status-loc-accuracy">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="12" height="12">
                                <circle cx="12" cy="12" r="9" />
                                <path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                              </svg>
                              <span>Accuracy: ±{outAccuracyMeters}m</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <RealMapEmbed
                        isCheckOut={true}
                        lat={todayAttendance?.checkOutLatitude || todayAttendance?.latitude}
                        lng={todayAttendance?.checkOutLongitude || todayAttendance?.longitude}
                        address={checkOutAddress || checkInAddress}
                        accuracy={outAccuracyMeters}
                      />
                    </>
                  ) : (
                    <div className="att-status-checkout-empty">
                      <div className="att-status-card-top">
                        <div className="att-status-card-icon gray">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="17" height="17">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                        </div>
                        <div className="att-status-card-title">Check-Out</div>
                      </div>
                      <div className="att-pending-checkout-box">
                        <p>Not Checked Out Yet</p>
                        <span>Coordinates and checkout map will appear here when you check out today.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* View Full History Action Button */}
              <button
                type="button"
                className="att-status-history-btn"
                onClick={() => navigate("/employee/records")}
              >
                <div className="att-status-history-btn-inner">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="17" height="17">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  <span>View Full Attendance History</span>
                </div>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="15" height="15">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════ BOTTOM MOTIVATIONAL BANNER ══════════════════════════ */}
      <div className="bottom-motivational-banner">
        <img
          src="/dashboard-banner-2x.png"
          alt="Discipline Today Builds a Better Tomorrow - Work Today for a Better Tomorrow"
          className="banner-exact-img"
        />
      </div>

      {/* ══════════════════════════ CHECK OUT MODAL (WHEN APPLICABLE) ══════════════════════════ */}
      {showCheckOut && (
        <CheckOutFlowModal
          isOpen={showCheckOut}
          onClose={() => setShowCheckOut(false)}
          onSuccess={handleCheckOutSuccess}
        />
      )}

      {/* ══════════════════════════ EARLY CHECK-OUT WARNING MODAL ══════════════════════════ */}
      <EarlyCheckOutWarningModal
        isOpen={showEarlyWarning}
        onClose={() => {
          setShowEarlyWarning(false);
          setPendingCheckOutMode(null);
        }}
        onConfirm={handleConfirmEarlyCheckOut}
        checkInTime={todayAttendance?.checkInTime}
        currentTime={currentTime}
      />
    </div>
  );
}
