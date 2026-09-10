import { useRef, useState, useEffect } from "react";
import {
  Camera,
  User,
  Briefcase,
  Mail,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  Pencil,
  Check,
  X,
  Info,
  KeyRound,
  Image as ImageIcon,
  Trash2,
  Upload,
} from "lucide-react";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import {
  uploadAdminProfilePhoto,
  deleteAdminProfilePhoto,
  changeAdminPassword,
  updateAdminProfile,
} from "../../Services/adminService";
import { extractErrorMessage } from "../../Utils/validation";
import { API_URL } from "../../Utils/constants";
import "../../Styles/AdminProfile.css";

function initials(name) {
  if (!name) return "A";
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);

  // Avatar upload / preview state
  const [uploading, setUploading] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState(null);
  const [removePhotoRequested, setRemovePhotoRequested] = useState(false);

  // Edit Personal Information state (all fields editable)
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || "Tanuka Keshari");
  const [designation, setDesignation] = useState(user?.designation || "senior hr");
  const [email, setEmail] = useState(user?.email || "tanuka@intimeinc.co.in");
  const [roleTitle, setRoleTitle] = useState(
    user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Admin"
  );
  const [savingProfile, setSavingProfile] = useState(false);

  // Synchronize state when user data is loaded from API
  useEffect(() => {
    if (user && !isEditing) {
      setName(user.name || "Tanuka Keshari");
      setDesignation(user.designation || "senior hr");
      setEmail(user.email || "tanuka@intimeinc.co.in");
      setRoleTitle(
        user.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Admin"
      );
    }
  }, [user, isEditing]);

  // Clean up object URL preview on unmount or reset
  useEffect(() => {
    return () => {
      if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
    };
  }, [previewPhotoUrl]);

  // Password Form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const savedPhotoUrl = user?.profilePhoto
    ? user.profilePhoto.startsWith("http")
      ? user.profilePhoto
      : `${API_URL.replace(/\/api\/?$/, "")}${user.profilePhoto}`
    : null;

  // Active avatar taking into account pending edit preview and removal request
  const activePhotoUrl = removePhotoRequested
    ? null
    : previewPhotoUrl || savedPhotoUrl;

  // Handle Photo Selection / Upload
  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error("File size must be under 3MB.");
      return;
    }

    if (isEditing) {
      // In edit mode: preview locally and stage for Save
      if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
      const preview = URL.createObjectURL(file);
      setPreviewPhotoUrl(preview);
      setPendingPhotoFile(file);
      setRemovePhotoRequested(false);
      toast.info("Image selected! Click 'Save' to apply changes.");
    } else {
      // Direct quick upload outside edit mode
      setUploading(true);
      try {
        const res = await uploadAdminProfilePhoto(file);
        updateUser(res.user || { profilePhoto: res.profilePhoto });
        toast.success("Profile photo updated successfully.");
      } catch (err) {
        toast.error(extractErrorMessage(err));
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    }
  };

  // Handle Photo Removal
  const handleRemovePhoto = async () => {
    if (isEditing) {
      if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
      setPreviewPhotoUrl(null);
      setPendingPhotoFile(null);
      setRemovePhotoRequested(true);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.info("Profile photo marked for removal. Click 'Save' to apply.");
    } else {
      if (!user?.profilePhoto) return;
      setUploading(true);
      try {
        const res = await deleteAdminProfilePhoto();
        updateUser(res.user || { profilePhoto: "" });
        toast.success("Profile photo removed.");
      } catch (err) {
        toast.error(extractErrorMessage(err));
      } finally {
        setUploading(false);
      }
    }
  };

  // Handle Personal Info Save (all fields: name, designation, email, profile image)
  const handleProfileSave = async (e) => {
    if (e) e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Name must be at least 2 characters.");
      return;
    }
    if (!designation.trim()) {
      toast.error("Designation cannot be empty.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please provide a valid email address.");
      return;
    }

    setSavingProfile(true);
    try {
      let freshUserObj = null;

      // 1. Process profile image change if staged
      if (pendingPhotoFile) {
        const photoRes = await uploadAdminProfilePhoto(pendingPhotoFile);
        if (photoRes?.user) freshUserObj = photoRes.user;
      } else if (removePhotoRequested) {
        const delRes = await deleteAdminProfilePhoto();
        if (delRes?.user) freshUserObj = delRes.user;
      }

      // 2. Save text profile fields (name, designation, email)
      const updatedUser = await updateAdminProfile({
        name: name.trim(),
        designation: designation.trim(),
        email: email.trim().toLowerCase(),
      });

      updateUser({ ...(freshUserObj || {}), ...updatedUser });
      toast.success("Profile updated successfully.");

      // Reset staging state
      if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewPhotoUrl);
      }
      setPreviewPhotoUrl(null);
      setPendingPhotoFile(null);
      setRemovePhotoRequested(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setIsEditing(false);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    if (previewPhotoUrl && previewPhotoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewPhotoUrl);
    }
    setPreviewPhotoUrl(null);
    setPendingPhotoFile(null);
    setRemovePhotoRequested(false);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setName(user?.name || "Tanuka Keshari");
    setDesignation(user?.designation || "senior hr");
    setEmail(user?.email || "tanuka@intimeinc.co.in");
    setRoleTitle(
      user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Admin"
    );
    setIsEditing(false);
  };

  // Handle Password Submit
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");

    const { currentPassword, newPassword, confirmNewPassword } = passwordForm;

    if (!currentPassword) {
      setPasswordError("Current password is required.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Z]/.test(newPassword)) {
      setPasswordError("New password must include at least one uppercase letter.");
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setPasswordError("New password must include at least one number.");
      return;
    }

    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setPasswordError("New password must include at least one special character.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    setPasswordSubmitting(true);
    try {
      await changeAdminPassword(passwordForm);
      toast.success("Password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setPasswordError(extractErrorMessage(err));
    } finally {
      setPasswordSubmitting(false);
    }
  };

  const displayName = user?.name || name || "Tanuka Keshari";
  const displayRole = user?.designation || designation || "senior hr";
  const displayEmail = user?.email || email || "tanuka@intimeinc.co.in";
  const displayRoleType = roleTitle || "Admin";

  return (
    <div className="admin-profile-page-container">
      {/* ── Page Header: Title & Subtitle + Breadcrumbs ── */}
      <div className="admin-profile-header-row">
        <div className="admin-profile-title-area">
          <h1 className="admin-profile-main-title">My Profile</h1>
          <p className="admin-profile-main-subtitle">
            Manage your personal information and account settings.
          </p>
        </div>

        <div className="admin-profile-breadcrumb">
          <span>Profile</span>
          <span className="admin-profile-breadcrumb-sep">&gt;</span>
          <span className="admin-profile-breadcrumb-current">My Profile</span>
        </div>
      </div>

      {/* ── Top Card: Avatar Banner + Personal Information ── */}
      <div className="admin-profile-card">
        {/* Left Column: Avatar & Overview */}
        <div className="admin-profile-left-col">
          {/* Wave Banner */}
          <div className="admin-profile-wave-banner">
            <svg
              className="admin-profile-wave-svg"
              viewBox="0 0 320 80"
              preserveAspectRatio="none"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M0 25C50 45 110 50 160 30C220 5 280 20 320 40V80H0V25Z"
                fill="#FFFFFF"
                fillOpacity="0.45"
              />
              <path
                d="M0 45C60 65 140 30 200 45C260 60 290 50 320 40V80H0V45Z"
                fill="#FFFFFF"
              />
            </svg>
          </div>

          {/* Avatar with Camera Icon */}
          <div className={`admin-profile-avatar-wrap ${isEditing ? "editing" : ""}`}>
            {activePhotoUrl ? (
              <img
                src={activePhotoUrl}
                alt={displayName}
                className="admin-profile-avatar-img"
              />
            ) : (
              <div className="admin-profile-avatar-circle">
                {initials(displayName)}
              </div>
            )}

            <button
              type="button"
              className="admin-profile-camera-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || savingProfile}
              title={activePhotoUrl ? "Change profile photo" : "Upload profile photo"}
              aria-label="Change profile photo"
            >
              <Camera size={14} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={handlePhotoChange}
            />
          </div>

          {/* Details below avatar */}
          <div className="admin-profile-left-meta">
            <h3 className="admin-profile-meta-name">{isEditing ? name : displayName}</h3>
            <span className="admin-profile-meta-role">{isEditing ? designation : displayRole}</span>
            <div className="admin-profile-active-pill">
              <span className="admin-profile-active-dot" />
              <span>Active</span>
            </div>

            {/* In Edit mode: explicit Photo action buttons */}
            {isEditing && (
              <div className="admin-profile-avatar-edit-actions">
                <button
                  type="button"
                  className="admin-profile-photo-change-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || savingProfile}
                >
                  <Upload size={13} />
                  <span>{activePhotoUrl ? "Change Photo" : "Upload Photo"}</span>
                </button>
                {activePhotoUrl && (
                  <button
                    type="button"
                    className="admin-profile-photo-remove-btn"
                    onClick={handleRemovePhoto}
                    disabled={uploading || savingProfile}
                    title="Remove Photo"
                  >
                    <Trash2 size={13} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Personal Information Rows */}
        <div className="admin-profile-right-col">
          <div className="admin-profile-section-header">
            <div className="admin-profile-section-title-wrap">
              <User size={22} className="admin-profile-section-icon" />
              <div className="admin-profile-section-text">
                <h2>Personal Information</h2>
                <p>Keep your basic details up to date.</p>
              </div>
            </div>

            {isEditing ? (
              <div className="admin-profile-edit-actions">
                <button
                  type="button"
                  className="admin-profile-cancel-btn"
                  onClick={handleCancelEdit}
                  disabled={savingProfile}
                >
                  <X size={14} />
                  <span>Cancel</span>
                </button>
                <button
                  type="button"
                  className="admin-profile-save-btn"
                  onClick={handleProfileSave}
                  disabled={savingProfile}
                >
                  <Check size={14} />
                  <span>{savingProfile ? "Saving…" : "Save"}</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="admin-profile-edit-btn"
                onClick={() => setIsEditing(true)}
              >
                <Pencil size={13} />
                <span>Edit</span>
              </button>
            )}
          </div>

          {/* 5 Rounded Striped Info Rows (All Editable) */}
          <div className="admin-profile-info-list">
            {/* Row 1: Name */}
            <div className="admin-profile-info-row">
              <div className="admin-profile-info-label-box">
                <User size={16} className="admin-profile-info-icon" />
                <span>Name</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  className="admin-profile-inline-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter name"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProfileSave();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
              ) : (
                <span className="admin-profile-info-value">{displayName}</span>
              )}
            </div>

            {/* Row 2: Designation */}
            <div className="admin-profile-info-row">
              <div className="admin-profile-info-label-box">
                <Briefcase size={16} className="admin-profile-info-icon" />
                <span>Designation</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  className="admin-profile-inline-input"
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Enter designation (e.g. senior hr)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProfileSave();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
              ) : (
                <span className="admin-profile-info-value">{displayRole}</span>
              )}
            </div>

            {/* Row 3: Admin Email */}
            <div className="admin-profile-info-row">
              <div className="admin-profile-info-label-box">
                <Mail size={16} className="admin-profile-info-icon" />
                <span>Admin Email</span>
              </div>
              {isEditing ? (
                <input
                  type="email"
                  className="admin-profile-inline-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter admin email"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProfileSave();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
              ) : (
                <span className="admin-profile-info-value">{displayEmail}</span>
              )}
            </div>

            {/* Row 4: Role */}
            <div className="admin-profile-info-row">
              <div className="admin-profile-info-label-box">
                <ShieldCheck size={16} className="admin-profile-info-icon" />
                <span>Role</span>
              </div>
              {isEditing ? (
                <input
                  type="text"
                  className="admin-profile-inline-input"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="Enter role (e.g. Admin)"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleProfileSave();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
              ) : (
                <span className="admin-profile-info-value">{displayRoleType}</span>
              )}
            </div>

            {/* Row 5: Profile Image */}
            <div className="admin-profile-info-row admin-profile-photo-row">
              <div className="admin-profile-info-label-box">
                <ImageIcon size={16} className="admin-profile-info-icon" />
                <span>Profile Image</span>
              </div>
              <div className="admin-profile-photo-row-content">
                <div className="admin-profile-photo-thumb-wrap">
                  {activePhotoUrl ? (
                    <img
                      src={activePhotoUrl}
                      alt="Thumbnail"
                      className="admin-profile-photo-thumb-img"
                    />
                  ) : (
                    <div className="admin-profile-photo-thumb-circle">
                      {initials(displayName)}
                    </div>
                  )}
                  <span className="admin-profile-photo-status-text">
                    {pendingPhotoFile
                      ? "New photo selected (unsaved)"
                      : removePhotoRequested
                      ? "Photo removed (unsaved)"
                      : activePhotoUrl
                      ? "Custom photo uploaded"
                      : "Default avatar"}
                  </span>
                </div>

                <div className="admin-profile-photo-btns">
                  <button
                    type="button"
                    className="admin-profile-inline-photo-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || savingProfile}
                  >
                    <Upload size={12} />
                    <span>{activePhotoUrl ? "Change" : "Upload"}</span>
                  </button>
                  {activePhotoUrl && (
                    <button
                      type="button"
                      className="admin-profile-inline-remove-btn"
                      onClick={handleRemovePhoto}
                      disabled={uploading || savingProfile}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom Card: Change Password ── */}
      <div className="admin-password-card">
        <div className="admin-password-card-header">
          <div className="admin-password-header-icon-box">
            <Lock size={19} />
          </div>
          <div className="admin-password-header-text">
            <h2>Change Password</h2>
            <p>Update your account password to keep your account secure.</p>
          </div>
        </div>

        {passwordError && (
          <div className="admin-password-error-banner">{passwordError}</div>
        )}

        <form className="admin-password-form" onSubmit={handlePasswordSubmit}>
          {/* Row 1: Current Password & New Password */}
          <div className="admin-password-row-two-col">
            <div className="admin-password-field">
              <label>Current Password</label>
              <div className="admin-password-input-wrap">
                <Lock size={15} className="admin-password-lock-icon" />
                <input
                  type={showCurrentPw ? "text" : "password"}
                  className="admin-password-input"
                  placeholder="Enter current password"
                  required
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="admin-password-eye-btn"
                  onClick={() => setShowCurrentPw((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showCurrentPw ? "Hide password" : "Show password"}
                >
                  {showCurrentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="admin-password-field">
              <label>New Password</label>
              <div className="admin-password-input-wrap">
                <Lock size={15} className="admin-password-lock-icon" />
                <input
                  type={showNewPw ? "text" : "password"}
                  className="admin-password-input"
                  placeholder="Enter new password"
                  required
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))
                  }
                />
                <button
                  type="button"
                  className="admin-password-eye-btn"
                  onClick={() => setShowNewPw((prev) => !prev)}
                  tabIndex={-1}
                  aria-label={showNewPw ? "Hide password" : "Show password"}
                >
                  {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </div>

          {/* Row 2: Confirm New Password */}
          <div className="admin-password-field">
            <label>Confirm New Password</label>
            <div className="admin-password-input-wrap">
              <Lock size={15} className="admin-password-lock-icon" />
              <input
                type={showConfirmPw ? "text" : "password"}
                className="admin-password-input"
                placeholder="Confirm new password"
                required
                value={passwordForm.confirmNewPassword}
                onChange={(e) =>
                  setPasswordForm((f) => ({
                    ...f,
                    confirmNewPassword: e.target.value,
                  }))
                }
              />
              <button
                type="button"
                className="admin-password-eye-btn"
                onClick={() => setShowConfirmPw((prev) => !prev)}
                tabIndex={-1}
                aria-label={showConfirmPw ? "Hide password" : "Show password"}
              >
                {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Bottom Row: Password Requirements (Left) & Action Button (Right) */}
          <div className="admin-password-bottom-row">
            <div className="admin-password-requirements-box">
              <div className="admin-password-req-title">
                <Info size={16} className="admin-password-req-icon" />
                <span>Password Requirements</span>
              </div>
              <ul className="admin-password-req-list">
                <li>At least 8 characters long</li>
                <li>Include at least one uppercase letter</li>
                <li>Include at least one number</li>
                <li>Include at least one special character (e.g. ! @ # $ %)</li>
              </ul>
            </div>

            <button
              type="submit"
              className="admin-password-submit-btn"
              disabled={passwordSubmitting}
            >
              <KeyRound size={16} />
              <span>{passwordSubmitting ? "Updating…" : "Change Password"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
