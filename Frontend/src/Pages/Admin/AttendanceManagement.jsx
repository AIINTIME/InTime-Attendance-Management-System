import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks } from "lucide-react";
import { listAttendance } from "../../Services/adminService";
import { formatDate, formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL } from "../../Utils/constants";
import StatusBadge from "../../Components/Common/StatusBadge";
import EmptyState from "../../Components/Common/EmptyState";

export default function AttendanceManagement() {
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", loginType: "", status: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function load() {
    setData(null);
    const params = { page, limit: 15 };
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.loginType) params.loginType = filters.loginType;
    if (filters.status) params.status = filters.status;
    const result = await listAttendance(params);
    setData(result);
  }

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h2>Attendance Management</h2>
        <p className="muted">Browse and filter attendance across all employees.</p>
      </div>

      <form className="filter-toolbar" onSubmit={applyFilters}>
        <input type="date" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
        <input type="date" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
        <select value={filters.loginType} onChange={(e) => setFilters((f) => ({ ...f, loginType: e.target.value }))}>
          <option value="">All Types</option>
          <option value="OFFICE">Office</option>
          <option value="DISTANCE">Distance</option>
        </select>
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          <option value="ON_TIME">On Time</option>
          <option value="SLIGHT_LATE">Slight Late</option>
          <option value="VERY_LATE">Very Late</option>
          <option value="INSUFFICIENT_HOURS">Insufficient Hours</option>
        </select>
        <button type="submit" className="btn btn-primary">
          Apply
        </button>
      </form>

      {data === null && <div className="spinner" />}
      {data?.records.length === 0 && <EmptyState icon={ListChecks} title="No attendance records found" />}

      {data?.records.length > 0 && (
        <>
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Type</th>
                  <th>Hours</th>
                  <th>Location</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.records.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <Link to={`/admin/employees/${r.employeeId?._id}`} className="link-strong">
                        {r.employeeId?.name}
                      </Link>
                      <div className="muted small">{r.employeeId?.employeeId}</div>
                    </td>
                    <td>{formatDate(r.date)}</td>
                    <td>{formatTime(r.checkInTime)}</td>
                    <td>{r.checkOutTime ? formatTime(r.checkOutTime) : "-"}</td>
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
              Page {data.page} of {data.totalPages}
            </span>
            <button type="button" className="btn btn-ghost" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
