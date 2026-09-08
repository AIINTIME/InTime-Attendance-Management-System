import { useEffect } from "react";
import { createPortal } from "react-dom";
import "../../Styles/EarlyCheckOutModal.css";

/**
 * EarlyCheckOutWarningModal
 * Displayed when an employee attempts to check out before completing 8 hours of work.
 * Shows a live ticking countdown of remaining time, progress bar, clear warning message,
 * and two buttons: "Continue Working" and "Confirm Check-Out".
 */
export default function EarlyCheckOutWarningModal({
  isOpen,
  onClose,
  onConfirm,
  checkInTime,
  currentTime,
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !checkInTime) return null;

  /* 8-hour shift calculation */
  const TARGET_SHIFT_MS = 8 * 60 * 60 * 1000; // 28,800,000 ms
  const checkInDate = new Date(checkInTime);
  const now = currentTime ? new Date(currentTime) : new Date();
  const workedMs = Math.max(0, now.getTime() - checkInDate.getTime());
  const remainingMs = Math.max(0, TARGET_SHIFT_MS - workedMs);

  /* Live Remaining Time */
  const remTotalSecs = Math.ceil(remainingMs / 1000);
  const remH = Math.floor(remTotalSecs / 3600);
  const remM = Math.floor((remTotalSecs % 3600) / 60);
  const remS = remTotalSecs % 60;
  const remainingStr = `${remH}h ${String(remM).padStart(2, "0")}m ${String(remS).padStart(2, "0")}s`;

  /* Worked Time */
  const workedTotalSecs = Math.floor(workedMs / 1000);
  const workedH = Math.floor(workedTotalSecs / 3600);
  const workedM = Math.floor((workedTotalSecs % 3600) / 60);
  const workedS = workedTotalSecs % 60;
  const workedStr = `${workedH}h ${String(workedM).padStart(2, "0")}m ${String(workedS).padStart(2, "0")}s`;

  /* Progress percentage of 8-hour goal */
  const progressPct = Math.min(100, Math.max(0, (workedMs / TARGET_SHIFT_MS) * 100));

  return createPortal(
    <div className="early-co-overlay" onClick={onClose}>
      <div
        className="early-co-card"
        role="dialog"
        aria-modal="true"
        aria-label="Early Check-Out Warning"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top-right close button */}
        <button
          type="button"
          className="early-co-close-btn"
          aria-label="Close"
          onClick={onClose}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Warning Icon & Header */}
        <div className="early-co-header">
          <div className="early-co-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="28" height="28">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h3 className="early-co-title">Early Check-Out Warning</h3>
          <p className="early-co-subtitle">
            You haven't completed the mandatory 8-hour shift.
          </p>
        </div>

        {/* Live Remaining Time Countdown Card */}
        <div className="early-co-countdown-box">
          <div className="early-co-badge-row">
            <span className="early-co-live-badge">
              <span className="early-co-live-dot" />
              Live Remaining Time
            </span>
            <span className="early-co-target-pill">Target: 8h 00m</span>
          </div>

          <div className="early-co-timer-val">{remainingStr}</div>

          {/* Progress Bar */}
          <div className="early-co-prog-track">
            <div
              className="early-co-prog-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="early-co-stats-row">
            <span>Worked: {workedStr}</span>
            <span>{progressPct.toFixed(0)}% Completed</span>
          </div>
        </div>

        {/* Notice Message */}
        <div className="early-co-notice-box">
          <svg className="early-co-notice-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p className="early-co-notice-text">
            Checking out now will record an <strong>Early Departure</strong> and will be flagged as <strong>Insufficient Working Hours</strong> (&lt; 8 hours).
          </p>
        </div>

        {/* Two Action Buttons */}
        <div className="early-co-actions">
          <button
            type="button"
            className="early-co-btn stay"
            onClick={onClose}
          >
            Continue Working
          </button>
          <button
            type="button"
            className="early-co-btn confirm"
            onClick={onConfirm}
          >
            Confirm Check-Out
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
