import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Edit3,
  Mail,
  Phone,
  CreditCard,
  User,
  Fingerprint,
  Plus,
  Lock,
  Key,
  Info,
  Laptop,
  Smartphone,
  Monitor,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import {
  uploadMyProfilePhoto,
  updateMyProfile,
} from "../../Services/employeeService";
import {
  registerPasskey,
  listPasskeys,
  deletePasskey,
  isWebAuthnSupported,
  guessDeviceNickname,
} from "../../Services/passkeyService";
import { extractErrorMessage } from "../../Utils/validation";
import { API_URL } from "../../Utils/constants";
import EditProfileModal from "../../Components/Profile/EditProfileModal";
import ChangePasswordModal from "../../Components/Profile/ChangePasswordModal";
import EmptyState from "../../Components/Common/EmptyState";
import "../../Styles/EmployeeProfile.css";

const MAX_PASSKEY_DEVICES = 2;

export default function EmployeeProfile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [registeringPasskey, setRegisteringPasskey] = useState(false);
  const [passkeys, setPasskeys] = useState(null);

  // Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // Fetch registered passkeys
  useEffect(() => {
    listPasskeys()
      .then((data) => {
        if (Array.isArray(data)) setPasskeys(data);
      })
      .catch(() => setPasskeys([]));
  }, [user?.passkeyRegistered]);

  const photoUrl = user?.profilePhoto ? resolveUploadUrl(user.profilePhoto) : null;

  // Handle Profile Photo Upload
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
      toast.success("Profile photo updated successfully.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  // Handle Edit Profile Save
  const handleSaveProfile = async (payload) => {
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile(payload);
      updateUser(updated);
      toast.success("Profile details updated.");
      setShowEditModal(false);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not update profile."));
    } finally {
      setSavingProfile(false);
    }
  };

  // Register New Passkey Device
  const handleRegisterPasskey = async () => {
    if (!isWebAuthnSupported()) {
      toast.error("WebAuthn is not supported on this browser or device.");
      return;
    }
    if ((passkeys?.length || 0) >= MAX_PASSKEY_DEVICES) {
      toast.error(`You can only register up to ${MAX_PASSKEY_DEVICES} passkey devices. Remove one first.`);
      return;
    }

    setRegisteringPasskey(true);
    try {
      const nickname = guessDeviceNickname();
      await registerPasskey(nickname);
      updateUser({ passkeyRegistered: true });
      toast.success(`Passkey registered for ${nickname}.`);
      const updated = await listPasskeys().catch(() => null);
      if (updated) setPasskeys(updated);
    } catch (err) {
      toast.error(err.message || "Passkey registration failed.");
    } finally {
      setRegisteringPasskey(false);
    }
  };

  // Delete Passkey Device
  const handleDeletePasskey = async (id, nickname) => {
    if (
      !window.confirm(
        `Remove the passkey for "${nickname || "this device"}"? You will need to register it again to check in.`
      )
    ) {
      return;
    }

    try {
      const result = await deletePasskey(id);
      updateUser({ passkeyRegistered: result.passkeyRegistered });
      const updated = await listPasskeys().catch(() => null);
      if (updated) setPasskeys(updated);
      toast.success("Passkey device removed.");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not remove passkey."));
    }
  };

  const displayDevices = (passkeys || []).map((p) => {
    const nick = p.nickname || "Registered Device";
    const isPhone = /iphone|android|mobile|ipad/i.test(nick);
    const isMac = /mac|macbook|apple/i.test(nick);
    const iconType = isPhone ? "phone" : isMac ? "laptop" : "desktop";
    const type = isPhone ? "Biometric (Face ID)" : "Device Passkey";
    const typeClass = isPhone ? "biometric" : "passkey";
    const regDate = p.createdAt ? formatPrettyDate(p.createdAt) : "Recently";
    const lastDate = p.lastUsedAt ? formatPrettyDate(p.lastUsedAt) : "Never used";
    const lastTime = p.lastUsedAt ? formatPrettyTime(p.lastUsedAt) : "";

    return {
      id: p.id,
      nickname: nick,
      meta: guessDeviceOS(nick),
      type,
      typeClass,
      iconType,
      registeredOn: regDate,
      lastUsed: lastDate,
      lastUsedTime: lastTime,
    };
  });

  return (
    <div className="emp-profile-container">
      {/* ── Page Header & Breadcrumb ── */}
      <div className="emp-profile-header">
        <div className="emp-profile-title-wrap">
          <h1>My Profile</h1>
          <p>
            View and manage your profile information, security settings and registered devices.
          </p>
        </div>
        <div className="emp-profile-breadcrumb">
          <span>Profile</span>
          <span className="sep">&gt;</span>
          <strong>My Profile</strong>
        </div>
      </div>

      {/* ── Main Two-Column Grid ── */}
      <div className="emp-profile-grid">
        {/* ══════════════════════════ LEFT COLUMN: PROFILE INFO ══════════════════════════ */}
        <div className="emp-card emp-profile-card">
          {/* Card Header */}
          <div className="emp-card-header-row">
            <div className="emp-card-title-group">
              <div className="emp-card-header-icon">
                <User size={20} />
              </div>
              <div className="emp-card-titles">
                <h3>Profile Information</h3>
              </div>
            </div>

            <button
              type="button"
              className="emp-btn-outline"
              onClick={() => setShowEditModal(true)}
            >
              <Edit3 size={14} />
              <span>Edit</span>
            </button>
          </div>

          {/* Avatar Center */}
          <div className="emp-profile-avatar-sec">
            <div className="emp-avatar-frame">
              {photoUrl ? (
                <img src={photoUrl} alt={user?.name} className="emp-avatar-img" />
              ) : (
                <div className="emp-avatar-fallback">
                  {initials(user?.name || "Soudip Panja")}
                </div>
              )}

              {/* Overlapping Camera Trigger */}
              <button
                type="button"
                className="emp-camera-trigger"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Change profile photo"
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

            <h2 className="emp-profile-name">{user?.name || "Soudip Panja"}</h2>
            <div className={`emp-status-pill ${user?.isActive === false ? "inactive" : ""}`}>
              <span className="emp-status-dot" />
              <span>{user?.isActive === false ? "Inactive" : "Active"}</span>
            </div>
          </div>

          {/* Profile Details List */}
          <div className="emp-details-list">
            {/* 1. Employee ID */}
            <div className="emp-detail-row">
              <div className="emp-detail-label-group">
                <CreditCard size={18} />
                <span>Employee ID</span>
              </div>
              <span className="emp-detail-val">{user?.employeeId || "EMP1024"}</span>
            </div>

            {/* 2. Organization Email */}
            <div className="emp-detail-row">
              <div className="emp-detail-label-group">
                <Mail size={18} />
                <span>Organization Email</span>
              </div>
              <span className="emp-detail-val">{user?.email || "soudip.panja@intime.com"}</span>
            </div>

            {/* 3. Phone Number */}
            <div className="emp-detail-row">
              <div className="emp-detail-label-group">
                <Phone size={18} />
                <span>Phone Number</span>
              </div>
              <span className="emp-detail-val">{user?.phone || "+91 98765 43210"}</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════ RIGHT COLUMN: PASSKEYS & PASSWORD ══════════════════════════ */}
        <div className="emp-right-column">
          {/* ── Top Card: Registered Passkey Devices ── */}
          <div className="emp-card emp-passkeys-card">
            <div className="emp-card-header-row">
              <div className="emp-card-title-group">
                <div className="emp-card-header-icon dark">
                  <Fingerprint size={20} />
                </div>
                <div className="emp-card-titles">
                  <h3>Registered Passkey Devices</h3>
                  <p>Manage your registered biometrics / device passkeys for secure login.</p>
                </div>
              </div>

              <button
                type="button"
                className="emp-btn-outline"
                onClick={handleRegisterPasskey}
                disabled={registeringPasskey || (passkeys?.length || 0) >= MAX_PASSKEY_DEVICES}
                title={
                  (passkeys?.length || 0) >= MAX_PASSKEY_DEVICES
                    ? `Maximum of ${MAX_PASSKEY_DEVICES} devices reached`
                    : undefined
                }
              >
                <Plus size={15} />
                <span>{registeringPasskey ? "Registering…" : "Register New Device"}</span>
              </button>
            </div>

            {/* Devices Table */}
            {passkeys === null ? (
              <div className="spinner" style={{ margin: "24px auto" }} />
            ) : displayDevices.length === 0 ? (
              <EmptyState icon={Fingerprint} title="No passkey devices registered yet" />
            ) : (
              <div className="emp-devices-table-wrap">
                <table className="emp-devices-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Type</th>
                      <th>Registered On</th>
                      <th>Last Used</th>
                      <th style={{ textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayDevices.map((device) => (
                      <tr key={device.id}>
                        {/* Device Icon + Name */}
                        <td>
                          <div className="emp-device-cell">
                            <div className="emp-device-icon-box">
                              {device.iconType === "phone" ? (
                                <Smartphone size={18} />
                              ) : device.iconType === "laptop" ? (
                                <Laptop size={18} />
                              ) : (
                                <Monitor size={18} />
                              )}
                            </div>
                            <div className="emp-device-name-wrap">
                              <span className="emp-device-name">{device.nickname}</span>
                              <span className="emp-device-meta">{device.meta}</span>
                            </div>
                          </div>
                        </td>

                        {/* Type Badge */}
                        <td>
                          <span className={`emp-type-badge ${device.typeClass}`}>
                            {device.type}
                          </span>
                        </td>

                        {/* Registered On */}
                        <td>{device.registeredOn}</td>

                        {/* Last Used */}
                        <td>
                          <div>{device.lastUsed}</div>
                          {device.lastUsedTime && (
                            <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                              {device.lastUsedTime}
                            </div>
                          )}
                        </td>

                        {/* Action: direct delete */}
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            className="emp-action-delete-btn"
                            aria-label={`Remove ${device.nickname}`}
                            title={`Remove ${device.nickname}`}
                            onClick={() => handleDeletePasskey(device.id, device.nickname)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Bottom Card: Account Password ── */}
          <div className="emp-card emp-password-card">
            <div className="emp-card-header-row">
              <div className="emp-card-title-group">
                <div className="emp-card-header-icon">
                  <Lock size={20} />
                </div>
                <div className="emp-card-titles">
                  <h3>Account Password</h3>
                  <p>Keep your account secure by resetting your password regularly.</p>
                </div>
              </div>

              <button
                type="button"
                className="emp-btn-outline"
                onClick={() => setShowPasswordModal(true)}
              >
                <Key size={14} />
                <span>Reset Password</span>
              </button>
            </div>

            {/* Password Tips Container */}
            <div className="emp-pw-tips-box">
              <Info size={19} className="emp-pw-tips-icon" />
              <div className="emp-pw-tips-content">
                <div className="emp-pw-tips-title">Password Tips</div>
                <ul className="emp-pw-tips-list">
                  <li>Use at least 8 characters</li>
                  <li>Include a mix of letters, numbers and special characters</li>
                  <li>Avoid using personal information</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Profile Modal ── */}
      <EditProfileModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={{
          name: user?.name,
          phone: user?.phone,
        }}
        onSave={handleSaveProfile}
        loading={savingProfile}
      />

      {/* ── Reset Password Modal ── */}
      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
      />
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────────────── */
function resolveUploadUrl(path) {
  const base = API_URL.replace(/\/api\/?$/, "");
  return `${base}${path}`;
}

function initials(name) {
  if (!name) return "SP";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatPrettyDate(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPrettyTime(dateInput) {
  if (!dateInput) return "";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function guessDeviceOS(nickname = "") {
  const n = nickname.toLowerCase();
  if (n.includes("mac")) return "Chrome • macOS";
  if (n.includes("iphone") || n.includes("ios")) return "InTime App • iOS";
  if (n.includes("android")) return "Chrome • Android";
  if (n.includes("windows")) return "Edge • Windows";
  return "Chrome • Desktop";
}
