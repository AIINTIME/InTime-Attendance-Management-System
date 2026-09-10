import { useEffect, useRef, useState, useMemo } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  Download,
  FileText,
  FileSpreadsheet,
  MapPin,
  Building2,
  Home,
  ChevronDown,
  X,
  ListChecks,
  Users,
  Calendar,
} from "lucide-react";
import { listEmployees, listAttendance, buildExportUrl } from "../../Services/adminService";
import { formatDate, formatTime } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL, API_URL } from "../../Utils/constants";
import EmptyState from "../../Components/Common/EmptyState";
import CheckInTime from "../../Components/Common/CheckInTime";
import { useToast } from "../../Context/ToastContext";
import { extractErrorMessage } from "../../Utils/validation";
import "../../Styles/AttendanceManagement.css";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function photoUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${API_URL.replace(/\/api\/?$/, "")}${path}`;
}

function initials(name) {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// We only ever know a check-in/out as GPS coordinates (no reverse
// geocoding in this app), so "location" here means the verified work
// mode, not a fabricated place name -- the coordinates are shown alongside
// and link out to Google Maps for the actual place. The reason text (for
// remote check-ins) is shown separately via the Note column/popup instead.
function resolveLocationTitle(record) {
  return record.loginType === "OFFICE" ? "Office" : "Remote";
}

// Precise Xh Ym Zs duration straight from the raw timestamps -- the
// backend's totalWorkingMinutes is rounded to whole minutes, which drops
// the seconds we want to show here.
function formatDurationHMS(checkInTime, checkOutTime) {
  if (!checkInTime || !checkOutTime) return null;
  const totalSeconds = Math.max(
    0,
    Math.round((new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) / 1000)
  );
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return { text: `${h}h ${m}m ${s}s`, totalMinutes: totalSeconds / 60 };
}



// No pagination UI -- the card scrolls internally instead, so fetch a
// generously large page of results in one go. 100 is the backend's hard
// cap (see listAttendanceValidators) -- requesting more 422s the request.
const FETCH_LIMIT = 100;

export default function AttendanceManagement() {
  const outlet = useOutletContext();
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedMonthNum, setSelectedMonthNum] = useState(null);
  const [selectedYear, setSelectedYear] = useState(null);
  const [rangeFromDate, setRangeFromDate] = useState("");
  const [rangeToDate, setRangeToDate] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewingNote, setViewingNote] = useState(null); // the record whose note is open in the popup

  // Element refs for triggering showPicker on entire button clicks
  const exportMenuRef = useRef(null);
  const empSelectRef = useRef(null);
  const monthSelectRef = useRef(null);
  const yearSelectRef = useRef(null);
  const fromDateRef = useRef(null);
  const toDateRef = useRef(null);

  const triggerPicker = (ref) => {
    if (!ref?.current) return;
    try {
      if (typeof ref.current.showPicker === "function") {
        ref.current.showPicker();
      } else {
        ref.current.focus();
        ref.current.click?.();
      }
    } catch {
      ref.current.focus();
    }
  };

  // Fetch employees from backend on mount
  useEffect(() => {
    let mounted = true;
    listEmployees({ limit: 100 })
      .then((res) => {
        if (mounted) {
          setEmployees(res?.employees || []);
        }
      })
      .catch((err) => {
        console.error("Failed to load employees for filter:", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  }, [employees]);

  // Close export dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Read searchQuery from top header outlet context if available
  const searchQuery = outlet?.searchQuery || "";

  async function load() {
    setLoading(true);
    try {
      const params = { page: 1, limit: FETCH_LIMIT };
      if (selectedEmployeeId) {
        params.employeeIds = selectedEmployeeId;
      }

      let effectiveFromDate = "";
      let effectiveToDate = "";

      if (rangeFromDate || rangeToDate) {
        if (rangeFromDate) effectiveFromDate = rangeFromDate;
        if (rangeToDate) effectiveToDate = rangeToDate;
      } else if (selectedYear) {
        if (selectedMonthNum) {
          const mm = String(selectedMonthNum).padStart(2, "0");
          const lastDay = new Date(selectedYear, selectedMonthNum, 0).getDate();
          effectiveFromDate = `${selectedYear}-${mm}-01`;
          effectiveToDate = `${selectedYear}-${mm}-${String(lastDay).padStart(2, "0")}`;
        } else {
          effectiveFromDate = `${selectedYear}-01-01`;
          effectiveToDate = `${selectedYear}-12-31`;
        }
      }

      if (effectiveFromDate) params.fromDate = effectiveFromDate;
      if (effectiveToDate) params.toDate = effectiveToDate;

      const result = await listAttendance(params);
      setData(result);
    } catch (err) {
      setData(null);
      toast.error(extractErrorMessage(err, "Failed to load attendance records."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, selectedMonthNum, selectedYear, rangeFromDate, rangeToDate]);

  const handleClearFilters = () => {
    setSelectedEmployeeId("");
    setSelectedMonthNum(null);
    setSelectedYear(null);
    setRangeFromDate("");
    setRangeToDate("");
  };

  const isMonthYearActive = selectedMonthNum !== null || selectedYear !== null;
  const isRangeActive = Boolean(rangeFromDate || rangeToDate);

  const hasActiveFilters = Boolean(
    selectedEmployeeId || isMonthYearActive || isRangeActive
  );

  const rawRecords = data?.records || [];

  // Filter with searchQuery (employee name, ID, department, date)
  const visibleRecords = useMemo(() => {
    return rawRecords.filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      const haystack = [
        r.employeeId?.name,
        r.employeeId?.employeeId,
        r.employeeId?.department,
        formatDate(r.date, { weekday: undefined }),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rawRecords, searchQuery]);

  // Group the current page's records by calendar day -- the backend already
  // sorts by date descending, so groups come out most-recent-first too.
  const groupedByDate = useMemo(() => {
    const map = new Map();
    for (const r of visibleRecords) {
      const key = r.date ? new Date(r.date).toISOString().slice(0, 10) : "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    return Array.from(map.entries()).map(([key, records]) => ({
      key,
      label: key === "unknown" ? "Unknown date" : formatDate(records[0].date),
      records,
    }));
  }, [visibleRecords]);

  // Export the currently filtered range as a real, server-generated
  // PDF or Excel report (GET /reports/attendance/pdf|excel) -- grouped by
  // employee, one section per person, matching the filters applied here.
  const handleExport = (kind) => {
    setShowExportMenu(false);
    const params = {};
    if (selectedEmployeeId) params.employeeIds = selectedEmployeeId;

    let effectiveFromDate = "";
    let effectiveToDate = "";

    if (rangeFromDate || rangeToDate) {
      if (rangeFromDate) effectiveFromDate = rangeFromDate;
      if (rangeToDate) effectiveToDate = rangeToDate;
    } else if (selectedYear) {
      if (selectedMonthNum) {
        const mm = String(selectedMonthNum).padStart(2, "0");
        const lastDay = new Date(selectedYear, selectedMonthNum, 0).getDate();
        effectiveFromDate = `${selectedYear}-${mm}-01`;
        effectiveToDate = `${selectedYear}-${mm}-${String(lastDay).padStart(2, "0")}`;
      } else {
        effectiveFromDate = `${selectedYear}-01-01`;
        effectiveToDate = `${selectedYear}-12-31`;
      }
    }

    if (effectiveFromDate) params.fromDate = effectiveFromDate;
    if (effectiveToDate) params.toDate = effectiveToDate;

    window.open(buildExportUrl(kind, params), "_blank");
  };

  return (
    <div className="attlog-page-container">
      {/* ── Page Header: Title + Subtitle on Left, Export on Right ── */}
      <div className="attlog-top-bar">
        <div className="attlog-title-area">
          <h1 className="attlog-main-title">Employee Attendance Logs</h1>
          <p className="attlog-main-subtitle">
            View and manage attendance records for all employees.
          </p>
        </div>

        <div className="attlog-actions-area">
          {/* 1. Employee List Filter (fetched from backend) */}
          <div
            className="att-btn att-employee-pill"
            title="Filter by employee"
            onClick={(e) => {
              if (e.target !== empSelectRef.current) {
                triggerPicker(empSelectRef);
              }
            }}
          >
            <Users size={16} color="#0074F1" />
            <select
              ref={empSelectRef}
              className="att-month-select-native att-employee-select-native"
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            >
              <option value="">All Employees</option>
              {sortedEmployees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="#64748b" />
          </div>

          {/* 2. Date Wise (Month and Year) Filter */}
          <div
            className={`att-btn att-month-year-combo ${
              isMonthYearActive ? "att-btn-filter-active" : ""
            } ${isRangeActive ? "att-btn-filter-disabled" : ""}`}
            title={
              isRangeActive
                ? "Click to switch to Month & Year filter (clears Date Range)"
                : "Filter by month and year"
            }
          >
            <div
              className="att-combo-half"
              onClick={(e) => {
                if (isRangeActive) {
                  setRangeFromDate("");
                  setRangeToDate("");
                }
                if (e.target !== monthSelectRef.current) {
                  triggerPicker(monthSelectRef);
                }
              }}
            >
              <Calendar size={16} color={isRangeActive ? "#94a3b8" : "#0074F1"} />
              <select
                ref={monthSelectRef}
                className="att-month-select-native"
                value={selectedMonthNum ?? ""}
                disabled={isRangeActive}
                onChange={(e) => {
                  setRangeFromDate("");
                  setRangeToDate("");
                  const val = e.target.value === "" ? null : Number(e.target.value);
                  setSelectedMonthNum(val);
                  if (val !== null && selectedYear === null) {
                    setSelectedYear(CURRENT_YEAR);
                  }
                }}
              >
                <option value="">All Months</option>
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} color={isRangeActive ? "#cbd5e1" : "#64748b"} />
            </div>

            <span className="att-month-year-divider" />

            <div
              className="att-combo-half"
              onClick={(e) => {
                if (isRangeActive) {
                  setRangeFromDate("");
                  setRangeToDate("");
                }
                if (e.target !== yearSelectRef.current) {
                  triggerPicker(yearSelectRef);
                }
              }}
            >
              <select
                ref={yearSelectRef}
                className="att-month-select-native"
                value={selectedYear ?? ""}
                disabled={isRangeActive}
                onChange={(e) => {
                  setRangeFromDate("");
                  setRangeToDate("");
                  setSelectedYear(e.target.value === "" ? null : Number(e.target.value));
                }}
              >
                <option value="">All Years</option>
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} color={isRangeActive ? "#cbd5e1" : "#64748b"} />
            </div>
          </div>

          {/* 3. Calendar Range Filter */}
          <div
            className={`att-btn att-date-range-combo ${
              isRangeActive ? "att-btn-filter-active" : ""
            } ${isMonthYearActive ? "att-btn-filter-disabled" : ""}`}
            title={
              isMonthYearActive
                ? "Click to switch to Date Range filter (clears Month & Year)"
                : "Filter by custom date range"
            }
          >
            <div
              className="att-combo-half"
              onClick={(e) => {
                if (isMonthYearActive) {
                  setSelectedMonthNum(null);
                  setSelectedYear(null);
                }
                if (e.target !== fromDateRef.current) {
                  triggerPicker(fromDateRef);
                }
              }}
            >
              <Calendar size={16} color={isMonthYearActive ? "#94a3b8" : "#0074F1"} />
              <input
                ref={fromDateRef}
                type="date"
                className="att-date-input-native"
                value={rangeFromDate}
                disabled={isMonthYearActive}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                onChange={(e) => {
                  setSelectedMonthNum(null);
                  setSelectedYear(null);
                  setRangeFromDate(e.target.value);
                }}
                title="From date"
              />
            </div>

            <span className="att-date-range-sep">to</span>

            <div
              className="att-combo-half"
              onClick={(e) => {
                if (isMonthYearActive) {
                  setSelectedMonthNum(null);
                  setSelectedYear(null);
                }
                if (e.target !== toDateRef.current) {
                  triggerPicker(toDateRef);
                }
              }}
            >
              <input
                ref={toDateRef}
                type="date"
                className="att-date-input-native"
                value={rangeToDate}
                disabled={isMonthYearActive}
                onClick={(e) => {
                  try {
                    e.currentTarget.showPicker?.();
                  } catch {}
                }}
                onChange={(e) => {
                  setSelectedMonthNum(null);
                  setSelectedYear(null);
                  setRangeToDate(e.target.value);
                }}
                title="To date"
              />
            </div>
          </div>

          {/* Clear Filters Button */}
          <button
            type="button"
            className="att-btn"
            onClick={handleClearFilters}
            disabled={!hasActiveFilters}
            title="Clear all filters"
          >
            <X size={15} />
            <span>Clear</span>
          </button>

          {/* Export Button: PDF / Excel, generated server-side from real data */}
          <div className="attlog-export-wrap" ref={exportMenuRef}>
            <button
              type="button"
              className="attlog-export-btn"
              onClick={() => setShowExportMenu((prev) => !prev)}
              title="Export attendance report"
            >
              <Download size={15} />
              <span>Export</span>
              <ChevronDown size={14} />
            </button>

            {showExportMenu && (
              <div className="attlog-export-menu">
                <button type="button" className="attlog-export-menu-item" onClick={() => handleExport("pdf")}>
                  <FileText size={15} />
                  <span>Export as PDF</span>
                </button>
                <button type="button" className="attlog-export-menu-item" onClick={() => handleExport("excel")}>
                  <FileSpreadsheet size={15} />
                  <span>Export as Excel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="attlog-card">
        {/* Table Content */}
        {loading && !data ? (
          <div className="attlog-spinner-wrap">
            <div className="spinner" />
          </div>
        ) : visibleRecords.length === 0 ? (
          <EmptyState icon={ListChecks} title="No attendance records found" />
        ) : (
          <div className="attlog-table-wrap">
            <table className="attlog-table">
              <thead>
                <tr>
                  <th className="th-num">#</th>
                  <th className="th-employee">Employee</th>
                  <th className="th-checkin">
                    <span className="th-sortable">
                      Check In <ChevronDown size={13} />
                    </span>
                  </th>
                  <th className="th-location">Check In Location</th>
                  <th className="th-checkout">
                    <span className="th-sortable">
                      Check Out <ChevronDown size={13} />
                    </span>
                  </th>
                  <th className="th-location">Check Out Location</th>
                  <th className="th-workmode">Work Mode</th>
                  <th className="th-hours">Total Hours</th>
                  <th>Note</th>
                </tr>
              </thead>
              {groupedByDate.map((group, groupIdx) => (
                <tbody key={group.key}>
                  <tr className="attlog-date-group-row">
                    <td colSpan={9}>
                      <div className="attlog-date-group-content">
                        <div className="attlog-date-group-left">
                          <span className="attlog-date-group-label">{group.label}</span>
                          <span className="attlog-date-group-count">
                            {group.records.length} record{group.records.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="attlog-criteria-legend" title="Check-in lateness status color codes">
                          <span className="criteria-legend-title">Check-in Status:</span>
                          <span className="criteria-legend-item">
                            <span className="checkin-status-dot dot-green" />
                            <span className="criteria-legend-label">On Time</span>
                          </span>
                          <span className="criteria-legend-item">
                            <span className="checkin-status-dot dot-blue" />
                            <span className="criteria-legend-label">Slight Late</span>
                          </span>
                          <span className="criteria-legend-item">
                            <span className="checkin-status-dot dot-orange" />
                            <span className="criteria-legend-label">Late</span>
                          </span>
                          <span className="criteria-legend-item">
                            <span className="checkin-status-dot dot-red" />
                            <span className="criteria-legend-label">Very Late</span>
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  {group.records.map((r) => {
                    const emp = r.employeeId;
                    const rowNum = visibleRecords.indexOf(r) + 1;

                    // Work Mode
                  const isOffice = r.loginType === "OFFICE";
                  const modeLabel = isOffice ? "Office" : "Remote";
                  const modeBadgeClass = isOffice ? "badge-office" : "badge-remote";

                  // Locations & Coordinates
                  const inLocTitle = resolveLocationTitle(r);
                  const inLat = r.latitude != null ? r.latitude.toFixed(4) : "0.0000";
                  const inLng = r.longitude != null ? r.longitude.toFixed(4) : "0.0000";

                  const outLocTitle = r.checkOutTime ? resolveLocationTitle(r) : null;
                  const outLat = r.checkOutLatitude != null
                    ? r.checkOutLatitude.toFixed(4)
                    : r.latitude != null
                    ? r.latitude.toFixed(4)
                    : "0.0000";
                  const outLng = r.checkOutLongitude != null
                    ? r.checkOutLongitude.toFixed(4)
                    : r.longitude != null
                    ? r.longitude.toFixed(4)
                    : "0.0000";

                  // Total Hours (precise, with seconds)
                  const duration = r.checkOutTime ? formatDurationHMS(r.checkInTime, r.checkOutTime) : null;

                  // Avatar photo
                  const avatarSrc = emp?.profilePhoto ? photoUrl(emp.profilePhoto) : "";

                  return (
                    <tr key={r._id}>
                      {/* # Number */}
                      <td className="cell-num">{rowNum}</td>

                      {/* Employee (Avatar + Name + ID) */}
                      <td className="cell-emp">
                        <Link
                          to={emp?._id ? `/admin/employees/${emp._id}` : "#"}
                          className="attlog-emp-profile-link"
                        >
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={emp?.name || "Employee"}
                              className="attlog-avatar-img"
                              onError={(e) => {
                                e.target.style.display = "none";
                                if (e.target.nextSibling) {
                                  e.target.nextSibling.style.display = "flex";
                                }
                              }}
                            />
                          ) : null}
                          <div
                            className="attlog-avatar-fallback"
                            style={{ display: avatarSrc ? "none" : "flex" }}
                          >
                            {initials(emp?.name)}
                          </div>

                          <div className="attlog-emp-info">
                            <span className="attlog-emp-name">{emp?.name || "—"}</span>
                            <span className="attlog-emp-id">{emp?.employeeId || "—"}</span>
                          </div>
                        </Link>
                      </td>

                      {/* Check In Time with dynamic status dot */}
                      <td className="cell-time">
                        <CheckInTime time={r.checkInTime} latenessStatus={r.latenessStatus} />
                      </td>

                      {/* Check In Location */}
                      <td className="cell-location">
                        <a
                          href={GOOGLE_MAPS_QUERY_URL(r.latitude, r.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="attlog-location-link"
                          title="View on Google Maps"
                        >
                          <MapPin size={15} className="attlog-pin-icon" />
                          <div className="attlog-loc-details">
                            <span className="attlog-loc-title">{inLocTitle}</span>
                            <span className="attlog-loc-coords">
                              {inLat}, {inLng}
                            </span>
                          </div>
                        </a>
                      </td>

                      {/* Check Out Time */}
                      <td className="cell-time">
                        {r.checkOutTime ? formatTime(r.checkOutTime) : "—"}
                      </td>

                      {/* Check Out Location */}
                      <td className="cell-location">
                        {r.checkOutTime ? (
                          <a
                            href={GOOGLE_MAPS_QUERY_URL(
                              r.checkOutLatitude ?? r.latitude,
                              r.checkOutLongitude ?? r.longitude
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="attlog-location-link"
                            title="View on Google Maps"
                          >
                            <MapPin size={15} className="attlog-pin-icon" />
                            <div className="attlog-loc-details">
                              <span className="attlog-loc-title">{outLocTitle}</span>
                              <span className="attlog-loc-coords">
                                {outLat}, {outLng}
                              </span>
                            </div>
                          </a>
                        ) : (
                          <span className="cell-empty-dash">—</span>
                        )}
                      </td>

                      {/* Work Mode */}
                      <td className="cell-badge">
                        <span className={`attlog-pill-badge attlog-workmode-badge ${modeBadgeClass}`}>
                          {isOffice ? <Building2 size={13} /> : <Home size={13} />}
                          {modeLabel}
                        </span>
                      </td>

                      {/* Total Hours */}
                      <td className="cell-hours">
                        {duration ? duration.text : "—"}
                      </td>

                      {/* Note */}
                      <td className="cell-note">
                        {r.reason ? (
                          <button
                            type="button"
                            className="attlog-view-note-btn"
                            onClick={() => setViewingNote(r)}
                          >
                            View Note
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </div>
        )}
      </div>

      {/* ── Note Popup ── */}
      {viewingNote && (
        <div className="attlog-note-modal-overlay" onClick={() => setViewingNote(null)}>
          <div className="attlog-note-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="attlog-note-modal-header">
              <h3>Note</h3>
              <button type="button" className="attlog-note-modal-close" onClick={() => setViewingNote(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="attlog-note-modal-meta">
              <span>{viewingNote.employeeId?.name || "—"}</span>
              <span className="attlog-note-modal-meta-sep">•</span>
              <span>{formatDate(viewingNote.date, { weekday: undefined })}</span>
            </div>
            <p className="attlog-note-modal-text">{viewingNote.reason}</p>
          </div>
        </div>
      )}
    </div>
  );
}
