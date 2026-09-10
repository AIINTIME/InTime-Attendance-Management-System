import { useEffect, useState, useRef, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Clock,
  Timer,
  BarChart2,
  Calendar,
  Save,
  Info,
  X,
  Plus,
  Minus,
  LocateFixed,
  Sliders,
  Check,
  RotateCcw,
} from "lucide-react";
import { getOrgSettings, updateOrgSettings } from "../../Services/adminService";
import { useToast } from "../../Context/ToastContext";
import { extractErrorMessage } from "../../Utils/validation";
import "../../Styles/Settings.css";

const DEFAULT_OFFICE_COORDS = {
  latitude: 22.51238080138918,
  longitude: 88.39112588370692,
  address: "INTIME IT SERVICES PVT. LTD, Ruby Park East, Kasba, Kolkata, West Bengal 700078",
  name: "INTIME IT SERVICES PVT. LTD",
};

function formatTo12Hour(time24) {
  if (!time24) return "09:30 AM";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr || "00";
  if (isNaN(h)) return time24;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const hh = h < 10 ? `0${h}` : `${h}`;
  return `${hh}:${m} ${ampm}`;
}

function formatBufferDisplay(minutes) {
  const num = Number(minutes) || 0;
  if (num === 0.5) return "30 seconds";
  if (num === 1) return "1 minute";
  return `${num} minutes`;
}

function formatBufferText(minutes) {
  const num = Number(minutes) || 0;
  if (num === 0.5) return "30-second";
  if (num === 1) return "1-minute";
  return `${num}-minute`;
}

// Calculate slider fill with thumb offset compensation so color stops exactly at the center of the round dial
function getSliderGradient(value, min, max, fillColor) {
  const v = Number(value) || min;
  const ratio = Math.min(1, Math.max(0, (v - min) / (max - min)));
  const pct = (ratio * 100).toFixed(2);
  const offset = (0.5 - ratio) * 18;
  const stop =
    offset >= 0
      ? `calc(${pct}% + ${offset.toFixed(2)}px)`
      : `calc(${pct}% - ${Math.abs(offset).toFixed(2)}px)`;
  return `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${stop}, #E2E8F0 ${stop}, #E2E8F0 100%)`;
}

