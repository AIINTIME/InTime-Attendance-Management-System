import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const COUNTRY_CODES = [
  { code: "+91",  label: "🇮🇳 +91  (India)" },
  { code: "+1",   label: "🇺🇸 +1   (USA / Canada)" },
  { code: "+44",  label: "🇬🇧 +44  (UK)" },
  { code: "+61",  label: "🇦🇺 +61  (Australia)" },
  { code: "+971", label: "🇦🇪 +971 (UAE)" },
  { code: "+65",  label: "🇸🇬 +65  (Singapore)" },
  { code: "+60",  label: "🇲🇾 +60  (Malaysia)" },
  { code: "+81",  label: "🇯🇵 +81  (Japan)" },
  { code: "+86",  label: "🇨🇳 +86  (China)" },
  { code: "+49",  label: "🇩🇪 +49  (Germany)" },
  { code: "+33",  label: "🇫🇷 +33  (France)" },
  { code: "+7",   label: "🇷🇺 +7   (Russia)" },
  { code: "+55",  label: "🇧🇷 +55  (Brazil)" },
  { code: "+27",  label: "🇿🇦 +27  (South Africa)" },
];

/** Split a stored phone into { code, digits } */
function splitPhone(storedPhone, storedCountryCode) {
  let code = storedCountryCode || "+91";
  let digits = (storedPhone || "").replace(/\D/g, "");

  if (storedPhone) {
    const match = COUNTRY_CODES.find((c) => storedPhone.startsWith(c.code));
    if (match) {
      code = match.code;
      digits = storedPhone.slice(match.code.length).replace(/\D/g, "");
    }
  }

  if (digits.length > 10) {
    digits = digits.slice(-10);
  }

  return { code, digits };
}

export default function EditProfileModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  loading = false,
}) {
  const [name, setName]         = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [digits, setDigits]     = useState("");
  const [phoneError, setPhoneError] = useState("");

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || "");
      const { code, digits: d } = splitPhone(initialData.phone || "", initialData.countryCode);
      setCountryCode(code);
      setDigits(d);
      setPhoneError("");
    }
  }, [initialData, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => { if (e.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleDigitsChange = (e) => {
    // Allow only numeric digits, max 10
    const val = e.target.value.replace(/\D/g, "").slice(0, 10);
    setDigits(val);
    if (val.length > 0 && val.length < 10) {
      setPhoneError("Phone number must be exactly 10 digits.");
    } else {
      setPhoneError("");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (digits.length > 0 && digits.length !== 10) {
      setPhoneError("Phone number must be exactly 10 digits.");
      return;
    }
    onSave({
      name: name.trim(),
      countryCode,
      phone: digits,
    });
  };

  return createPortal(
    <div className="emp-modal-overlay" onClick={onClose}>
      <div
        className="emp-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Edit Profile Information"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="emp-modal-header">
          <h3>Edit Profile Information</h3>
          <button
            type="button"
            className="emp-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Full Name */}
          <div className="emp-form-group">
            <label htmlFor="edit-name">Full Name</label>
            <input
              id="edit-name"
              type="text"
              required
              className="emp-form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Phone Number with country code */}
          <div className="emp-form-group">
            <label htmlFor="edit-phone">Phone Number</label>
            <div className="emp-phone-row">
              <select
                className="emp-country-select"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                aria-label="Country code"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>

              <input
                id="edit-phone"
                type="tel"
                inputMode="numeric"
                pattern="[0-9]{10}"
                placeholder="10-digit number"
                className={`emp-form-input emp-phone-digits${phoneError ? " emp-input-error" : ""}`}
                value={digits}
                onChange={handleDigitsChange}
                maxLength={10}
              />
            </div>
            {phoneError && (
              <span className="emp-field-error">{phoneError}</span>
            )}
            {!phoneError && digits.length > 0 && (
              <span className="emp-field-hint">
                {digits.length}/10 digits — will save as&nbsp;
                <strong>{countryCode}{digits}</strong>
              </span>
            )}
          </div>

          <div className="emp-form-actions">
            <button
              type="button"
              className="emp-btn-cancel"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="emp-btn-submit"
              disabled={loading || (digits.length > 0 && digits.length !== 10)}
            >
              {loading ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
