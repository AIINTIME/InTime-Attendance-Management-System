import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, KeyRound, Users } from "lucide-react";
import {
  listEmployees,
  createEmployee,
  resetEmployeePassword,
  setEmployeeStatus,
} from "../../Services/adminService";
import { useToast } from "../../Context/ToastContext";
import { extractErrorMessage } from "../../Utils/validation";
import Modal from "../../Components/Modals/Modal";
import ConfirmDialog from "../../Components/Modals/ConfirmDialog";
import EmptyState from "../../Components/Common/EmptyState";

const EMPTY_FORM = {
  employeeId: "",
  name: "",
  email: "",
  department: "",
  designation: "",
  temporaryPassword: "",
};

export default function EmployeeManagement() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const [statusTarget, setStatusTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function load() {
    setData(null);
    const result = await listEmployees({ page, limit: 10, search: search || undefined });
    setData(result);
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await createEmployee(form);
      toast.success("Employee created.");
      setShowCreate(false);
      setForm(EMPTY_FORM);
      load();
    } catch (err) {
      setCreateError(extractErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async () => {
    setActionSubmitting(true);
    try {
      await setEmployeeStatus(statusTarget._id, !statusTarget.isActive);
      toast.success(`Employee ${statusTarget.isActive ? "deactivated" : "activated"}.`);
      setStatusTarget(null);
      load();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    setActionSubmitting(true);
    try {
      await resetEmployeePassword(resetTarget._id, resetPassword);
      toast.success("Password reset successfully.");
      setResetTarget(null);
      setResetPassword("");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setActionSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading-row">
        <div>
          <h2>Employees</h2>
          <p className="muted">Manage employee accounts and access.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      <form className="filter-toolbar" onSubmit={handleSearchSubmit}>
        <div className="input-with-icon search-input">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search by name, email, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Search
        </button>
      </form>

      {data === null && <div className="spinner" />}
      {data?.employees.length === 0 && <EmptyState icon={Users} title="No employees found" />}

      {data?.employees.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => (
                  <tr key={emp._id}>
                    <td>
                      <Link to={`/admin/employees/${emp._id}`} className="link-strong">
                        {emp.name}
                      </Link>
                      <div className="muted small">{emp.employeeId}</div>
                    </td>
                    <td>{emp.email}</td>
                    <td>{emp.department}</td>
                    <td>{emp.designation}</td>
                    <td>
                      <span className={`badge ${emp.isActive ? "badge-success" : "badge-neutral"}`}>
                        {emp.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-button" title="Reset password" onClick={() => setResetTarget(emp)}>
                          <KeyRound size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-xs"
                          onClick={() => setStatusTarget(emp)}
                        >
                          {emp.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span className="muted">
              Page {data.page} of {data.totalPages}
            </span>
            <button type="button" className="btn btn-ghost" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Employee">
        {createError && <div className="form-error-banner">{createError}</div>}
        <form className="stacked-form" onSubmit={handleCreateSubmit}>
          <label>Employee ID</label>
          <input required value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))} />
          <label>Name</label>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <label>Organization Email</label>
          <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <label>Department</label>
          <input required value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} />
          <label>Designation</label>
          <input required value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} />
          <label>Temporary Password</label>
          <input
            type="text"
            required
            minLength={8}
            value={form.temporaryPassword}
            onChange={(e) => setForm((f) => ({ ...f, temporaryPassword: e.target.value }))}
          />
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? "Creating…" : "Create Employee"}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleToggleStatus}
        title={statusTarget?.isActive ? "Deactivate employee?" : "Activate employee?"}
        message={`Are you sure you want to ${statusTarget?.isActive ? "deactivate" : "activate"} ${statusTarget?.name}?`}
        confirmLabel={statusTarget?.isActive ? "Deactivate" : "Activate"}
        danger={statusTarget?.isActive}
        isSubmitting={actionSubmitting}
      />

      <Modal isOpen={!!resetTarget} onClose={() => setResetTarget(null)} title="Reset Password" size="sm">
        <p className="confirm-message">
          Set a new temporary password for <strong>{resetTarget?.name}</strong>. They will be asked to
          change it after logging in.
        </p>
        <input
          type="text"
          minLength={8}
          placeholder="New temporary password"
          value={resetPassword}
          onChange={(e) => setResetPassword(e.target.value)}
        />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={() => setResetTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={resetPassword.length < 8 || actionSubmitting}
            onClick={handleResetPassword}
          >
            {actionSubmitting ? "Resetting…" : "Reset Password"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
