import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  KeyRound,
  Copy,
  Check,
} from "lucide-react";
import { useToast } from "../../Context/ToastContext";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  setEmployeeStatus,
  resetEmployeePassword,
} from "../../Services/adminService";
import { API_URL } from "../../Utils/constants";
import "../../Styles/EmployeeManagement.css";

const DEPARTMENTS = [
  "HR",
  "Sales",
  "SAP",
  "AI",
  "Marketing",
  "PMO",
  "Video Editing",
];

const DEPARTMENT_STYLES = {
  "HR": { bg: "#FFE4E6", color: "#E11D48" },
  "Sales": { bg: "#DCFCE7", color: "#16A34A" },
  "SAP": { bg: "#E0EFFF", color: "#0074F1" },
  "AI": { bg: "#F3E8FF", color: "#9333EA" },
  "Marketing": { bg: "#DCFCE7", color: "#15803D" },
  "PMO": { bg: "#FEF3C7", color: "#D97706" },
  "Video Editing": { bg: "#CCFBF1", color: "#0D9488" },
};

const INITIALS_PALETTE = [
  { bg: "#DBEAFE", color: "#1D4ED8" },
  { bg: "#F3E8FF", color: "#7E22CE" },
  { bg: "#CCFBF1", color: "#0F766E" },
  { bg: "#E0E7FF", color: "#4338CA" },
  { bg: "#FEF3C7", color: "#B45309" },
  { bg: "#FFE4E6", color: "#BE123C" },
];

function initialsStyleFor(name) {
  const letter = (name || "?").trim().charAt(0).toUpperCase();
  const index = letter.charCodeAt(0) % INITIALS_PALETTE.length;
  return { letter, ...INITIALS_PALETTE[index] };
}

function photoUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL.replace(/\/api\/?$/, "")}${path}`;
}

const EMPTY_FORM = {
  name: "",
  department: DEPARTMENTS[0],
  designation: "",
  email: "",
  phone: "",
};

export default function EmployeeManagement() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);
  const [resetPasswordEmployee, setResetPasswordEmployee] = useState(null);
  const [credentials, setCredentials] = useState(null); // { employeeId, name, temporaryPassword }
  const [copied, setCopied] = useState(false);

  // Form State
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    setLoading(true);
    try {
      const data = await listEmployees({ isActive: true, limit: 100 });
      setEmployees(data.employees);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load employees.");
    } finally {
      setLoading(false);
    }
  }

  // Open Add Modal
  const handleOpenAddModal = () => {
    setForm(EMPTY_FORM);
    setShowAddModal(true);
  };

  // Handle Add Submit
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.designation.trim()) {
      toast.error("Please fill in the required fields (Name, Email and Designation).");
      return;
    }

    setSaving(true);
    try {
      const employee = await createEmployee({
        name: form.name.trim(),
        email: form.email.trim(),
        department: form.department,
        designation: form.designation.trim(),
        phone: form.phone.trim(),
      });

      setEmployees((prev) => [employee, ...prev]);
      setShowAddModal(false);
      setForm(EMPTY_FORM);
      setCopied(false);
      setCredentials({
        employeeId: employee.employeeId,
        name: employee.name,
        temporaryPassword: "Welcome@26INT",
      });
      toast.success(`Employee ${employee.name} added successfully.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create employee.");
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (emp) => {
    setEditingEmployee(emp);
    setForm({
      name: emp.name,
      department: emp.department,
      designation: emp.designation || "",
      email: emp.email,
      phone: emp.phone || "",
    });
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.designation.trim()) {
      toast.error("Please fill in the required fields (Name and Designation).");
      return;
    }

    setSaving(true);
    try {
      const updated = await updateEmployee(editingEmployee._id, {
        name: form.name.trim(),
        department: form.department,
        designation: form.designation.trim(),
        phone: form.phone.trim(),
      });

      setEmployees((prev) => prev.map((emp) => (emp._id === updated._id ? updated : emp)));
      toast.success(`Updated ${updated.name} successfully.`);
      setEditingEmployee(null);
      setForm(EMPTY_FORM);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update employee.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Delete (deactivate -- attendance history is preserved)
  const handleConfirmDelete = async () => {
    if (!deletingEmployee) return;
    setSaving(true);
    try {
      await setEmployeeStatus(deletingEmployee._id, false);
      setEmployees((prev) => prev.filter((e) => e._id !== deletingEmployee._id));
      toast.success(`${deletingEmployee.name} has been removed.`);
      setDeletingEmployee(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete employee.");
    } finally {
      setSaving(false);
    }
  };

  // Handle Password Reset (resets to the standard default password)
  const handleConfirmResetPassword = async () => {
    if (!resetPasswordEmployee) return;
    setSaving(true);
    try {
      await resetEmployeePassword(resetPasswordEmployee._id);
      setCopied(false);
      setCredentials({
        employeeId: resetPasswordEmployee.employeeId,
        name: resetPasswordEmployee.name,
        temporaryPassword: "Welcome@26INT",
      });
      toast.success(`Password reset for ${resetPasswordEmployee.name}.`);
      setResetPasswordEmployee(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyPassword = async () => {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(credentials.temporaryPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy automatically -- please select and copy manually.");
    }
  };

  return (
    <div className="emp-page-container">
      {/* ══════════════════════════ PAGE HEADER ══════════════════════════ */}
      <div className="emp-page-header">
        <div className="emp-header-left">
          <div className="emp-title-badge-row">
            <h1 className="emp-page-title">Employees</h1>
            <span className="emp-count-badge">{employees.length} Employees</span>
          </div>
          <p className="emp-page-subtitle">Manage your team members and their access.</p>
        </div>
        <button
          type="button"
          className="emp-add-btn"
          onClick={handleOpenAddModal}
        >
          <Plus size={16} strokeWidth={2.4} />
          <span>Add Employee</span>
        </button>
      </div>

      {/* ══════════════════════════ DATA TABLE CARD ══════════════════════════ */}
      <div className="emp-card">
        <div className="emp-table-wrap">
          <table className="emp-table">
            <thead>
              <tr>
                <th style={{ width: 48, paddingLeft: 24 }}>#</th>
                <th>Employee</th>
                <th>Employee ID</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Email</th>
                <th>Phone</th>
                <th style={{ textAlign: "left", minWidth: 320 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#64748B" }}>
                    Loading employees…
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 32, textAlign: "center", color: "#64748B" }}>
                    No employees yet. Click "Add Employee" to create the first one.
                  </td>
                </tr>
              ) : (
                employees.map((emp, index) => {
                  const globalIndex = index + 1;
                  const deptStyle = DEPARTMENT_STYLES[emp.department] || {
                    bg: "#F1F5F9",
                    color: "#475569",
                  };
                  const initials = initialsStyleFor(emp.name);

                  return (
                    <tr key={emp._id}>
                      <td className="emp-index-cell" style={{ paddingLeft: 24 }}>{globalIndex}</td>

                      {/* Employee with avatar or initials */}
                      <td>
                        <div className="emp-profile-cell">
                          {emp.profilePhoto ? (
                            <img
                              src={photoUrl(emp.profilePhoto)}
                              alt={emp.name}
                              className="emp-avatar-img"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                if (e.currentTarget.nextSibling) {
                                  e.currentTarget.nextSibling.style.display = "flex";
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className="emp-avatar-initials"
                            style={{
                              display: emp.profilePhoto ? "none" : "flex",
                              backgroundColor: initials.bg,
                              color: initials.color,
                            }}
                          >
                            {initials.letter}
                          </div>
                          <span className="emp-name-text">{emp.name}</span>
                        </div>
                      </td>

                      <td className="emp-id-text">{emp.employeeId}</td>
                      <td>
                        <span
                          className="emp-dept-pill"
                          style={{
                            backgroundColor: deptStyle.bg,
                            color: deptStyle.color,
                          }}
                        >
                          {emp.department}
                        </span>
                      </td>
                      <td className="emp-email-text">{emp.designation}</td>
                      <td className="emp-email-text">{emp.email}</td>
                      <td className="emp-phone-text">{emp.phone || "—"}</td>

                      {/* Actions Column */}
                      <td>
                        <div className="emp-actions-wrap">
                          <button
                            type="button"
                            className="emp-action-btn edit"
                            title={`Edit ${emp.name}`}
                            onClick={() => handleOpenEditModal(emp)}
                          >
                            <Pencil size={13} strokeWidth={2.2} />
                            <span>Edit</span>
                          </button>

                          <button
                            type="button"
                            className="emp-action-btn reset-pwd"
                            title={`Reset Password for ${emp.name}`}
                            onClick={() => setResetPasswordEmployee(emp)}
                          >
                            <KeyRound size={13} strokeWidth={2.2} />
                            <span>Password Reset</span>
                          </button>

                          <button
                            type="button"
                            className="emp-action-btn delete"
                            title={`Delete ${emp.name}`}
                            onClick={() => setDeletingEmployee(emp)}
                          >
                            <Trash2 size={13} strokeWidth={2.2} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════ ADD EMPLOYEE MODAL ══════════════════════════ */}
      {showAddModal && (
        <div className="emp-modal-overlay" onClick={() => !saving && setShowAddModal(false)}>
          <div className="emp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-header">
              <h3 className="emp-modal-title">Add New Employee</h3>
              <button
                type="button"
                className="emp-modal-close"
                onClick={() => setShowAddModal(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="emp-modal-form">
                <div className="emp-form-grid">
                  <div className="emp-form-group full">
                    <label className="emp-form-label">Full Name *</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      placeholder="e.g. Rahul Sharma"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Department</label>
                    <select
                      className="emp-form-select"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Designation *</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      placeholder="e.g. Software Engineer"
                      required
                      value={form.designation}
                      onChange={(e) =>
                        setForm({ ...form, designation: e.target.value })
                      }
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Email Address *</label>
                    <input
                      type="email"
                      className="emp-form-input"
                      placeholder="name@intime.com"
                      required
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Phone Number</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      placeholder="+91 98765 43210"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 16,
                    background: "#F0F7FF",
                    border: "1px solid #DCEAFB",
                    borderRadius: 8,
                    padding: "10px 14px",
                    fontSize: 12.5,
                    color: "#334155",
                  }}
                >
                  The Employee ID is auto-generated (EMP01, EMP02, …) and the account is created with
                  the default password <strong>Welcome@26INT</strong>. The employee will be required to
                  change it on first login.
                </div>
              </div>

              <div className="emp-modal-footer">
                <button
                  type="button"
                  className="emp-btn-cancel"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="emp-btn-submit" disabled={saving}>
                  {saving ? "Adding…" : "Add Employee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════ EDIT EMPLOYEE MODAL ══════════════════════════ */}
      {editingEmployee && (
        <div
          className="emp-modal-overlay"
          onClick={() => !saving && setEditingEmployee(null)}
        >
          <div className="emp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-header">
              <h3 className="emp-modal-title">Edit Employee</h3>
              <button
                type="button"
                className="emp-modal-close"
                onClick={() => setEditingEmployee(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="emp-modal-form">
                <div className="emp-form-grid">
                  <div className="emp-form-group full">
                    <label className="emp-form-label">Full Name *</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      required
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Employee ID</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      value={editingEmployee.employeeId}
                      disabled
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Department</label>
                    <select
                      className="emp-form-select"
                      value={form.department}
                      onChange={(e) =>
                        setForm({ ...form, department: e.target.value })
                      }
                    >
                      {DEPARTMENTS.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Designation *</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      required
                      value={form.designation}
                      onChange={(e) =>
                        setForm({ ...form, designation: e.target.value })
                      }
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Email Address</label>
                    <input
                      type="email"
                      className="emp-form-input"
                      value={form.email}
                      disabled
                      title="Email cannot be changed."
                    />
                  </div>

                  <div className="emp-form-group">
                    <label className="emp-form-label">Phone Number</label>
                    <input
                      type="text"
                      className="emp-form-input"
                      value={form.phone}
                      onChange={(e) =>
                        setForm({ ...form, phone: e.target.value })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="emp-modal-footer">
                <button
                  type="button"
                  className="emp-btn-cancel"
                  onClick={() => setEditingEmployee(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="emp-btn-submit" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════ DELETE CONFIRM MODAL ══════════════════════════ */}
      {deletingEmployee && (
        <div
          className="emp-modal-overlay"
          onClick={() => !saving && setDeletingEmployee(null)}
        >
          <div
            className="emp-modal-card"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="emp-modal-header">
              <h3 className="emp-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={18} color="#EF4444" />
                <span>Delete Employee</span>
              </h3>
              <button
                type="button"
                className="emp-modal-close"
                onClick={() => setDeletingEmployee(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
              Are you sure you want to remove{" "}
              <strong style={{ color: "#0F172A" }}>{deletingEmployee.name}</strong> (
              {deletingEmployee.employeeId})? They will immediately lose access and disappear from this
              list. Their attendance history is preserved.
            </div>

            <div className="emp-modal-footer">
              <button
                type="button"
                className="emp-btn-cancel"
                onClick={() => setDeletingEmployee(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="emp-btn-danger"
                onClick={handleConfirmDelete}
                disabled={saving}
              >
                {saving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════ PASSWORD RESET MODAL ══════════════════════════ */}
      {resetPasswordEmployee && (
        <div
          className="emp-modal-overlay"
          onClick={() => !saving && setResetPasswordEmployee(null)}
        >
          <div
            className="emp-modal-card"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="emp-modal-header">
              <h3 className="emp-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <KeyRound size={18} color="#D97706" />
                <span>Password Reset</span>
              </h3>
              <button
                type="button"
                className="emp-modal-close"
                onClick={() => setResetPasswordEmployee(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 12px" }}>
                Reset{" "}
                <strong style={{ color: "#0F172A" }}>{resetPasswordEmployee.name}</strong> (
                {resetPasswordEmployee.employeeId}) back to the default temporary password?
              </p>
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: 8,
                  padding: "10px 14px",
                  fontSize: 12.5,
                  color: "#334155",
                }}
              >
                Their password becomes <strong>Welcome@26INT</strong> and they'll be required to set a
                new one the next time they log in.
              </div>
            </div>

            <div className="emp-modal-footer">
              <button
                type="button"
                className="emp-btn-cancel"
                onClick={() => setResetPasswordEmployee(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="emp-btn-submit"
                style={{ background: "#D97706", borderColor: "#D97706" }}
                onClick={handleConfirmResetPassword}
                disabled={saving}
              >
                {saving ? "Resetting…" : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════ CREDENTIALS (POST CREATE / RESET) MODAL ══════════════════════════ */}
      {credentials && (
        <div className="emp-modal-overlay" onClick={() => setCredentials(null)}>
          <div className="emp-modal-card" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="emp-modal-header">
              <h3 className="emp-modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <KeyRound size={18} color="#16A34A" />
                <span>Login Details</span>
              </h3>
              <button type="button" className="emp-modal-close" onClick={() => setCredentials(null)}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", fontSize: 13.5, color: "#475569", lineHeight: 1.6 }}>
              <p style={{ margin: "0 0 14px" }}>
                Share these credentials with <strong style={{ color: "#0F172A" }}>{credentials.name}</strong>
                . They must change the password on first login.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 4 }}>Employee ID</div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0F172A",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    {credentials.employeeId}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11.5, color: "#94A3B8", marginBottom: 4 }}>Temporary Password</div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontFamily: "monospace",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0F172A",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <span>{credentials.temporaryPassword}</span>
                    <button
                      type="button"
                      onClick={handleCopyPassword}
                      title="Copy password"
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        color: copied ? "#16A34A" : "#64748B",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="emp-modal-footer">
              <button type="button" className="emp-btn-submit" onClick={() => setCredentials(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
