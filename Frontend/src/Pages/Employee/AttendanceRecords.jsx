import { useEffect, useState } from "react";
import {
  ListChecks,
  BarChart3,
  Calendar,
  Download,
  Clock,
  CheckCircle2,
  TrendingUp,
  Home,
  CalendarDays,
  Star,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Zap,
  AlertCircle,
  Users,
  Building,
  Building2,
  Monitor,
  MapPin,
  X,
} from "lucide-react";
import { getMyRecords, getWorkingDays } from "../../Services/attendanceService";
import { formatDate, formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL } from "../../Utils/constants";
import EmptyState from "../../Components/Common/EmptyState";
import CheckInTime from "../../Components/Common/CheckInTime";
import "../../Styles/AttendanceReport.css";
// Reused so the employee's own attendance table renders with the exact same
// look as the admin Attendance Logs table (attlog-* classes).
import "../../Styles/AttendanceManagement.css";

/* ══════════════════════════════════════════════════════════════════════════════
   Mock Data for September 2025
══════════════════════════════════════════════════════════════════════════════ */
const MOCK_REPORT_DATA = {
  month: "September 2025",
  metrics: {
    present: { count: 18, pct: "72% of work days" },
    wfh: { count: 3, pct: "12% of work days" },
    halfDay: { count: 1, pct: "4% of work days" },
    leave: { count: 1, pct: "4% of work days" },
    totalWorkingDays: { count: 22, period: "in September" },
  },
  overview: [
    { label: "Present", value: 18, colorClass: "present" },
    { label: "WFH", value: 3, colorClass: "wfh" },
    { label: "Leave", value: 1, colorClass: "leave" },
    { label: "Half Day", value: 1, colorClass: "halfday" },
    { label: "Absent", value: 0, colorClass: "absent" },
  ],
  workLocation: {
    totalDays: 22,
    segments: [
      { label: "In Office", count: 18, pct: 82, color: "#10b981", class: "green" },
      { label: "Remote", count: 3, pct: 14, color: "#3b82f6", class: "blue" },
      { label: "Others", count: 1, pct: 4, color: "#94a3b8", class: "others" },
    ],
  },
  workingHours: {
    totalWorked: "162h 35m",
    targetTotal: "176h 00m",
    percentage: 92,
    avgDaily: "8h 08m",
    avgTarget: "8h 00m",
    extraHours: "12h 35m",
    extraDelta: "+12% more",
    shortfallHours: "1h 25m",
    shortfallDelta: "-2% less",
    // 30 days of September hours (0 to 12h scale)
    daily: [
      { day: 1, hours: 8.5 },
      { day: 2, hours: 9.0 },
      { day: 3, hours: 8.2 },
      { day: 4, hours: 8.8 },
      { day: 5, hours: 8.0 },
      { day: 6, hours: 0, isWeekend: true },
      { day: 7, hours: 0, isWeekend: true },
      { day: 8, hours: 8.5 },
      { day: 9, hours: 8.4 },
      { day: 10, hours: 8.9 },
      { day: 11, hours: 8.1 },
      { day: 12, hours: 0, isLeave: true }, // Leave
      { day: 13, hours: 0, isWeekend: true },
      { day: 14, hours: 0, isWeekend: true },
      { day: 15, hours: 10.4 }, // Best day: 10h 25m
      { day: 16, hours: 8.6 },
      { day: 17, hours: 8.7 },
      { day: 18, hours: 4.0, isHalfDay: true }, // Half Day
      { day: 19, hours: 8.2 },
      { day: 20, hours: 0, isWeekend: true },
      { day: 21, hours: 0, isWeekend: true },
      { day: 22, hours: 8.6 },
      { day: 23, hours: 9.1 },
      { day: 24, hours: 8.3 },
      { day: 25, hours: 8.7 },
      { day: 26, hours: 8.0 },
      { day: 27, hours: 0, isWeekend: true },
      { day: 28, hours: 0, isWeekend: true },
      { day: 29, hours: 8.4 },
      { day: 30, hours: 8.5 },
    ],
  },
  insights: [
    {
      badgeClass: "green",
      icon: CheckCircle2,
      title: "Great Consistency!",
      desc: "You maintained 92% attendance this month.",
    },
    {
      badgeClass: "blue",
      icon: TrendingUp,
      title: "Productive Month",
      desc: "You worked 12h 35m extra hours. Keep it up!",
    },
    {
      badgeClass: "amber",
      icon: Home,
      title: "Work From Home",
      desc: "You worked remotely for 3 days this month.",
    },
    {
      badgeClass: "purple",
      icon: CalendarDays,
      title: "1 Leave & 1 Half Day",
      desc: "You took 1 leave and 1 half day this month.",
    },
    {
      badgeClass: "teal",
      icon: Star,
      title: "Best Day",
      desc: "You worked 10h 25m on 15 Sep 2025.",
    },
  ],
};

