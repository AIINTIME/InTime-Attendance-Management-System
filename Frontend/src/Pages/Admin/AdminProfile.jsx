import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import { uploadAdminProfilePhoto, changeAdminPassword, updateAdminProfile } from "../../Services/adminService";
import { extractErrorMessage } from "../../Utils/validation";
import { API_URL } from "../../Utils/constants";

export default function AdminProfile() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState(user?.name || "");
  const [savingName, setSavingName] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const photoUrl = user?.profilePhoto ? `${API_URL.replace(/\/api\/?$/, "")}${user.profilePhoto}` : null;

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    setUploading(true);
    try {
      const profilePhoto = await uploadAdminProfilePhoto(file);
      updateUser({ profilePhoto });
      toast.success("Profile photo updated.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setSavingName(true);
    try {
      const updated = await updateAdminProfile({ name });
      updateUser(updated);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSavingName(false);
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
      await changeAdminPassword(passwordForm);
      toast.success("Password changed successfully.");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setPasswordError(extractErrorMessage(err));
    } finally {
      setPasswordSubmitting(false);
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
          <button type="button" className="photo-upload-btn" onClick={() => fileInputRef.current?.click()} disabled={uploading} aria-label="Change profile photo">
            <Camera size={16} />
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handlePhotoChange} />
        </div>

        <form className="stacked-form profile-details" onSubmit={handleNameSubmit}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
          <label>Admin Email</label>
          <input value={user?.email || ""} disabled />
          <button type="submit" className="btn btn-primary" disabled={savingName}>
            {savingName ? "Saving…" : "Save Changes"}
          </button>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Change Password</h3>
        </div>
        {passwordError && <div className="form-error-banner">{passwordError}</div>}
        <form className="stacked-form" onSubmit={handlePasswordSubmit}>
          <label>Current Password</label>
          <input
            type="password"
            required
            value={passwordForm.currentPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
          />
          <label>New Password</label>
          <input
            type="password"
            required
            minLength={8}
            value={passwordForm.newPassword}
            onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
          />
          <label>Confirm New Password</label>
          <input
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

function initials(name) {
  if (!name) return "";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
