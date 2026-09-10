import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ShieldAlert } from "lucide-react";
import { getEmployeeById, getEmployeeAttendanceHistory } from "../../Services/adminService";
import { formatDate, formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL, API_URL } from "../../Utils/constants";
import StatusBadge from "../../Components/Common/StatusBadge";
import CheckInTime from "../../Components/Common/CheckInTime";
import EmptyState from "../../Components/Common/EmptyState";
import { ListChecks } from "lucide-react";

export default function EmployeeDetails() {
  const { id } = useParams();
  const [details, setDetails] = useState(null);
  const [history, setHistory] = useState(null);
  const [dateFilter, setDateFilter] = useState({ fromDate: "", toDate: "" });
  const [page, setPage] = useState(1);

  useEffect(() => {
    getEmployeeById(id).then(setDetails);
  }, [id]);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, page]);

  async function loadHistory() {
    setHistory(null);
    const params = { page, limit: 10 };
    if (dateFilter.fromDate) params.fromDate = dateFilter.fromDate;
    if (dateFilter.toDate) params.toDate = dateFilter.toDate;
    const result = await getEmployeeAttendanceHistory(id, params);
    setHistory(result);
  }

  const applyDateFilter = (e) => {
    e.preventDefault();
    setPage(1);
    loadHistory();
  };

  if (!details) return <div className="spinner" />;

  const { employee, attendanceStats } = details;
  const photoUrl = employee.profilePhoto ? `${API_URL.replace(/\/api\/?$/, "")}${employee.profilePhoto}` : null;

  return (
    <div className="page-stack">
      <Link to="/admin/employees" className="link-strong back-link">
        <ArrowLeft size={15} /> Back to Employees
      </Link>

      <div className="card profile-card">
        {photoUrl ? (
          <img src={photoUrl} alt={employee.name} className="profile-photo" />
        ) : (
          <div className="avatar-circle xlarge">{initials(employee.name)}</div>
        )}
        <div className="profile-details">
          <h3>{employee.name}</h3>
          <div className="profile-detail-grid">
            <div>
              <span className="muted">Employee ID</span>
              <strong>{employee.employeeId}</strong>
            </div>
            <div>
              <span className="muted">Email</span>
              <strong>{employee.email}</strong>
            </div>
            <div>
              <span className="muted">Department</span>
              <strong>{employee.department}</strong>
            </div>
            <div>
              <span className="muted">Designation</span>
              <strong>{employee.designation}</strong>
            </div>
            <div>
              <span className="muted">Status</span>
              <strong>{employee.isActive ? "Active" : "Inactive"}</strong>
            </div>
            <div>
              <span className="muted">Passkey</span>
              <strong className="inline-flex-center">
                {employee.passkeyRegistered ? (
                  <>
                    <ShieldCheck size={15} className="text-success" /> Registered
                  </>
                ) : (
                  <>
                    <ShieldAlert size={15} className="text-warning" /> Not registered
                  </>
                )}
              </strong>
            </div>
          </div>
        </div>
      </div>

      <div className="stat-grid">
        <MiniStat value={attendanceStats.totalRecords} label="Total Records" color="primary" />
        <MiniStat value={attendanceStats.onTime} label="On Time" color="success" />
        <MiniStat value={attendanceStats.slightLate} label="Slight Late" color="warning" />
        <MiniStat value={attendanceStats.veryLate} label="Very Late" color="danger" />
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Attendance History</h3>
        </div>

        <form className="filter-toolbar" onSubmit={applyDateFilter}>
          <input
            type="date"
            value={dateFilter.fromDate}
            onChange={(e) => setDateFilter((f) => ({ ...f, fromDate: e.target.value }))}
          />
          <input
            type="date"
            value={dateFilter.toDate}
            onChange={(e) => setDateFilter((f) => ({ ...f, toDate: e.target.value }))}
          />
          <button type="submit" className="btn btn-primary">
            Filter
          </button>
        </form>

        {history === null && <div className="spinner" />}
        {history?.records.length === 0 && <EmptyState icon={ListChecks} title="No records found" />}

        {history?.records.length > 0 && (
          <>
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Check-in</th>
                    <th>Type</th>
                    <th>Hours</th>
                    <th>Location</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {history.records.map((r) => (
                    <tr key={r._id}>
                      <td>{formatDate(r.date)}</td>
                      <td>
                        <CheckInTime time={r.checkInTime} latenessStatus={r.latenessStatus} />
                      </td>
                      <td>{r.loginType === "OFFICE" ? "Office" : "Distance"}</td>
                      <td>{formatMinutesAsHours(r.totalWorkingMinutes)}</td>
                      <td>
                        <a href={GOOGLE_MAPS_QUERY_URL(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="link-strong">
                          View
                        </a>
                      </td>
                      <td>
                        <StatusBadge status={r.latenessStatus} insufficientHours={r.insufficientHours} />
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
                Page {history.page} of {history.totalPages}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={page >= history.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ value, label, color }) {
  return (
    <div className="mini-stat-card">
      <div>
        <div className={`mini-stat-value ${color}`}>{value ?? "-"}</div>
        <div className="stat-label">{label}</div>
      </div>
      <span className={`stat-dot ${color}`} />
    </div>
  );
}

function initials(name) {
  if (!name) return "";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