/* ══════════════════════════════════════════════════════════════════════════════
   Attendance Records tab (below) is backed entirely by GET /attendance/my-records
   -- see loadTable()/loadStats(). The Attendance model has no "leave" or
   "half day" concept; the real categories are login type (Office/Distance)
   and lateness (On Time/Slight Late/Very Late) plus an insufficient-hours flag.
══════════════════════════════════════════════════════════════════════════════ */

// Formats a KPI card value as "count/total" once a real working-day total
// is known (a specific month is selected); otherwise just the plain count,
// same fallback the cards used before a total was available at all.
function outOf(count, total) {
  if (count == null) return undefined;
  if (total == null) return count;
  return `${count}/${Number(total.toFixed(1))}`;
}

/* ══════════════════════════════════════════════════════════════════════════════
   Main Component: AttendanceRecords (Report Page)
══════════════════════════════════════════════════════════════════════════════ */
export default function AttendanceRecords() {
  const [activeTab, setActiveTab] = useState("records"); // "reports" | "records"

  /* Attendance Records: no filter UI beyond the month/year picker -- like
     the admin Attendance Logs table, the card just scrolls internally, so
     fetch a generously large page in one go. 100 is the backend's hard cap
     (see myRecordsValidators) -- requesting more 422s the request. */
  const FETCH_LIMIT = 100;

  // The 12 calendar months, independent of year.
  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const MONTH_OPTIONS = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));

  // Current year back to when the app's earliest realistic data could be,
  // plus the current year -- generous enough for "any year" without an
  // unbounded/empty-feeling list.
  const CURRENT_YEAR = new Date().getFullYear();
  const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

  // null/null means "no date filter" -- Clear resets to this and shows
  // every record on file (up to FETCH_LIMIT).
  const [selectedMonthNum, setSelectedMonthNum] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [statusFilter, setStatusFilter] = useState(null); // null | "present" | "absent" | "late" | "ontime"
  const [data, setData] = useState(null); // { records, total }
  const [stats, setStats] = useState(null); // category counts for the selected month

  // Either one alone is already a real, active filter (see loadTable) --
  // requiring both here meant picking just a year (or just a month) left
  // the Clear button disabled even though it was silently filtering data.
  const hasDateFilter = selectedMonthNum !== null || selectedYear !== null;
  const hasAnyFilter = hasDateFilter || statusFilter !== null;

  useEffect(() => {
    if (activeTab === "records") {
      loadTable(selectedYear, selectedMonthNum);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, selectedYear, selectedMonthNum]);

  async function loadTable(year, month) {
    setData(null);
    setStats(null);
    try {
      const params = { page: 1, limit: FETCH_LIMIT };
      let lastDay = null;

      if (year !== null && month !== null) {
        // Specific month: e.g. September 2026.
        const monthValue = `${year}-${String(month).padStart(2, "0")}`;
        params.fromDate = `${monthValue}-01`;
        lastDay = new Date(year, month, 0).getDate();
        params.toDate = `${monthValue}-${String(lastDay).padStart(2, "0")}`;
      } else if (year !== null) {
        // A year with "All Months" still has to filter -- picking just a
        // year used to do nothing at all, since the old code only ever
        // built a date range when BOTH were set.
        params.fromDate = `${year}-01-01`;
        params.toDate = `${year}-12-31`;
      }
      // Month with "All Years" (e.g. "every September") can't be expressed
      // as one contiguous fromDate/toDate range, so it's applied client-side
      // below instead, on top of whatever the (unfiltered) fetch returns.

      const result = await getMyRecords(params);
      let records = result.records;
      if (year === null && month !== null) {
        records = records.filter((r) => new Date(r.date).getMonth() + 1 === month);
      }
      setData({ ...result, records });
      const present = records.length;

      // "Present" / "Absent" only mean something against a single month.
      // Present/In Office/Remote are measured against the org's real
      // *total* working-day count for the whole selected month (Sundays
      // off; half-day Saturdays still count as a full day -- Settings
      // page), backend-authoritative since halfDayRules live server-side.
      // Absent, though, only counts working days that have *already
      // happened* -- a future working day the employee hasn't reached yet
      // isn't an absence, so it uses the elapsed-so-far count instead of
      // the whole-month total (equal to the total for a fully past month,
      // 0 for a future one).
      let totalWorkingDays;
      let absent;
      let workingSaturdays;
      if (year !== null && month !== null) {
        try {
          const result = await getWorkingDays(year, month);
          totalWorkingDays = result.totalWorkingDays;
          workingSaturdays = result.workingSaturdays;

          const now = new Date();
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
          if (isCurrentMonth) {
            // Absent days from 1st to yesterday (days elapsed prior to today without attendance)
            const pastDaysCount = Math.max(0, now.getDate() - 1);
            const presentBeforeToday = records.filter(
              (r) => new Date(r.date).getDate() < now.getDate()
            ).length;
            absent = Math.max(0, pastDaysCount - presentBeforeToday);
          } else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) {
            // Past month: total working days minus attendances
            absent = Math.max(0, result.totalWorkingDays - present);
          } else {
            // Future month
            absent = 0;
          }
        } catch {
          const now = new Date();
          const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
          totalWorkingDays = lastDay;
          workingSaturdays = 2;
          if (isCurrentMonth) {
            const pastDaysCount = Math.max(0, now.getDate() - 1);
            const presentBeforeToday = records.filter(
              (r) => new Date(r.date).getDate() < now.getDate()
            ).length;
            absent = Math.max(0, pastDaysCount - presentBeforeToday);
          } else {
            absent = Math.max(
              0,
              (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
                ? lastDay
                : 0) - present
            );
          }
        }
      }

      setStats({
        present,
        totalWorkingDays,
        absent,
        workingSaturdays,
        office: records.filter((r) => r.loginType === "OFFICE").length,
        distance: records.filter((r) => r.loginType === "DISTANCE").length,
        onTime: records.filter((r) => r.latenessStatus === "ON_TIME").length,
        late: records.filter((r) => r.latenessStatus !== "ON_TIME").length,
      });
    } catch {
      setData({ records: [], total: 0 });
      setStats(null);
    }
  }

  const handleClearFilters = () => {
    setStatusFilter(null);
    if (hasDateFilter) {
      setSelectedMonthNum(null);
      setSelectedYear(null);
    }
  };

  // Status quick-filters apply on top of whatever the month/year filter (or
  // lack of one) already fetched. "Absent" can never match a real record --
  // every row here represents a day the employee actually checked in, so an
  // absence never produces a row in the first place.
  const visibleRecords = (data?.records || []).filter((r) => {
    if (!statusFilter || statusFilter === "present") return true;
    if (statusFilter === "absent") return false;
    if (statusFilter === "ontime") return r.latenessStatus === "ON_TIME";
    if (statusFilter === "late") return r.latenessStatus === "SLIGHT_LATE" || r.latenessStatus === "VERY_LATE";
    return true;
  });

  /* Donut calculations (circumference = 2 * PI * 52 ≈ 326.7) */
  const circumference = 2 * Math.PI * 52;
  const officeDash = (MOCK_REPORT_DATA.workLocation.segments[0].pct / 100) * circumference;
  const remoteDash = (MOCK_REPORT_DATA.workLocation.segments[1].pct / 100) * circumference;
  const othersDash = (MOCK_REPORT_DATA.workLocation.segments[2].pct / 100) * circumference;

  return (
    <div className="att-report-page">
      {/* ══════════════════════════ TAB SWITCHER & CONTROLS ROW ══════════════════════════ */}
      <div className="att-report-tabs-bar">
        <div className="att-report-tabs">
          <button
            type="button"
            className={`att-tab-btn ${activeTab === "records" ? "active" : ""}`}
            onClick={() => setActiveTab("records")}
          >
            <ListChecks size={16} />
            <span>Attendance Records</span>
          </button>
          <button
            type="button"
            className={`att-tab-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>
        </div>

        <div className="att-report-controls">
          {activeTab === "reports" ? (
            <>
              <button type="button" className="att-month-select-btn" title="Select Month">
                <Calendar size={16} color="#0074F1" />
                <span>Sep 2025</span>
                <ChevronDown size={14} color="#64748b" />
              </button>

              <button
                type="button"
                className="att-export-btn"
                onClick={() => window.print()}
                title="Export Report"
              >
                <Download size={16} />
                <span>Export Report</span>
              </button>
            </>
          ) : (
            <>
              {/* Quick status filters -- sit to the left of the date filter,
                  same line. */}
              {[
                { key: "present", label: "Present" },
                { key: "absent", label: "Absent" },
                { key: "late", label: "Late" },
                { key: "ontime", label: "On Time" },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`att-btn ${statusFilter === f.key ? "att-btn-active" : ""}`}
                  onClick={() => setStatusFilter((prev) => (prev === f.key ? null : f.key))}
                >
                  {f.label}
                </button>
              ))}

              {/* Month + Year combined into a single button-styled control.
                  Both selects always render -- "All Months"/"All Years" are
                  real options in them, not a separate state that hides the
                  controls, so picking a specific date again after clearing
                  never requires anything but this same dropdown. */}
              <div className="att-btn att-month-year-combo" title="Filter by month and year">
                <Calendar size={16} color="#0074F1" />
                <select
                  className="att-month-select-native"
                  value={selectedMonthNum ?? ""}
                  onChange={(e) => setSelectedMonthNum(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">All Months</option>
                  {MONTH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <span className="att-month-year-divider" />
                <select
                  className="att-month-select-native"
                  value={selectedYear ?? ""}
                  onChange={(e) => setSelectedYear(e.target.value === "" ? null : Number(e.target.value))}
                >
                  <option value="">All Years</option>
                  {YEAR_OPTIONS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown size={14} color="#64748b" />
              </div>

              <button
                type="button"
                className="att-btn"
                onClick={handleClearFilters}
                disabled={!hasAnyFilter}
                title="Clear all filters"
              >
                <X size={15} />
                <span>Clear</span>
              </button>

              <button
                type="button"
                className="att-btn att-btn-solid"
                onClick={() => window.print()}
                title="Export"
              >
                <Download size={16} />
                <span>Export</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ══════════════════════════ TAB 1: REPORTS DASHBOARD ══════════════════════════ */}
      {activeTab === "reports" && (
        <>
          {/* ── Top 5 Metric Cards ── */}
          <div className="att-metrics-grid">
            {/* 1. Present */}
            <div className="att-metric-card green">
              <div className="att-metric-icon-circle">
                <Users size={22} />
              </div>
              <div className="att-metric-content">
                <span className="att-metric-value">{MOCK_REPORT_DATA.metrics.present.count}</span>
                <span className="att-metric-label">Present</span>
                <span className="att-metric-sub">{MOCK_REPORT_DATA.metrics.present.pct}</span>
              </div>
            </div>

            {/* 2. Work From Home */}
            <div className="att-metric-card blue">
              <div className="att-metric-icon-circle">
                <Monitor size={20} />
              </div>
              <div className="att-metric-content">
                <span className="att-metric-value">{MOCK_REPORT_DATA.metrics.wfh.count}</span>
                <span className="att-metric-label">Work From Home</span>
                <span className="att-metric-sub">{MOCK_REPORT_DATA.metrics.wfh.pct}</span>
              </div>
            </div>

            {/* 3. Half Day */}
            <div className="att-metric-card amber">
              <div className="att-metric-icon-circle">
                <Building size={20} />
              </div>
              <div className="att-metric-content">
                <span className="att-metric-value">{MOCK_REPORT_DATA.metrics.halfDay.count}</span>
                <span className="att-metric-label">Half Day</span>
                <span className="att-metric-sub">{MOCK_REPORT_DATA.metrics.halfDay.pct}</span>
              </div>
            </div>

            {/* 4. Leave */}
            <div className="att-metric-card red">
              <div className="att-metric-icon-circle">
                <Calendar size={20} />
              </div>
              <div className="att-metric-content">
                <span className="att-metric-value">{MOCK_REPORT_DATA.metrics.leave.count}</span>
                <span className="att-metric-label">Leave</span>
                <span className="att-metric-sub">{MOCK_REPORT_DATA.metrics.leave.pct}</span>
              </div>
            </div>

            {/* 5. Total Working Days */}
            <div className="att-metric-card purple">
              <div className="att-metric-icon-circle">
                <Users size={22} />
              </div>
              <div className="att-metric-content">
                <span className="att-metric-value">{MOCK_REPORT_DATA.metrics.totalWorkingDays.count}</span>
                <span className="att-metric-label">Total Working Days</span>
                <span className="att-metric-sub">{MOCK_REPORT_DATA.metrics.totalWorkingDays.period}</span>
              </div>
            </div>
          </div>

          {/* ── Middle Row (3 Columns) ── */}
          <div className="att-middle-row">
            {/* Column 1: Attendance Overview Bar Chart */}
            <div className="att-card">
              <div className="att-card-header">
                <h3 className="att-card-title">Attendance Overview</h3>
                <div className="att-card-dropdown">
                  <span>This Month</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              <div className="att-bar-chart-container">
                <div className="att-chart-plot-area">
                  {/* Y Axis Values */}
                  <div className="att-chart-y-axis">
                    <span>20</span>
                    <span>15</span>
                    <span>10</span>
                    <span>5</span>
                    <span>0</span>
                  </div>

                  {/* Horizontal Guideline */}
                  <div className="att-chart-grid-line" style={{ top: "0%" }} />
                  <div className="att-chart-grid-line" style={{ top: "25%" }} />
                  <div className="att-chart-grid-line" style={{ top: "50%" }} />
                  <div className="att-chart-grid-line" style={{ top: "75%" }} />

                  {/* Bars */}
                  {MOCK_REPORT_DATA.overview.map((item, idx) => {
                    const maxVal = 20;
                    const heightPct = Math.max(3, (item.value / maxVal) * 100);
                    return (
                      <div key={idx} className="att-bar-col">
                        <span className="att-bar-val-badge">{item.value}</span>
                        <div
                          className={`att-bar-pillar ${item.colorClass}`}
                          style={{ height: `${heightPct}%` }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X Axis Labels */}
                <div className="att-chart-x-labels">
                  {MOCK_REPORT_DATA.overview.map((item, idx) => (
                    <span key={idx} className="att-chart-x-label">
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Work Location Donut Chart */}
            <div className="att-card">
              <div className="att-card-header">
                <h3 className="att-card-title">Work Location</h3>
              </div>

              <div className="att-donut-layout">
                <div className="att-donut-wrap">
                  <svg viewBox="0 0 140 140" width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
                    {/* Background Track */}
                    <circle cx="70" cy="70" r="52" fill="none" stroke="#f1f5f9" strokeWidth="15" />

                    {/* Segment 1: In Office (82%) */}
                    <circle
                      cx="70"
                      cy="70"
                      r="52"
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="15"
                      strokeDasharray={`${officeDash} ${circumference}`}
                      strokeDashoffset="0"
                    />

                    {/* Segment 2: Remote (14%) */}
                    <circle
                      cx="70"
                      cy="70"
                      r="52"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="15"
                      strokeDasharray={`${remoteDash} ${circumference}`}
                      strokeDashoffset={-officeDash}
                    />

                    {/* Segment 3: Others (4%) */}
                    <circle
                      cx="70"
                      cy="70"
                      r="52"
                      fill="none"
                      stroke="#94a3b8"
                      strokeWidth="15"
                      strokeDasharray={`${othersDash} ${circumference}`}
                      strokeDashoffset={-(officeDash + remoteDash)}
                    />
                  </svg>

                  <div className="att-donut-center">
                    <span className="att-donut-days-num">{MOCK_REPORT_DATA.workLocation.totalDays}</span>
                    <span className="att-donut-days-label">Days</span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="att-donut-legend">
                  {MOCK_REPORT_DATA.workLocation.segments.map((seg, idx) => (
                    <div key={idx} className="att-donut-legend-item">
                      <div className="att-legend-left">
                        <span className={`att-legend-dot ${seg.class}`} />
                        <span>{seg.label}</span>
                      </div>
                      <span className="att-legend-val">
                        {seg.count} ({seg.pct}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 3: Monthly Calendar */}
            <div className="att-card">
              <div className="att-card-header">
                <h3 className="att-card-title">Monthly Calendar</h3>
                <div className="att-cal-header-controls">
                  <button type="button" className="att-cal-nav-btn">
                    <ChevronLeft size={16} />
                  </button>
                  <span>September 2025</span>
                  <button type="button" className="att-cal-nav-btn">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {/* Days Grid */}
              <div className="att-cal-grid">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                  <div key={idx} className="att-cal-day-header">
                    {day}
                  </div>
                ))}

                {/* Week 1 */}
                <div className="att-cal-cell dimmed">31</div>
                <div className="att-cal-cell">1</div>
                <div className="att-cal-cell">2</div>
                <div className="att-cal-cell wfh-badge">3</div>
                <div className="att-cal-cell">4</div>
                <div className="att-cal-cell">5</div>
                <div className="att-cal-cell">6</div>

                {/* Week 2 */}
                <div className="att-cal-cell">7</div>
                <div className="att-cal-cell">8</div>
                <div className="att-cal-cell">9</div>
                <div className="att-cal-cell">10</div>
                <div className="att-cal-cell">11</div>
                <div className="att-cal-cell leave-text">12</div>
                <div className="att-cal-cell">13</div>

                {/* Week 3 */}
                <div className="att-cal-cell">14</div>
                <div className="att-cal-cell">15</div>
                <div className="att-cal-cell">16</div>
                <div className="att-cal-cell">17</div>
                <div className="att-cal-cell halfday-circle">18</div>
                <div className="att-cal-cell">19</div>
                <div className="att-cal-cell">20</div>

                {/* Week 4 */}
                <div className="att-cal-cell">21</div>
                <div className="att-cal-cell">22</div>
                <div className="att-cal-cell">23</div>
                <div className="att-cal-cell">24</div>
                <div className="att-cal-cell">25</div>
                <div className="att-cal-cell">26</div>
                <div className="att-cal-cell">27</div>

                {/* Week 5 */}
                <div className="att-cal-cell">28</div>
                <div className="att-cal-cell">29</div>
                <div className="att-cal-cell">30</div>
                <div className="att-cal-cell dimmed">-</div>
                <div className="att-cal-cell dimmed">-</div>
                <div className="att-cal-cell dimmed">-</div>
                <div className="att-cal-cell dimmed">-</div>
              </div>

              {/* Calendar Legend */}
              <div className="att-cal-legend-row">
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot present" />
                  <span>Present</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot wfh" />
                  <span>Work From Home</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot leave" />
                  <span>Leave</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot halfday" />
                  <span>Half Day</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot absent" />
                  <span>Absent</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-ring" />
                  <span>Today</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Bottom Row (2 Columns) ── */}
          <div className="att-bottom-row">
            {/* Column 1: Working Hours Breakdown */}
            <div className="att-card">
              <div className="att-working-hours-header">
                <div className="att-wh-title-wrap">
                  <div className="att-wh-icon-wrap">
                    <Clock size={20} />
                  </div>
                  <div className="att-wh-texts">
                    <h2>Working Hours</h2>
                    <p>Detailed view of your working hours and productivity</p>
                  </div>
                </div>

                <div className="att-card-dropdown">
                  <span>This Month</span>
                  <ChevronDown size={12} />
                </div>
              </div>

              {/* 4 Mini Stat Cards */}
              <div className="att-wh-mini-cards">
                {/* 1. Total Hours Worked */}
                <div className="att-wh-mini-card blue">
                  <div className="att-wh-mini-top">
                    <div className="att-wh-mini-icon">
                      <Clock size={16} />
                    </div>
                    <span className="att-wh-mini-label">Total Hours Worked</span>
                  </div>
                  <span className="att-wh-mini-val">{MOCK_REPORT_DATA.workingHours.totalWorked}</span>
                  <span className="att-wh-mini-sub">of {MOCK_REPORT_DATA.workingHours.targetTotal}</span>
                  <div className="att-wh-progress-wrap">
                    <div className="att-wh-progress-bar">
                      <div
                        className="att-wh-progress-fill"
                        style={{ width: `${MOCK_REPORT_DATA.workingHours.percentage}%` }}
                      />
                    </div>
                    <span className="att-wh-progress-pct">{MOCK_REPORT_DATA.workingHours.percentage}%</span>
                  </div>
                </div>

                {/* 2. Average Daily Hours */}
                <div className="att-wh-mini-card green">
                  <div className="att-wh-mini-top">
                    <div className="att-wh-mini-icon">
                      <BarChart3 size={16} />
                    </div>
                    <span className="att-wh-mini-label">Average Daily Hours</span>
                  </div>
                  <span className="att-wh-mini-val">{MOCK_REPORT_DATA.workingHours.avgDaily}</span>
                  <span className="att-wh-mini-sub">Target: {MOCK_REPORT_DATA.workingHours.avgTarget}</span>
                </div>

                {/* 3. Extra Hours */}
                <div className="att-wh-mini-card purple">
                  <div className="att-wh-mini-top">
                    <div className="att-wh-mini-icon">
                      <Zap size={16} />
                    </div>
                    <span className="att-wh-mini-label">Extra Hours</span>
                  </div>
                  <span className="att-wh-mini-val">{MOCK_REPORT_DATA.workingHours.extraHours}</span>
                  <span className="att-wh-delta-badge green">{MOCK_REPORT_DATA.workingHours.extraDelta}</span>
                </div>

                {/* 4. Shortfall Hours */}
                <div className="att-wh-mini-card amber">
                  <div className="att-wh-mini-top">
                    <div className="att-wh-mini-icon">
                      <AlertCircle size={16} />
                    </div>
                    <span className="att-wh-mini-label">Shortfall Hours</span>
                  </div>
                  <span className="att-wh-mini-val">{MOCK_REPORT_DATA.workingHours.shortfallHours}</span>
                  <span className="att-wh-delta-badge red">{MOCK_REPORT_DATA.workingHours.shortfallDelta}</span>
                </div>
              </div>

              {/* Daily Working Hours Bar Chart */}
              <div className="att-daily-chart-section">
                <div className="att-daily-chart-header">
                  <span className="att-daily-chart-title">Daily Working Hours</span>
                  <div className="att-daily-chart-legend">
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 10, height: 10, background: "#0284c7", borderRadius: 2 }} />
                      <span>Worked Hours</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 16, height: 0, borderBottom: "1.5px dashed #93c5fd" }} />
                      <span>Target Hours (8h)</span>
                    </div>
                  </div>
                </div>

                <div className="att-daily-chart-area">
                  <div className="att-daily-y-axis">
                    <span>12h</span>
                    <span>8h</span>
                    <span>4h</span>
                    <span>0h</span>
                  </div>

                  {/* 8h Target Horizontal Dashed Line */}
                  <div className="att-daily-target-line" />

                  {/* 30 Bars */}
                  <div className="att-daily-bars-row">
                    {MOCK_REPORT_DATA.workingHours.daily.map((item) => {
                      const maxHours = 12;
                      const heightPct = Math.min(100, (item.hours / maxHours) * 100);
                      const isMuted = item.isWeekend || item.hours === 0;
                      return (
                        <div key={item.day} className="att-daily-bar-item" title={`Day ${item.day}: ${item.hours}h`}>
                          <div
                            className={`att-daily-pillar ${isMuted ? "muted" : ""}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X Axis Numbers (1 to 30) */}
                <div className="att-daily-x-axis">
                  {MOCK_REPORT_DATA.workingHours.daily.map((item) => (
                    <span key={item.day} className="att-daily-x-num">
                      {item.day}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Insights */}
            <div className="att-card att-insights-card">
              <div className="att-insights-header">
                <div className="att-insights-title-wrap">
                  <div className="att-insights-icon-circle">
                    <Zap size={18} />
                  </div>
                  <h3 className="att-insights-title">Insights</h3>
                </div>
                <a href="#details" className="att-view-details-link" onClick={(e) => e.preventDefault()}>
                  <span>View Details</span>
                  <ArrowRight size={14} />
                </a>
              </div>

              <div className="att-insights-list">
                {MOCK_REPORT_DATA.insights.map((ins, idx) => {
                  const Icon = ins.icon;
                  return (
                    <div key={idx} className="att-insight-item">
                      <div className={`att-insight-badge ${ins.badgeClass}`}>
                        <Icon size={16} />
                      </div>
                      <div className="att-insight-content">
                        <h4>{ins.title}</h4>
                        <p>{ins.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Motivational Quote Box */}
              <div className="att-quote-box">
                <p className="att-quote-text">“Small steps every day make big progress.”</p>
                <p className="att-quote-author">— InTime</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════════════ TAB 2: ATTENDANCE RECORDS TABLE ══════════════════════════ */}
      {activeTab === "records" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* ── 6 Colorful KPI Mini Cards ── */}
          <div className="att-records-kpi-grid">
            {[
              {
                label: "Present",
                value: outOf(stats?.present, stats?.totalWorkingDays),
                color: "cyan",
                icon: ListChecks,
              },
              {
                label: "In Office",
                value: outOf(
                  stats?.office,
                  stats?.totalWorkingDays != null && stats?.workingSaturdays != null
                    ? stats.totalWorkingDays - stats.workingSaturdays
                    : undefined
                ),
                color: "green",
                icon: Building,
              },
              {
                label: "Remote",
                value: outOf(stats?.distance, stats?.workingSaturdays),
                color: "blue",
                icon: Home,
              },
              { label: "On Time", value: stats?.onTime, color: "purple", icon: CheckCircle2 },
              { label: "Late", value: stats?.late, color: "amber", icon: Clock },
              {
                label: "Absent",
                value: stats?.absent != null ? Number(stats.absent.toFixed(1)) : undefined,
                color: "red",
                icon: AlertCircle,
              },
            ].map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div key={idx} className={`att-kpi-card ${kpi.color}`}>
                  <div className="att-kpi-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <div className="att-kpi-info">
                    <span className="att-kpi-val">{kpi.value ?? "—"}</span>
                    <span className="att-kpi-label">{kpi.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Records Data Table Card (same attlog-* design as the admin
               Attendance Logs table: fixed-height card, internal scroll,
               sticky header, colored work-mode/status pill badges) ── */}
          <div className="attlog-card" style={{ height: "calc(100vh - 420px)" }}>
            {data === null ? (
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
                      <th>Date</th>
                      <th className="th-checkin">Check In</th>
                      <th className="th-location">Check In Location</th>
                      <th className="th-checkout">Check Out</th>
                      <th className="th-location">Check Out Location</th>
                      <th className="th-workmode">Work Mode</th>
                      <th className="th-timestatus">Time Status</th>
                      <th className="th-hours">Total Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRecords.map((row, idx) => {
                      const isOffice = row.loginType === "OFFICE";
                      const inProgress = !row.checkOutTime;
                      const statusLabel = inProgress
                        ? "In Progress"
                        : row.latenessStatus === "VERY_LATE"
                        ? "Very Late"
                        : row.latenessStatus === "LATE"
                        ? "Late"
                        : row.latenessStatus === "SLIGHT_LATE"
                        ? "Slight Late"
                        : "On Time";
                      const statusBadgeClass = inProgress
                        ? "badge-inprogress"
                        : row.latenessStatus === "VERY_LATE"
                        ? "badge-verylate"
                        : row.latenessStatus === "LATE"
                        ? "badge-late"
                        : row.latenessStatus === "SLIGHT_LATE"
                        ? "badge-slightlate"
                        : "badge-ontime";
                      const locTitle = isOffice ? "Office" : row.reason || "Remote";

                      return (
                        <tr key={row._id}>
                          <td className="cell-num">{idx + 1}</td>
                          <td style={{ fontWeight: 600 }}>{formatDate(row.date, { weekday: undefined })}</td>
                          <td className="cell-time">
                            <CheckInTime time={row.checkInTime} latenessStatus={row.latenessStatus} />
                          </td>
                          <td className="cell-location">
                            <a
                              href={GOOGLE_MAPS_QUERY_URL(row.latitude, row.longitude)}
                              target="_blank"
                              rel="noreferrer"
                              className="attlog-location-link"
                              title="View on Google Maps"
                            >
                              <MapPin size={15} className="attlog-pin-icon" />
                              <div className="attlog-loc-details">
                                <span className="attlog-loc-title">{locTitle}</span>
                                <span className="attlog-loc-coords">
                                  {row.latitude != null ? row.latitude.toFixed(4) : "0.0000"},{" "}
                                  {row.longitude != null ? row.longitude.toFixed(4) : "0.0000"}
                                </span>
                              </div>
                            </a>
                          </td>
                          <td className="cell-time">{row.checkOutTime ? formatTime(row.checkOutTime) : "—"}</td>
                          <td className="cell-location">
                            {row.checkOutTime ? (
                              <a
                                href={GOOGLE_MAPS_QUERY_URL(
                                  row.checkOutLatitude ?? row.latitude,
                                  row.checkOutLongitude ?? row.longitude
                                )}
                                target="_blank"
                                rel="noreferrer"
                                className="attlog-location-link"
                                title="View on Google Maps"
                              >
                                <MapPin size={15} className="attlog-pin-icon" />
                                <div className="attlog-loc-details">
                                  <span className="attlog-loc-title">{locTitle}</span>
                                  <span className="attlog-loc-coords">
                                    {(row.checkOutLatitude ?? row.latitude ?? 0).toFixed(4)},{" "}
                                    {(row.checkOutLongitude ?? row.longitude ?? 0).toFixed(4)}
                                  </span>
                                </div>
                              </a>
                            ) : (
                              <span className="cell-empty-dash">—</span>
                            )}
                          </td>
                          <td className="cell-badge">
                            <span
                              className={`attlog-pill-badge attlog-workmode-badge ${
                                isOffice ? "badge-office" : "badge-remote"
                              }`}
                            >
                              {isOffice ? <Building2 size={13} /> : <Home size={13} />}
                              {isOffice ? "Office" : "Remote"}
                            </span>
                          </td>
                          <td className="cell-badge">
                            <span className={`attlog-pill-badge ${statusBadgeClass}`}>{statusLabel}</span>
                          </td>
                          <td className="cell-hours">
                            {row.checkOutTime ? formatMinutesAsHours(row.totalWorkingMinutes) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
