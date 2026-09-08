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
  Monitor,
  Search,
  MapPin,
  MoreHorizontal,
  ArrowUpDown,
} from "lucide-react";
import { getMyRecords } from "../../Services/attendanceService";
import { formatDate, formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL } from "../../Utils/constants";
import StatusBadge from "../../Components/Common/StatusBadge";
import EmptyState from "../../Components/Common/EmptyState";
import "../../Styles/AttendanceReport.css";

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
   Mock Data for Attendance Records (September 2025)
══════════════════════════════════════════════════════════════════════════════ */
const MOCK_RECORDS_METRICS = [
  { label: "Present", value: 18, color: "green", icon: CheckCircle2 },
  { label: "Work From Home", value: 3, color: "blue", icon: Home },
  { label: "Half Day", value: 1, color: "amber", icon: Clock },
  { label: "Leave", value: 1, color: "red", icon: Calendar },
  { label: "Absent", value: 0, color: "purple", icon: AlertCircle },
  { label: "Total Records", value: 22, color: "cyan", icon: ListChecks },
];

const MOCK_TABLE_RECORDS = [
  { id: 1, date: "03 Sep 2025", day: "Wed", status: "present", statusLabel: "Present", checkIn: "09:02 AM", checkOut: "06:01 PM", hours: "8h 59m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "—" },
  { id: 2, date: "02 Sep 2025", day: "Tue", status: "remote", statusLabel: "Remote", checkIn: "09:10 AM", checkOut: "06:15 PM", hours: "9h 05m", type: "Work From Home", typeIcon: "home", location: "Kolkata, WB", remarks: "—" },
  { id: 3, date: "01 Sep 2025", day: "Mon", status: "present", statusLabel: "Present", checkIn: "09:00 AM", checkOut: "06:03 PM", hours: "9h 03m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "—" },
  { id: 4, date: "29 Aug 2025", day: "Fri", status: "leave", statusLabel: "Leave", checkIn: "—", checkOut: "—", hours: "—", type: null, typeIcon: null, location: "—", remarks: "Sick Leave" },
  { id: 5, date: "28 Aug 2025", day: "Thu", status: "halfday", statusLabel: "Half Day", checkIn: "09:05 AM", checkOut: "01:00 PM", hours: "3h 55m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "Personal Work" },
  { id: 6, date: "27 Aug 2025", day: "Wed", status: "present", statusLabel: "Present", checkIn: "09:01 AM", checkOut: "06:00 PM", hours: "8h 59m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "—" },
  { id: 7, date: "26 Aug 2025", day: "Tue", status: "remote", statusLabel: "Remote", checkIn: "09:15 AM", checkOut: "06:10 PM", hours: "8h 55m", type: "Work From Home", typeIcon: "home", location: "Kolkata, WB", remarks: "—" },
  { id: 8, date: "25 Aug 2025", day: "Mon", status: "present", statusLabel: "Present", checkIn: "09:00 AM", checkOut: "06:05 PM", hours: "9h 05m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "—" },
  { id: 9, date: "22 Aug 2025", day: "Fri", status: "present", statusLabel: "Present", checkIn: "09:08 AM", checkOut: "06:12 PM", hours: "9h 04m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "—" },
  { id: 10, date: "21 Aug 2025", day: "Thu", status: "present", statusLabel: "Present", checkIn: "09:12 AM", checkOut: "06:00 PM", hours: "8h 48m", type: "In Office", typeIcon: "office", location: "Kolkata, Office", remarks: "—" },
];

/* ══════════════════════════════════════════════════════════════════════════════
   Main Component: AttendanceRecords (Report Page)
══════════════════════════════════════════════════════════════════════════════ */
export default function AttendanceRecords() {
  const [activeTab, setActiveTab] = useState("reports"); // "reports" | "records"

  /* Attendance Records Filters & Search */
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [filterLocation, setFilterLocation] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [recordsPage, setRecordsPage] = useState(1);

  /* Filtered Records calculation */
  const filteredRecords = MOCK_TABLE_RECORDS.filter((rec) => {
    if (filterStatus !== "ALL" && rec.status.toUpperCase() !== filterStatus) return false;
    if (filterType !== "ALL") {
      if (filterType === "OFFICE" && rec.type !== "In Office") return false;
      if (filterType === "WFH" && rec.type !== "Work From Home") return false;
    }
    if (filterLocation !== "ALL" && rec.location !== filterLocation) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        rec.date.toLowerCase().includes(q) ||
        rec.location.toLowerCase().includes(q) ||
        rec.remarks.toLowerCase().includes(q) ||
        rec.statusLabel.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  /* Attendance Records Table State for API fallback */
  const [filters, setFilters] = useState({ fromDate: "", toDate: "", loginType: "", status: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (activeTab === "records") {
      loadRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, activeTab]);

  async function loadRecords() {
    setData(null);
    const params = { page, limit: 10 };
    if (filters.fromDate) params.fromDate = filters.fromDate;
    if (filters.toDate) params.toDate = filters.toDate;
    if (filters.loginType) params.loginType = filters.loginType;
    if (filters.status) params.status = filters.status;
    try {
      const result = await getMyRecords(params);
      setData(result);
    } catch {
      setData({ records: [], pagination: { total: 0, pages: 1 } });
    }
  }

  const applyFilters = (e) => {
    e.preventDefault();
    setPage(1);
    loadRecords();
  };

  const resetFilters = () => {
    setFilters({ fromDate: "", toDate: "", loginType: "", status: "" });
    setPage(1);
    setTimeout(loadRecords, 0);
  };

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
            className={`att-tab-btn ${activeTab === "reports" ? "active" : ""}`}
            onClick={() => setActiveTab("reports")}
          >
            <BarChart3 size={16} />
            <span>Reports</span>
          </button>
          <button
            type="button"
            className={`att-tab-btn ${activeTab === "records" ? "active" : ""}`}
            onClick={() => setActiveTab("records")}
          >
            <ListChecks size={16} />
            <span>Attendance Records</span>
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
              <button type="button" className="att-month-select-btn" title="Select Date Range">
                <Calendar size={16} color="#0074F1" />
                <span>01 Sep 2025 - 30 Sep 2025</span>
                <ChevronDown size={14} color="#64748b" />
              </button>

              <button
                type="button"
                className="att-export-btn solid-blue"
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
          {/* ── Filter Card ── */}
          <div className="att-records-filter-card">
            <div className="att-records-filter-form">
              {/* Date Range */}
              <div className="att-filter-col">
                <label className="att-filter-label">Date Range</label>
                <button
                  type="button"
                  className="att-filter-select"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 200,
                    justifyContent: "space-between",
                  }}
                >
                  <span>01 Sep 2025 - 30 Sep 2025</span>
                  <ChevronDown size={14} color="#64748b" />
                </button>
              </div>

              {/* Status */}
              <div className="att-filter-col">
                <label className="att-filter-label">Status</label>
                <select
                  className="att-filter-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="ALL">All Status</option>
                  <option value="PRESENT">Present</option>
                  <option value="REMOTE">Remote</option>
                  <option value="LEAVE">Leave</option>
                  <option value="HALFDAY">Half Day</option>
                  <option value="ABSENT">Absent</option>
                </select>
              </div>

              {/* Attendance Type */}
              <div className="att-filter-col">
                <label className="att-filter-label">Attendance Type</label>
                <select
                  className="att-filter-select"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="ALL">All Types</option>
                  <option value="OFFICE">In Office</option>
                  <option value="WFH">Work From Home</option>
                </select>
              </div>

              {/* Location */}
              <div className="att-filter-col">
                <label className="att-filter-label">Location</label>
                <select
                  className="att-filter-select"
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                >
                  <option value="ALL">All Locations</option>
                  <option value="Kolkata, Office">Kolkata, Office</option>
                  <option value="Kolkata, WB">Kolkata, WB</option>
                </select>
              </div>

              {/* Search */}
              <div className="att-filter-col grow">
                <label className="att-filter-label">Search</label>
                <div className="att-search-wrap">
                  <Search size={16} className="att-search-icon" />
                  <input
                    type="text"
                    className="att-search-input"
                    placeholder="Search by date, location or remarks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="att-filter-btn-group">
                <button
                  type="button"
                  className="att-filter-btn reset"
                  onClick={() => {
                    setFilterStatus("ALL");
                    setFilterType("ALL");
                    setFilterLocation("ALL");
                    setSearchQuery("");
                  }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="att-filter-btn apply"
                  onClick={() => {}}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* ── 6 Colorful KPI Mini Cards ── */}
          <div className="att-records-kpi-grid">
            {MOCK_RECORDS_METRICS.map((kpi, idx) => {
              const Icon = kpi.icon;
              return (
                <div key={idx} className={`att-kpi-card ${kpi.color}`}>
                  <div className="att-kpi-icon-wrap">
                    <Icon size={18} />
                  </div>
                  <div className="att-kpi-info">
                    <span className="att-kpi-val">{kpi.value}</span>
                    <span className="att-kpi-label">{kpi.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Records Data Table Card ── */}
          <div className="att-records-table-card">
            <div className="att-records-table-wrap">
              <table className="att-table-custom">
                <thead>
                  <tr>
                    <th style={{ width: 44, textAlign: "center" }}>#</th>
                    <th>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                        <span>Date</span>
                        <ArrowUpDown size={12} color="#94a3b8" />
                      </div>
                    </th>
                    <th>Day</th>
                    <th>Status</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Working Hours</th>
                    <th>Attendance Type</th>
                    <th>Location</th>
                    <th>Remarks</th>
                    <th style={{ textAlign: "center" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((row) => (
                    <tr key={row.id}>
                      <td style={{ textAlign: "center", color: "#64748b" }}>{row.id}</td>
                      <td style={{ fontWeight: 600 }}>{row.date}</td>
                      <td style={{ color: "#64748b" }}>{row.day}</td>
                      <td>
                        <span className={`att-status-badge ${row.status}`}>
                          <span className="att-status-dot" />
                          <span>{row.statusLabel}</span>
                        </span>
                      </td>
                      <td>{row.checkIn}</td>
                      <td>{row.checkOut}</td>
                      <td style={{ fontWeight: 600 }}>{row.hours}</td>
                      <td>
                        {row.type ? (
                          <div className="att-type-cell">
                            {row.typeIcon === "office" ? (
                              <Building size={14} className="att-type-icon" />
                            ) : (
                              <Home size={14} className="att-type-icon" />
                            )}
                            <span>{row.type}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {row.location !== "—" ? (
                          <div className="att-location-cell">
                            <MapPin size={14} className="att-location-icon" />
                            <span>{row.location}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td style={{ color: row.remarks !== "—" ? "#1e293b" : "#94a3b8" }}>
                        {row.remarks}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button type="button" className="att-action-menu-btn" title="Actions">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Footer & Pagination ── */}
            <div className="att-records-footer">
              <span className="att-records-count-text">
                Showing 1–{filteredRecords.length} of 22 records
              </span>
              <div className="att-records-pagination">
                <button
                  type="button"
                  className="att-page-nav-btn"
                  disabled={recordsPage <= 1}
                  onClick={() => setRecordsPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={14} /> Previous
                </button>
                <button
                  type="button"
                  className={`att-page-num-btn ${recordsPage === 1 ? "active" : ""}`}
                  onClick={() => setRecordsPage(1)}
                >
                  1
                </button>
                <button
                  type="button"
                  className={`att-page-num-btn ${recordsPage === 2 ? "active" : ""}`}
                  onClick={() => setRecordsPage(2)}
                >
                  2
                </button>
                <button
                  type="button"
                  className={`att-page-num-btn ${recordsPage === 3 ? "active" : ""}`}
                  onClick={() => setRecordsPage(3)}
                >
                  3
                </button>
                <button
                  type="button"
                  className="att-page-nav-btn"
                  disabled={recordsPage >= 3}
                  onClick={() => setRecordsPage((p) => Math.min(3, p + 1))}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
