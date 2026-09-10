import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function EditProfileModal({
  isOpen,
  onClose,
  initialData,
  onSave,
  loading = false,
}) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || "",
        phone: initialData.phone || "",
      });
    }
  }, [initialData, isOpen]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      name: form.name.trim(),
      phone: form.phone.trim(),
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
          <div className="emp-form-group">
            <label htmlFor="edit-name">Full Name</label>
            <input
              id="edit-name"
              type="text"
              required
              className="emp-form-input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="emp-form-group">
            <label htmlFor="edit-phone">Phone Number</label>
            <input
              id="edit-phone"
              type="tel"
              placeholder="+91 98765 43210"
              className="emp-form-input"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
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
              disabled={loading}
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
