import { useEffect, useRef, useState } from "react";
import { Camera, ShieldCheck, ShieldAlert, Fingerprint, Trash2 } from "lucide-react";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import { uploadMyProfilePhoto, changeMyPassword } from "../../Services/employeeService";
import {
  registerPasskey,
  listPasskeys,
  deletePasskey,
  isWebAuthnSupported,
  guessDeviceNickname,
} from "../../Services/passkeyService";
import { extractErrorMessage } from "../../Utils/validation";
import { API_URL } from "../../Utils/constants";

export default function EmployeeProfile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeys, setPasskeys] = useState(null);
  const [deletingPasskeyId, setDeletingPasskeyId] = useState(null);

  useEffect(() => {
    if (user?.passkeyRegistered) {
      listPasskeys().then(setPasskeys).catch(() => setPasskeys([]));
    }
  }, [user?.passkeyRegistered]);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const photoUrl = user?.profilePhoto ? resolveUploadUrl(user.profilePhoto) : null;

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("Image must be smaller than 3MB.");
      return;
    }

    setUploading(true);
    try {
      const profilePhoto = await uploadMyProfilePhoto(file);
      updateUser({ profilePhoto });
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSubmitting(true);
    try {
      await changeMyPassword(passwordForm);
      toast.success("Password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setPasswordError(extractErrorMessage(err));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const handleRegisterPasskey = async () => {
    setRegisteringPasskey(true);
    try {
      await registerPasskey(guessDeviceNickname());
      updateUser({ passkeyRegistered: true });
      toast.success("Passkey registered on this device.");
      const updated = await listPasskeys().catch(() => null);
      if (updated) setPasskeys(updated);
    } catch (err) {
      toast.error(err.message || "Passkey registration failed.");
    } finally {
      setRegisteringPasskey(false);
    }
  };

  const handleDeletePasskey = async (id, nickname) => {
    if (!window.confirm(`Remove the passkey for "${nickname || "this device"}"? You'll need to register it again to check in from that device.`)) {
      return;
    }
    setDeletingPasskeyId(id);
    try {
      const result = await deletePasskey(id);
      updateUser({ passkeyRegistered: result.passkeyRegistered });
      const updated = await listPasskeys().catch(() => null);
      if (updated) setPasskeys(updated);
      toast.success("Passkey removed.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not remove passkey."));
    } finally {
      setDeletingPasskeyId(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h2>Profile</h2>
      </div>

      <div className="card profile-card">
        <div className="profile-photo-wrapper">
          {photoUrl ? (
            <img src={photoUrl} alt={user?.name} className="profile-photo" />
          ) : (
            <div className="avatar-circle xlarge">{initials(user?.name)}</div>
          )}
          <button
            type="button"
            className="photo-upload-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Change profile photo"
          >
            <Camera size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={handlePhotoChange}
          />
        </div>

        <div className="profile-details">
          <h3>{user?.name}</h3>
          <div className="profile-detail-grid">
            <div>
              <span className="muted">Employee ID</span>
              <strong>{user?.employeeId}</strong>
            </div>
            <div>
              <span className="muted">Organization Email</span>
              <strong>{user?.email}</strong>
            </div>
            <div>
              <span className="muted">Department</span>
              <strong>{user?.department}</strong>
            </div>
            <div>
              <span className="muted">Designation</span>
              <strong>{user?.designation}</strong>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Passkey</h3>
        </div>
        {user?.passkeyRegistered ? (
          <div className="passkey-status-row">
            <ShieldCheck size={20} className="text-success" />
            <span>A passkey is registered on at least one device for this account.</span>
          </div>
        ) : (
          <div className="passkey-status-row">
            <ShieldAlert size={20} className="text-warning" />
            <span>No passkey registered yet. You'll need one to mark attendance.</span>
          </div>
        )}

        {passkeys?.length > 0 && (
          <div className="passkey-device-list">
            {passkeys.map((p) => (
              <div className="passkey-device-row" key={p.id}>
                <Fingerprint size={16} />
                <span>{p.nickname || "Unnamed device"}</span>
                <span className="muted small">
                  {p.lastUsedAt ? `Last used ${new Date(p.lastUsedAt).toLocaleDateString()}` : "Never used"}
                </span>
                <button
                  type="button"
                  className="passkey-delete-btn"
                  aria-label={`Remove passkey for ${p.nickname || "this device"}`}
                  onClick={() => handleDeletePasskey(p.id, p.nickname)}
                  disabled={deletingPasskeyId === p.id}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}

        {isWebAuthnSupported() ? (
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            onClick={handleRegisterPasskey}
            disabled={registeringPasskey}
          >
            {registeringPasskey
              ? "Registering…"
              : user?.passkeyRegistered
              ? "Register a Passkey on This Device"
              : "Register Passkey"}
          </button>
        ) : (
          <p className="muted small" style={{ marginTop: 14 }}>
            Passkeys aren't supported on this browser or device.
          </p>
        )}

        {user?.passkeyRegistered && (
          <p className="muted small" style={{ marginTop: 10 }}>
            Using a new phone or laptop? Register a separate passkey for each device you'll use to
            check in from.
          </p>
        )}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Change Password</h3>
        </div>
        {passwordError && <div className="form-error-banner">{passwordError}</div>}
        <form className="stacked-form" onSubmit={handlePasswordSubmit}>
          <label htmlFor="currentPassword">Current Password</label>
          <input
            id="currentPassword"
            type="password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
          <label htmlFor="newPassword">New Password</label>
          <input
            id="newPassword"
            type="password"
            required
            minLength={8}
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
          <label htmlFor="confirmNewPassword">Confirm New Password</label>
          <input
            id="confirmNewPassword"
            type="password"
            required
            minLength={8}
            value={passwordForm.confirmNewPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, confirmNewPassword: e.target.value }))}
          />
          <button type="submit" className="btn btn-primary" disabled={passwordSubmitting}>
            {passwordSubmitting ? "Updating…" : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function resolveUploadUrl(path) {
  const base = API_URL.replace(/\/api\/?$/, "");
  return `${base}${path}`;
}

function initials(name) {
  if (!name) return "";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
