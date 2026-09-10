import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, FileText, FileBarChart } from "lucide-react";
import { listEmployees, previewReport, buildExportUrl } from "../../Services/adminService";
import { formatDate, formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import StatusBadge from "../../Components/Common/StatusBadge";
import CheckInTime from "../../Components/Common/CheckInTime";
import EmptyState from "../../Components/Common/EmptyState";
import { useToast } from "../../Context/ToastContext";

const EMPTY_FILTERS = {
  fromDate: "",
  toDate: "",
  employeeIds: [],
  department: "",
  loginType: "",
  status: "",
};

export default function Reports() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [preview, setPreview] = useState(null);
  const [exporting, setExporting] = useState(null);

  useEffect(() => {
    listEmployees({ page: 1, limit: 500 }).then((data) => setEmployees(data.employees));
  }, []);

  const departments = useMemo(
    () => Array.from(new Set(employees.map((e) => e.department))).sort(),
    [employees]
  );

  function buildParams() {
    const params = {};
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.employeeIds.length) params.employeeIds = filters.employeeIds.join(",");
    if (filters.department) params.department = filters.department;
    if (filters.loginType) params.loginType = filters.loginType;
    if (filters.status) params.status = filters.status;
    return params;
  }

  const handleApply = async () => {
    const data = await previewReport(buildParams());
    setPreview(data);
  };

  const handleReset = () => {
    setFilters(EMPTY_FILTERS);
    setPreview(null);
  };

  const handleExport = async (kind) => {
    setExporting(kind);
    try {
      const url = buildExportUrl(kind, buildParams());
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Export failed");
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `attendance-report.${kind === "excel" ? "xlsx" : "pdf"}`;
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success(`${kind === "excel" ? "Excel" : "PDF"} export ready.`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h2>Reports</h2>
        <p className="muted">Filter attendance records and export for payroll or audit.</p>
      </div>

      <div className="card">
        <div className="report-filter-grid">
          <div>
            <label>From Date</label>
            <input type="date" value={filters.fromDate} onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))} />
          </div>
          <div>
            <label>To Date</label>
            <input type="date" value={filters.toDate} onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))} />
          </div>
          <div>
            <label>Department</label>
            <select value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Login Type</label>
            <select value={filters.loginType} onChange={(e) => setFilters((f) => ({ ...f, loginType: e.target.value }))}>
              <option value="">All Types</option>
              <option value="OFFICE">Office</option>
              <option value="DISTANCE">Distance</option>
            </select>
          </div>
          <div>
            <label>Status</label>
            <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
              <option value="">All Statuses</option>
              <option value="ON_TIME">On Time</option>
              <option value="SLIGHT_LATE">Slight Late</option>
              <option value="VERY_LATE">Very Late</option>
              <option value="INSUFFICIENT_HOURS">Insufficient Hours</option>
            </select>
          </div>
          <div className="employee-select-field">
            <label>Employees ({filters.employeeIds.length || "All"})</label>
            <select
              multiple
              value={filters.employeeIds}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  employeeIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                }))
              }
            >
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} ({emp.employeeId})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="report-actions-row">
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={handleApply}>
              Apply Filters
            </button>
            <button type="button" className="btn btn-ghost" onClick={handleReset}>
              Reset
            </button>
          </div>
          <div className="row-actions">
            <button type="button" className="btn btn-outline" onClick={() => handleExport("excel")} disabled={exporting === "excel"}>
              <FileSpreadsheet size={16} /> {exporting === "excel" ? "Exporting…" : "Export Excel"}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => handleExport("pdf")} disabled={exporting === "pdf"}>
              <FileText size={16} /> {exporting === "pdf" ? "Exporting…" : "Export PDF"}
            </button>
          </div>
        </div>
      </div>

      {preview && (
        <>
          <div className="muted">
            <strong>{preview.total}</strong> matching records
          </div>

          {preview.records.length === 0 && <EmptyState icon={FileBarChart} title="No matching records" />}

          {preview.records.length > 0 && (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th>Check-in</th>
                    <th>Type</th>
                    <th>Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.records.map((r) => (
                    <tr key={r._id}>
                      <td>
                        {r.employeeId?.name} <span className="muted small">({r.employeeId?.employeeId})</span>
                      </td>
                      <td>{formatDate(r.date)}</td>
                      <td>
                        <CheckInTime time={r.checkInTime} latenessStatus={r.latenessStatus} />
                      </td>
                      <td>{r.loginType === "OFFICE" ? "Office" : "Distance"}</td>
                      <td>{formatMinutesAsHours(r.totalWorkingMinutes)}</td>
                      <td>
                        <StatusBadge status={r.latenessStatus} insufficientHours={r.insufficientHours} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small table-footnote">Showing first {preview.records.length} of {preview.total} — export includes all matching records, grouped by employee.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