export default function Settings() {
  const toast = useToast();
  const [form, setForm] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCoordsModal, setShowCoordsModal] = useState(false);

  const [detectingLocation, setDetectingLocation] = useState(false);
  const [usingCurrentLocation, setUsingCurrentLocation] = useState(false);

  const mapContainerRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const checkInInputRef = useRef(null);
  const checkOutInputRef = useRef(null);

  useEffect(() => {
    getOrgSettings()
      .then((settings) => {
        const initial = {
          officeAddress: settings.officeAddress || DEFAULT_OFFICE_COORDS.address,
          officeLatitude: Number(settings.officeLatitude ?? DEFAULT_OFFICE_COORDS.latitude),
          officeLongitude: Number(settings.officeLongitude ?? DEFAULT_OFFICE_COORDS.longitude),
          officeRadiusMeters: Number(settings.officeRadiusMeters ?? 100),
          checkInTime: settings.checkInTime || "09:30",
          checkOutTime: settings.checkOutTime || "18:30",
          loginBufferMinutes: Number(settings.loginBufferMinutes ?? 2),
          slightLateGraceMinutes: Number(settings.slightLateGraceMinutes ?? 5),
          lateGraceMinutes: Number(settings.lateGraceMinutes ?? 15),
          veryLateGraceMinutes: Number(settings.veryLateGraceMinutes ?? 30),
          halfDayRules: settings.halfDayRules || [
            { dayOfWeek: 6, occurrence: 1 },
            { dayOfWeek: 6, occurrence: 3 },
          ],
        };
        setForm(initial);
        setSavedForm(initial);
      })
      .catch((err) => toast.error(extractErrorMessage(err, "Failed to load settings.")))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track if any changes have been made relative to the saved baseline
  const isDirty = useMemo(() => {
    if (!form || !savedForm) return false;

    if (form.officeAddress !== savedForm.officeAddress) return true;
    if (Number(form.officeLatitude) !== Number(savedForm.officeLatitude)) return true;
    if (Number(form.officeLongitude) !== Number(savedForm.officeLongitude)) return true;
    if (Number(form.officeRadiusMeters) !== Number(savedForm.officeRadiusMeters)) return true;
    if (form.checkInTime !== savedForm.checkInTime) return true;
    if (form.checkOutTime !== savedForm.checkOutTime) return true;
    if (Number(form.loginBufferMinutes) !== Number(savedForm.loginBufferMinutes)) return true;
    if (Number(form.slightLateGraceMinutes) !== Number(savedForm.slightLateGraceMinutes)) return true;
    if (Number(form.lateGraceMinutes) !== Number(savedForm.lateGraceMinutes)) return true;
    if (Number(form.veryLateGraceMinutes) !== Number(savedForm.veryLateGraceMinutes)) return true;

    const formSaturdays = (form.halfDayRules || [])
      .filter((r) => r.dayOfWeek === 6)
      .map((r) => r.occurrence)
      .sort()
      .join(",");
    const savedSaturdays = (savedForm.halfDayRules || [])
      .filter((r) => r.dayOfWeek === 6)
      .map((r) => r.occurrence)
      .sort()
      .join(",");

    if (formSaturdays !== savedSaturdays) return true;

    return false;
  }, [form, savedForm]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSetDefaultLocation = () => {
    setForm((prev) => ({
      ...prev,
      officeLatitude: DEFAULT_OFFICE_COORDS.latitude,
      officeLongitude: DEFAULT_OFFICE_COORDS.longitude,
      officeAddress: DEFAULT_OFFICE_COORDS.address,
    }));
    setUsingCurrentLocation(false);
    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo(
        [DEFAULT_OFFICE_COORDS.latitude, DEFAULT_OFFICE_COORDS.longitude],
        17,
        { duration: 1.2 }
      );
    }
    toast.success("Location set to default (Ruby Park East, Kolkata). Click 'Save All Changes' to save.");
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("This browser doesn't support geolocation.");
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));

        let formattedAddress = "";
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              formattedAddress = data.display_name;
            }
          }
        } catch {
          // Graceful fallback
        }

        setForm((prev) => ({
          ...prev,
          officeLatitude: lat,
          officeLongitude: lng,
          ...(formattedAddress ? { officeAddress: formattedAddress } : {}),
        }));

        setDetectingLocation(false);
        setUsingCurrentLocation(true);
        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
        }
        toast.success("Current location captured! Click 'Save All Changes' to make it the default.");
      },
      (err) => {
        setDetectingLocation(false);
        if (err.code === 1) {
          toast.error("Location permission denied. Please allow location access in your browser.");
        } else {
          toast.error("Could not capture your current location. Please try again.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Real interactive Leaflet Map initialization and synchronization
  useEffect(() => {
    if (!mapContainerRef.current || !form) return;

    const lat = Number(form.officeLatitude) || 22.5726;
    const lng = Number(form.officeLongitude) || 88.3639;
    const radius = Number(form.officeRadiusMeters) || 100;

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 18,
        zoomControl: false,
        attributionControl: false,
      });

      // High-resolution clean map tiles without watermarks (CartoDB Voyager)
      L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        maxZoom: 20,
        subdomains: ["a", "b", "c", "d"],
      }).addTo(map);

      setTimeout(() => {
        map.invalidateSize();
      }, 200);

      // Google-styled Red Pin marker with exact office name in English and Bengali
      const pinIcon = L.divIcon({
        className: "custom-leaflet-office-marker",
        html: `
          <div class="office-poi-marker-wrap">
            <div class="office-poi-pin">
              <svg viewBox="0 0 24 24" width="34" height="34" fill="#EA4335">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                <circle cx="12" cy="9" r="3.2" fill="#7F1D1D"/>
              </svg>
            </div>
            <div class="office-poi-text-box">
              <div class="office-poi-name-en">INTIME IT SERVICES PVT. LTD</div>
              <div class="office-poi-name-bn">ইনটাইম আইটি সার্ভিসেস প্রাইভেট লিমিটেড</div>
            </div>
          </div>
        `,
        iconSize: [260, 44],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([lat, lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      const circle = L.circle([lat, lng], {
        radius: radius,
        color: "#2563EB",
        weight: 2,
        fillColor: "#3B82F6",
        fillOpacity: 0.22,
      }).addTo(map);

      // Click on real map to place marker & update address
      map.on("click", async (e) => {
        const newLat = Number(e.latlng.lat.toFixed(6));
        const newLng = Number(e.latlng.lng.toFixed(6));
        marker.setLatLng([newLat, newLng]);
        circle.setLatLng([newLat, newLng]);
        setField("officeLatitude", newLat);
        setField("officeLongitude", newLng);
        setUsingCurrentLocation(false);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${newLat}&lon=${newLng}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setField("officeAddress", data.display_name);
            }
          }
        } catch {
          // Graceful fallback
        }
      });

      // Drag marker to update location
      marker.on("dragend", async (e) => {
        const pos = e.target.getLatLng();
        const newLat = Number(pos.lat.toFixed(6));
        const newLng = Number(pos.lng.toFixed(6));
        circle.setLatLng([newLat, newLng]);
        setField("officeLatitude", newLat);
        setField("officeLongitude", newLng);
        setUsingCurrentLocation(false);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${newLat}&lon=${newLng}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data && data.display_name) {
              setField("officeAddress", data.display_name);
            }
          }
        } catch {
          // Graceful fallback
        }
      });

      leafletMapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
    } else {
      const currentCenter = leafletMapRef.current.getCenter();
      if (
        Math.abs(currentCenter.lat - lat) > 0.0001 ||
        Math.abs(currentCenter.lng - lng) > 0.0001
      ) {
        leafletMapRef.current.setView([lat, lng], leafletMapRef.current.getZoom(), {
          animate: true,
        });
      }
      if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
      if (circleRef.current) {
        circleRef.current.setLatLng([lat, lng]);
        circleRef.current.setRadius(radius);
      }
    }

    const timer = setTimeout(() => {
      leafletMapRef.current?.invalidateSize();
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.officeLatitude, form?.officeLongitude, form?.officeRadiusMeters]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, []);

  const isSaturdayChecked = (occurrence) => {
    if (!form?.halfDayRules) return false;
    return form.halfDayRules.some((r) => r.dayOfWeek === 6 && r.occurrence === occurrence);
  };

  const toggleSaturday = (occurrence) => {
    setForm((f) => {
      const exists = f.halfDayRules.some((r) => r.dayOfWeek === 6 && r.occurrence === occurrence);
      let updated;
      if (exists) {
        updated = f.halfDayRules.filter(
          (r) => !(r.dayOfWeek === 6 && r.occurrence === occurrence)
        );
      } else {
        updated = [...f.halfDayRules, { dayOfWeek: 6, occurrence }];
      }
      return { ...f, halfDayRules: updated };
    });
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!isDirty || saving) return;
    setSaving(true);
    try {
      const updated = await updateOrgSettings({
        officeAddress: form.officeAddress,
        officeLatitude: Number(form.officeLatitude),
        officeLongitude: Number(form.officeLongitude),
        officeRadiusMeters: Number(form.officeRadiusMeters),
        checkInTime: form.checkInTime,
        checkOutTime: form.checkOutTime,
        loginBufferMinutes: Number(form.loginBufferMinutes),
        slightLateGraceMinutes: Number(form.slightLateGraceMinutes),
        lateGraceMinutes: Number(form.lateGraceMinutes || 15),
        veryLateGraceMinutes: Number(form.veryLateGraceMinutes),
        halfDayRules: form.halfDayRules,
      });
      const newSaved = {
        ...form,
        ...updated,
        officeAddress: updated.officeAddress || form.officeAddress,
        officeLatitude: Number(updated.officeLatitude ?? form.officeLatitude),
        officeLongitude: Number(updated.officeLongitude ?? form.officeLongitude),
        officeRadiusMeters: Number(updated.officeRadiusMeters ?? form.officeRadiusMeters),
        lateGraceMinutes: Number(updated.lateGraceMinutes ?? form.lateGraceMinutes),
      };
      setForm(newSaved);
      setSavedForm(newSaved);
      toast.success("Settings saved successfully.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="settings-page-wrapper">
        <div className="spinner" style={{ margin: "80px auto" }} />
      </div>
    );
  }

  // Address split for the floating card
  const addressParts = (form.officeAddress || DEFAULT_OFFICE_COORDS.address).split(",");
  const displayArea = addressParts.filter((p) => !p.toLowerCase().includes("intime")).slice(0, 2).join(",").trim() || "Ruby Park East, Kasba";

  return (
    <div className="settings-page-wrapper">
      {/* ══════════════════════════ TOP HEADER ══════════════════════════ */}
      <div className="settings-top-bar">
        <div className="settings-title-group">
          <h1 className="settings-main-title">Settings</h1>
          <p className="settings-main-subtitle">
            Configure organization-wide attendance rules and preferences.
          </p>
        </div>
        <button
          type="button"
          className={`settings-save-btn ${saving ? "is-saving" : ""}`}
          onClick={handleSave}
          disabled={saving || !isDirty}
          title={!isDirty ? "No unsaved changes" : "Save All Changes"}
        >
          <Save size={18} strokeWidth={2.2} />
          <span>{saving ? "Saving…" : "Save All Changes"}</span>
        </button>
      </div>

      {/* ══════════════════════════ ROW 1: SPLIT GRID ══════════════════════════ */}
      <div className="settings-row-split">
        {/* ── LEFT CARD: Office Location & Geo-fence ── */}
        <div className="settings-card office-card">
          <div className="settings-card-head">
            <div className="settings-card-icon-box">
              <MapPin size={20} className="icon-blue" />
            </div>
            <div>
              <h2 className="settings-card-title">Office Location &amp; Geo-fence</h2>
              <p className="settings-card-subtitle">
                Set your office location and allowed attendance radius.
              </p>
            </div>
          </div>

          {/* Address search & Current Location Action */}
          <div className="settings-address-row">
            <div className="settings-address-input-wrap">
              <MapPin size={17} className="address-pin-icon" />
              <input
                type="text"
                className="settings-address-input"
                value={form.officeAddress}
                onChange={(e) => {
                  setField("officeAddress", e.target.value);
                  setUsingCurrentLocation(false);
                }}
                placeholder="Search or enter office address"
              />
              {form.officeAddress ? (
                <button
                  type="button"
                  className="address-clear-btn"
                  onClick={() => {
                    setField("officeAddress", "");
                    setUsingCurrentLocation(false);
                  }}
                  title="Clear address"
                >
                  <X size={15} />
                </button>
              ) : null}
            </div>
            <button
              type="button"
              className="settings-default-location-btn"
              onClick={handleSetDefaultLocation}
              title="Reset office location to default coordinates (Ruby Park East, Kolkata)"
            >
              <RotateCcw size={15} />
              <span>Default</span>
            </button>
            <button
              type="button"
              className={`settings-use-current-location-btn ${detectingLocation ? "loading" : ""}`}
              onClick={handleUseCurrentLocation}
              disabled={detectingLocation}
              title="Detect and set my current GPS location as office location"
            >
              <LocateFixed size={16} className={`locate-btn-icon ${detectingLocation ? "spinning" : ""}`} />
              <span>{detectingLocation ? "Detecting..." : "Use Current Location"}</span>
            </button>
          </div>

          {usingCurrentLocation && (
            <div className="current-location-active-badge">
              <Check size={14} className="badge-check-icon" />
              <span>
                Current GPS position detected ({Number(form.officeLatitude).toFixed(4)}, {Number(form.officeLongitude).toFixed(4)}). Click <strong>Save All Changes</strong> above to set as default office location.
              </span>
            </div>
          )}

          {/* Interior: Map on left, Allowed Radius on right */}
          <div className="office-interior-grid">
            {/* Map Preview Area */}
            {/* Map Preview Area with Real Map */}
            <div className="office-map-container">
              <div ref={mapContainerRef} className="office-real-leaflet-map" />

              {/* Floating Office Location Card */}
              <div className="office-map-tooltip">
                <div className="tooltip-title">INTIME IT SERVICES PVT. LTD</div>
                <div className="tooltip-area">{displayArea}</div>
                <div className="tooltip-coords">
                  {Number(form.officeLatitude).toFixed(4)}, {Number(form.officeLongitude).toFixed(4)}
                </div>
                <div className="tooltip-arrow" />
              </div>

              {/* Map Zoom Controls & Location button */}
              <div className="office-map-controls">
                <button
                  type="button"
                  className="map-zoom-btn"
                  onClick={() => leafletMapRef.current?.zoomIn()}
                  title="Zoom in"
                >
                  <Plus size={14} />
                </button>
                <div className="map-zoom-divider" />
                <button
                  type="button"
                  className="map-zoom-btn"
                  onClick={() => leafletMapRef.current?.zoomOut()}
                  title="Zoom out"
                >
                  <Minus size={14} />
                </button>
              </div>

              <button
                type="button"
                className="office-map-locate-btn"
                onClick={handleUseCurrentLocation}
                title="Use current GPS location"
              >
                <LocateFixed size={14} className={detectingLocation ? "spinning" : ""} />
              </button>

              <button
                type="button"
                className="office-map-coords-btn"
                onClick={() => setShowCoordsModal((v) => !v)}
                title="Edit Latitude/Longitude"
              >
                <Sliders size={13} />
              </button>
            </div>

            {/* Allowed Radius Section */}
            <div className="office-radius-section">
              <div className="radius-head">
                <span className="radius-title">Allowed Radius</span>
                <span className="radius-info-icon" title="Allowed check-in radius around office location">
                  <Info size={13} />
                </span>
              </div>

              <div className="radius-large-display">
                {form.officeRadiusMeters} meters
              </div>

              <div className="radius-slider-box">
                <input
                  type="range"
                  className="custom-range-slider blue-slider"
                  min="30"
                  max="250"
                  step="5"
                  value={form.officeRadiusMeters}
                  onChange={(e) => setField("officeRadiusMeters", Number(e.target.value))}
                  style={{
                    background: getSliderGradient(form.officeRadiusMeters, 30, 250, "#2563EB"),
                  }}
                />
                <div className="slider-labels-row">
                  <span>30 m</span>
                  <span>250 m</span>
                </div>
              </div>

              <div className="radius-info-banner">
                <Info size={16} className="info-badge-icon" />
                <p className="radius-info-text">
                  Employees can check-in only within this radius from the office location.
                </p>
              </div>
            </div>
          </div>

          {/* Coordinates Modal / Popover */}
          {showCoordsModal && (
            <div className="coords-drawer">
              <div className="coords-drawer-head">
                <span>Exact Coordinates &amp; Radius</span>
                <button
                  type="button"
                  className="coords-close-btn"
                  onClick={() => setShowCoordsModal(false)}
                >
                  <X size={14} />
                </button>
              </div>
              <div className="coords-drawer-grid">
                <div className="coords-field">
                  <label>Latitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.officeLatitude}
                    onChange={(e) => setField("officeLatitude", e.target.value)}
                  />
                </div>
                <div className="coords-field">
                  <label>Longitude</label>
                  <input
                    type="number"
                    step="any"
                    value={form.officeLongitude}
                    onChange={(e) => setField("officeLongitude", e.target.value)}
                  />
                </div>
                <div className="coords-field">
                  <label>Radius (m)</label>
                  <input
                    type="number"
                    min="1"
                    max="2000"
                    value={form.officeRadiusMeters}
                    onChange={(e) => setField("officeRadiusMeters", Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN: Organization Timings + Login Buffer ── */}
        <div className="settings-col-right">
          {/* Organization Timings Card */}
          <div className="settings-card timings-card">
            <div className="settings-card-head">
              <div className="settings-card-icon-box">
                <Clock size={20} className="icon-blue" />
              </div>
              <div>
                <h2 className="settings-card-title">Organization Timings</h2>
                <p className="settings-card-subtitle">
                  Set the standard working hours for all employees.
                </p>
              </div>
            </div>

            <div className="timings-grid">
              {/* Check-in Time */}
              <div
                className="timing-box check-in-box"
                onClick={() => checkInInputRef.current?.showPicker?.()}
              >
                <div className="timing-badge-wrap check-in-badge">
                  <span className="timing-badge-dot check-in-dot" />
                  <Clock size={14} className="timing-badge-icon check-in-icon" />
                  <span className="timing-badge-label">Check-in Time</span>
                </div>
                <div className="timing-value-field">
                  <span className="timing-value-text">
                    {formatTo12Hour(form.checkInTime)}
                  </span>
                  <Clock size={16} className="timing-right-icon" />
                  <input
                    ref={checkInInputRef}
                    type="time"
                    className="timing-native-input"
                    value={form.checkInTime}
                    onChange={(e) => setField("checkInTime", e.target.value)}
                  />
                </div>
              </div>

              {/* Check-out Time */}
              <div
                className="timing-box check-out-box"
                onClick={() => checkOutInputRef.current?.showPicker?.()}
              >
                <div className="timing-badge-wrap check-out-badge">
                  <span className="timing-badge-dot check-out-dot" />
                  <Timer size={14} className="timing-badge-icon check-out-icon" />
                  <span className="timing-badge-label">Check-out Time</span>
                </div>
                <div className="timing-value-field">
                  <span className="timing-value-text">
                    {formatTo12Hour(form.checkOutTime)}
                  </span>
                  <Clock size={16} className="timing-right-icon" />
                  <input
                    ref={checkOutInputRef}
                    type="time"
                    className="timing-native-input"
                    value={form.checkOutTime}
                    onChange={(e) => setField("checkOutTime", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Login Buffer Time (Check-in) Card */}
          <div className="settings-card buffer-card">
            <div className="settings-card-head">
              <div className="settings-card-icon-box">
                <Timer size={20} className="icon-blue" />
              </div>
              <div>
                <h2 className="settings-card-title">Login Buffer Time (Check-in)</h2>
                <p className="settings-card-subtitle">
                  Set buffer time to adjust check-in time (only for check-in).
                </p>
              </div>
            </div>

            <div className="buffer-content-split">
              {/* Left slider column */}
              <div className="buffer-slider-col">
                <div className="buffer-large-display">
                  {formatBufferDisplay(form.loginBufferMinutes)}
                </div>
                <div className="buffer-slider-wrap">
                  <input
                    type="range"
                    className="custom-range-slider blue-slider"
                    min="0.5"
                    max="5"
                    step="0.5"
                    value={form.loginBufferMinutes}
                    onChange={(e) => setField("loginBufferMinutes", Number(e.target.value))}
                    style={{
                      background: getSliderGradient(form.loginBufferMinutes, 0.5, 5, "#2563EB"),
                    }}
                  />
                  <div className="slider-labels-row">
                    <span>30 sec</span>
                    <span>5 min</span>
                  </div>
                </div>
              </div>

              {/* Right example banner */}
              <div className="buffer-example-box">
                <Info size={18} className="info-badge-icon" />
                <p className="buffer-example-text">
                  Example: If an employee checks in at 10:07 AM with a{" "}
                  {formatBufferText(form.loginBufferMinutes)} buffer, the attendance will be recorded as 10:05 AM.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════ ROW 2: LATE STATUS CRITERIA ══════════════════════════ */}
      <div className="settings-card late-status-card">
        <div className="settings-card-head">
          <div className="settings-card-icon-box">
            <BarChart2 size={20} className="icon-blue" />
          </div>
          <div>
            <h2 className="settings-card-title">Late Status Criteria</h2>
            <p className="settings-card-subtitle">
              Set the time ranges for different late status categories (based on scheduled check-in time).
            </p>
          </div>
        </div>

        {/* 3 Columns for Late Tiers */}
        <div className="late-criteria-columns">
          {/* 1. Slight Late */}
          <div className="late-tier-col">
            <div className="tier-header">
              <span className="tier-dot dot-blue" />
              <span className="tier-name">Slight Late</span>
            </div>
            <div className="tier-large-display">
              {form.slightLateGraceMinutes} minutes
            </div>
            <div className="tier-slider-wrap">
              <input
                type="range"
                className="custom-range-slider blue-slider"
                min="1"
                max="30"
                step="1"
                value={form.slightLateGraceMinutes}
                onChange={(e) => setField("slightLateGraceMinutes", Number(e.target.value))}
                style={{
                  background: getSliderGradient(form.slightLateGraceMinutes, 1, 30, "#2563EB"),
                }}
              />
              <div className="slider-labels-row">
                <span>1 min</span>
                <span>30 min</span>
              </div>
            </div>
          </div>

          {/* 2. Late */}
          <div className="late-tier-col">
            <div className="tier-header">
              <span className="tier-dot dot-orange" />
              <span className="tier-name">Late</span>
            </div>
            <div className="tier-large-display">
              {form.lateGraceMinutes || 15} minutes
            </div>
            <div className="tier-slider-wrap">
              <input
                type="range"
                className="custom-range-slider orange-slider"
                min="1"
                max="30"
                step="1"
                value={form.lateGraceMinutes || 15}
                onChange={(e) => setField("lateGraceMinutes", Number(e.target.value))}
                style={{
                  background: getSliderGradient(form.lateGraceMinutes || 15, 1, 30, "#F97316"),
                }}
              />
              <div className="slider-labels-row">
                <span>1 min</span>
                <span>30 min</span>
              </div>
            </div>
          </div>

          {/* 3. Very Late */}
          <div className="late-tier-col">
            <div className="tier-header">
              <span className="tier-dot dot-red" />
              <span className="tier-name">Very Late</span>
            </div>
            <div className="tier-large-display">
              {form.veryLateGraceMinutes} minutes
            </div>
            <div className="tier-slider-wrap">
              <input
                type="range"
                className="custom-range-slider red-slider"
                min="1"
                max="30"
                step="1"
                value={form.veryLateGraceMinutes}
                onChange={(e) => setField("veryLateGraceMinutes", Number(e.target.value))}
                style={{
                  background: getSliderGradient(form.veryLateGraceMinutes, 1, 30, "#EF4444"),
                }}
              />
              <div className="slider-labels-row">
                <span>1 min</span>
                <span>30 min</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Full-Width Legend Banner */}
        <div className="late-legend-banner">
          <Info size={16} className="info-badge-icon" />
          <span className="legend-prefix">Employees will be marked as:</span>
          <div className="legend-items-wrap">
            <span className="legend-item">
              <span className="tier-dot dot-blue" />
              <span>Slight Late: within {form.slightLateGraceMinutes} minutes</span>
            </span>
            <span className="legend-item">
              <span className="tier-dot dot-orange" />
              <span>Late: within {form.lateGraceMinutes || 15} minutes</span>
            </span>
            <span className="legend-item">
              <span className="tier-dot dot-red" />
              <span>Very Late: beyond {form.veryLateGraceMinutes} minutes</span>
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════ ROW 3: HALF DAY CONFIGURATION ══════════════════════════ */}
      <div className="settings-card half-day-card">
        <div className="settings-card-head">
          <div className="settings-card-icon-box">
            <Calendar size={20} className="icon-blue" />
          </div>
          <div>
            <h2 className="settings-card-title">Half Day Configuration</h2>
            <p className="settings-card-subtitle">
              Select which Saturdays will be considered as half days for every month.
            </p>
          </div>
        </div>

        {/* Inner Box for Saturdays */}
        <div className="half-day-inner-box">
          <div className="half-day-left-meta">
            <div className="half-day-sub-icon">
              <Calendar size={18} className="icon-blue" />
            </div>
            <div>
              <div className="half-day-item-title">Half Day Saturdays</div>
              <div className="half-day-item-subtitle">
                Choose the Saturday(s) that will be treated as half day.
              </div>
            </div>
          </div>

          {/* 5 Saturdays Checkboxes */}
          <div className="saturdays-checkboxes-row">
            {[1, 2, 3, 4, 5].map((num) => {
              const checked = isSaturdayChecked(num);
              const labelText = num === 1 ? "1st" : num === 2 ? "2nd" : num === 3 ? "3rd" : `${num}th`;
              return (
                <label
                  key={num}
                  className={`saturday-checkbox-label ${checked ? "is-checked" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSaturday(num)}
                    className="saturday-hidden-input"
                  />
                  <span className={`custom-checkbox-box ${checked ? "checked" : ""}`}>
                    {checked && <Check size={13} strokeWidth={3} className="check-svg" />}
                  </span>
                  <span className="saturday-checkbox-text">{labelText} Saturday</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="half-day-info-banner">
          <Info size={16} className="info-badge-icon" />
          <p className="half-day-info-text">
            Selected Saturdays will be considered as half working days for all employees, every month.
          </p>
        </div>
      </div>
    </div>
  );
}
