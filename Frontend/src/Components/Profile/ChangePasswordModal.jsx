import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Eye, EyeOff } from "lucide-react";
import { changeMyPassword } from "../../Services/employeeService";
import { extractErrorMessage } from "../../Utils/validation";
import { useToast } from "../../Context/ToastContext";

export default function ChangePasswordModal({ isOpen, onClose }) {
  const toast = useToast();
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
      setError("");
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (form.newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    if (form.newPassword !== form.confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await changeMyPassword(form);
      toast.success("Password changed successfully.");
      onClose();
    } catch (err) {
      setError(extractErrorMessage(err, "Could not change password."));
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="emp-modal-overlay" onClick={onClose}>
      <div
        className="emp-modal-card"
        role="dialog"
        aria-modal="true"
        aria-label="Change Account Password"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="emp-modal-header">
          <h3>Reset Account Password</h3>
          <button
            type="button"
            className="emp-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "#fef2f2",
              color: "#dc2626",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "9px 12px",
              fontSize: "12.5px",
              marginBottom: "14px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="emp-form-group">
            <label htmlFor="modal-current-pw">Current Password</label>
            <div className="emp-input-with-icon">
              <input
                id="modal-current-pw"
                type={showCurrent ? "text" : "password"}
                required
                className="emp-form-input"
                value={form.currentPassword}
                onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              />
              <button
                type="button"
                className="emp-input-eye-btn"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="emp-form-group">
            <label htmlFor="modal-new-pw">New Password</label>
            <div className="emp-input-with-icon">
              <input
                id="modal-new-pw"
                type={showNew ? "text" : "password"}
                required
                minLength={8}
                className="emp-form-input"
                value={form.newPassword}
                onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              />
              <button
                type="button"
                className="emp-input-eye-btn"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="emp-form-group">
            <label htmlFor="modal-confirm-pw">Confirm New Password</label>
            <div className="emp-input-with-icon">
              <input
                id="modal-confirm-pw"
                type={showConfirm ? "text" : "password"}
                required
                minLength={8}
                className="emp-form-input"
                value={form.confirmNewPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmNewPassword: e.target.value }))}
              />
              <button
                type="button"
                className="emp-input-eye-btn"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="emp-form-actions">
            <button
              type="button"
              className="emp-btn-cancel"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="emp-btn-submit"
              disabled={submitting}
            >
              {submitting ? "Updating…" : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
