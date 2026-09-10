import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../Context/ToastContext";
import { getTodayAttendance } from "../../Services/attendanceService";
import { formatMinutesAsHours } from "../../Utils/dateUtils";

/* Helper to format ISO date/string into 12-hour AM/PM format (e.g. 09:02 AM) */
function formatTimeAmPm(dateInput) {
  if (!dateInput) return "-- : --";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "-- : --";
  return d
    .toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .toUpperCase();
}

/* ── Donut Chart Component ───────────────────────────────────── */
function DonutChart({ present = 18, weeklyOff = 3, leave = 1, absent = 0, total = 22 }) {
  const size = 150;
  const stroke = 15;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2,
    cy = size / 2;

  const safeTotal = total > 0 ? total : 22;
  const segments = [
    { value: present, color: "#10B981" }, // Green - Present
    { value: weeklyOff, color: "#60A5FA" }, // Light Blue - Weekly Off
    { value: leave, color: "#F59E0B" }, // Yellow - Leave
    { value: absent, color: "#EF4444" }, // Red - Absent
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const pct = s.value / safeTotal;
    const dash = pct * circ;
    const gap = circ - dash;
    const arc = { color: s.color, dash, gap, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} className="donut-svg">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={a.color}
            strokeWidth={stroke}
            strokeDasharray={`${a.dash} ${a.gap}`}
            strokeDashoffset={-a.offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
      </svg>
      <div className="donut-center">
        <span className="donut-center-num">
          {present}/{safeTotal}
        </span>
        <span className="donut-center-sub">Days</span>
      </div>
    </div>
  );
}

/* ── Mini Calendar Component ─────────────────────────────────── */
function MiniCalendar() {
  const [viewDate, setViewDate] = useState(new Date(2025, 8, 1));

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthName = viewDate.toLocaleString("en-US", { month: "long" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isCurrent: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrent: true, isSelected: d === 3 && month === 8 && year === 2025 });
  }
  const remaining = 35 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, isCurrent: false });
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="mini-calendar">
      <div className="cal-header">
        <span className="cal-title">Calendar</span>
        <div className="cal-right-controls">
          <span className="cal-month-label">
            {monthName} {year}
          </span>
          <div className="cal-nav">
            <button onClick={prevMonth} className="cal-nav-btn" aria-label="Previous month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button onClick={nextMonth} className="cal-nav-btn" aria-label="Next month">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="cal-day-name">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div
            key={i}
            className={`cal-day-cell ${!c.isCurrent ? "cal-muted" : ""} ${c.isSelected ? "cal-selected" : ""}`}
          >
            <span>{c.day}</span>
          </div>
        ))}
      </div>

      <div className="cal-legend">
        <span>
          <span className="leg-dot" style={{ background: "#10B981" }} />
          Present
        </span>
        <span>
          <span className="leg-dot" style={{ background: "#EF4444" }} />
          Absent
        </span>
        <span>
          <span className="leg-dot" style={{ background: "#F59E0B" }} />
          Leave
        </span>
        <span>
          <span className="leg-dot" style={{ background: "#60A5FA" }} />
          Weekly Off
        </span>
      </div>
    </div>
  );
}

/* ── Main Employee Home / Dashboard ─────────────────────────── */
export default function EmployeeHome() {
  const navigate = useNavigate();
  const toast = useToast();

  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  /* Fetch live attendance from real API */
  useEffect(() => {
    let isMounted = true;
    const loadToday = async () => {
      try {
        const att = await getTodayAttendance();
        if (isMounted) setTodayAttendance(att || null);
      } catch (err) {
        console.error("Failed to fetch today attendance:", err);
      } finally {
        if (isMounted) setLoadingAttendance(false);
      }
    };

    loadToday();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadToday();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  /* Check-in lateness badge computation aligned with Organization Late Status Criteria */
  const latenessInfo = useMemo(() => {
    if (!todayAttendance?.latenessStatus) {
      return { label: "On Time", color: "green" };
    }
    if (todayAttendance.latenessStatus === "ON_TIME") {
      return { label: "On Time", color: "green" };
    }
    if (todayAttendance.latenessStatus === "SLIGHT_LATE") {
      return { label: "Slight Late", color: "blue" };
    }
    if (todayAttendance.latenessStatus === "LATE") {
      return { label: "Late", color: "orange" };
    }
    return { label: "Very Late", color: "red" };
  }, [todayAttendance]);

  /* Working hours calculation with live seconds */
  const workingHours = useMemo(() => {
    if (!todayAttendance?.checkInTime) return "--";
    const start = new Date(todayAttendance.checkInTime);
    const end = todayAttendance.checkOutTime ? new Date(todayAttendance.checkOutTime) : currentTime;
    const diffMs = Math.max(0, end - start);
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    const s = Math.floor((diffMs % 60000) / 1000);
    return `${h}h ${m}m ${s}s`;
  }, [todayAttendance, currentTime]);

  const isCheckedIn = !!todayAttendance?.checkInTime;
  const isCheckedOut = !!todayAttendance?.checkOutTime;

  const pastHistory = [
    {
      month: "SEP",
      day: "03",
      weekday: "Wednesday",
      status: "Present",
      statusType: "present",
      checkIn: "09:02 AM",
      checkOut: "-- : --",
    },
    {
      month: "SEP",
      day: "02",
      weekday: "Tuesday",
      status: "Present",
      statusType: "present",
      checkIn: "09:05 AM",
      checkOut: "06:01 PM",
    },
    {
      month: "SEP",
      day: "01",
      weekday: "Monday",
      status: "Present",
      statusType: "present",
      checkIn: "09:00 AM",
      checkOut: "06:03 PM",
    },
    {
      month: "AUG",
      day: "29",
      weekday: "Friday",
      status: "Absent",
      statusType: "absent",
      checkIn: "-- : --",
      checkOut: "-- : --",
    },
    {
      month: "AUG",
      day: "28",
      weekday: "Thursday",
      status: "Present",
      statusType: "present",
      checkIn: "09:01 AM",
      checkOut: "06:05 PM",
    },
  ];

  const upcomingHolidays = [
    { month: "OCT", day: "02", name: "Gandhi Jayanti", weekday: "Thursday" },
    { month: "OCT", day: "20", name: "Diwali", weekday: "Monday" },
    { month: "DEC", day: "25", name: "Christmas Day", weekday: "Thursday" },
  ];

  return (
    <>
      {/* ── Top Metric Cards Row (4 cards) ── */}
      <div className="metrics-grid">
        {/* 1. Check-In Card (Real Data) */}
        <div className="metric-card">
          <div className="metric-icon-circle green">
            <svg viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">Check-In</span>
            <span className="metric-value" style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
              {todayAttendance?.checkInTime ? (
                <>
                  <span className={`checkin-status-dot dot-${latenessInfo.color}`} />
                  <span>{formatTimeAmPm(todayAttendance.checkInTime)}</span>
                </>
              ) : (
                "-- : --"
              )}
            </span>
            <div className="metric-status-row">
              {todayAttendance?.checkInTime ? (
                <>
                  <span className={`status-dot ${latenessInfo.color}`} />
                  <span className={`status-text ${latenessInfo.color}`}>{latenessInfo.label}</span>
                </>
              ) : (
                <>
                  <span className="status-dot yellow" />
                  <span className="status-text" style={{ color: "#94A3B8" }}>
                    Not marked
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Check-Out Card (Real Data) */}
        <div className="metric-card">
          <div className="metric-icon-circle red">
            <svg viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
              <polyline points="17 8 22 12 17 16" />
              <line x1="22" y1="12" x2="10" y2="12" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">Check-Out</span>
            <span className="metric-value">
              {todayAttendance?.checkOutTime
                ? formatTimeAmPm(todayAttendance.checkOutTime)
                : "-- : --"}
            </span>
            <span className="metric-subtext">
              {todayAttendance?.checkOutTime
                ? "Completed"
                : todayAttendance?.checkInTime
                ? "Not yet checked out"
                : "Not yet checked in"}
            </span>
          </div>
        </div>

        {/* 3. Working Hours Card (Real Data) */}
        <div className="metric-card">
          <div className="metric-icon-circle blue">
            <svg viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">Working Hours</span>
            <span className="metric-value">{workingHours}</span>
            <span className="metric-subtext">Today</span>
          </div>
        </div>

        {/* 4. Work Status Card (Real Data) */}
        <div className="metric-card">
          <div className="metric-icon-circle purple">
            <svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">Work Status</span>
            <div
              className="work-status-badge"
              style={
                !isCheckedIn
                  ? { background: "#F1F5F9", color: "#64748B" }
                  : isCheckedOut
                  ? { background: "#E0F2FE", color: "#0284C7" }
                  : undefined
              }
            >
              {isCheckedOut ? "Completed" : isCheckedIn ? "On Duty" : "Off Duty"}
            </div>
            <span className="metric-subtext">
              {todayAttendance?.loginType
                ? `Work Mode - ${todayAttendance.loginType === "DISTANCE" ? "Remote" : "Office"}`
                : isCheckedIn
                ? "Work Mode - Office"
                : "Work Mode - None"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Middle 3-Column Content Grid ── */}
      <div className="dashboard-columns-grid">
        {/* ══ COLUMN 1: Attendance History ══ */}
        <div className="card-box history-box">
          <div className="card-box-header">
            <h2 className="card-box-title">Attendance History</h2>
            <Link to="/employee/records" className="card-box-link">
              View All →
            </Link>
          </div>

          <div className="history-list">
            {pastHistory.map((item, idx) => (
              <div className="history-row" key={idx}>
                <div className="date-badge">
                  <span className="date-badge-month">{item.month}</span>
                  <span className="date-badge-day">{item.day}</span>
                </div>

                <div className="history-col weekday-col">
                  <span className="history-weekday">{item.weekday}</span>
                  <div className="history-status-indicator">
                    <span className={`status-dot ${item.statusType}`} />
                    <span className={`status-text ${item.statusType}`}>{item.status}</span>
                  </div>
                </div>

                <div className="history-col time-col">
                  <span className="history-time">{item.checkIn}</span>
                  <span className="history-time-label">Check-In</span>
                </div>

                <div className="history-col time-col">
                  <span className="history-time">{item.checkOut}</span>
                  <span className="history-time-label">Check-Out</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══ COLUMN 2: This Month + Upcoming Holiday ══ */}
        <div className="stacked-cards-col">
          {/* Card 1: This Month */}
          <div className="card-box this-month-box">
            <div className="card-box-header">
              <h2 className="card-box-title">This Month</h2>
              <Link to="/employee/records" className="card-box-link">
                View Details →
              </Link>
            </div>

            <div className="this-month-body">
              <DonutChart present={18} weeklyOff={3} leave={1} absent={0} total={22} />

              <div className="donut-legend">
                <div className="legend-item">
                  <span className="leg-dot green" />
                  <span className="leg-name">Present</span>
                  <span className="leg-val">18</span>
                </div>
                <div className="legend-item">
                  <span className="leg-dot blue" />
                  <span className="leg-name">Weekly Off</span>
                  <span className="leg-val">3</span>
                </div>
                <div className="legend-item">
                  <span className="leg-dot yellow" />
                  <span className="leg-name">Leave</span>
                  <span className="leg-val">1</span>
                </div>
                <div className="legend-item">
                  <span className="leg-dot red" />
                  <span className="leg-name">Absent</span>
                  <span className="leg-val">0</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Upcoming Holiday */}
          <div className="card-box holiday-box">
            <div className="card-box-header">
              <h2 className="card-box-title">Upcoming Holiday</h2>
              <Link to="/employee/leave" className="card-box-link">
                View All →
              </Link>
            </div>

            <div className="holiday-list">
              {upcomingHolidays.map((h, i) => (
                <div className="holiday-row" key={i}>
                  <div className="date-badge">
                    <span className="date-badge-month">{h.month}</span>
                    <span className="date-badge-day">{h.day}</span>
                  </div>
                  <div className="holiday-info">
                    <span className="holiday-name">{h.name}</span>
                    <span className="holiday-weekday">{h.weekday}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ COLUMN 3: Quick Actions + Calendar ══ */}
        <div className="stacked-cards-col">
          {/* Card 1: Quick Actions */}
          <div className="card-box quick-actions-box">
            <div className="card-box-header">
              <h2 className="card-box-title">Quick Actions</h2>
            </div>

            <div className="quick-actions-grid">
              {/* Action 1: Apply Leave */}
              <button className="qa-card blue" onClick={() => navigate("/employee/leave")}>
                <div className="qa-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="#0074F1">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
                  </svg>
                </div>
                <span className="qa-text">Apply Leave</span>
              </button>

              {/* Action 2: Give Attendance */}
              <button className="qa-card green" onClick={() => navigate("/employee/attendance")}>
                <div className="qa-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="#10B981">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
                  </svg>
                </div>
                <span className="qa-text">Give Attendance</span>
              </button>

              {/* Action 3: My History */}
              <button className="qa-card purple" onClick={() => navigate("/employee/records")}>
                <div className="qa-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 15 15" />
                  </svg>
                </div>
                <span className="qa-text">My History</span>
              </button>

              {/* Action 4: View Reports */}
              <button
                className="qa-card orange"
                onClick={() =>
                  toast?.info
                    ? toast.info("Attendance reports will be downloaded.")
                    : alert("Attendance reports will be downloaded.")
                }
              >
                <div className="qa-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <span className="qa-text">View Reports</span>
              </button>
            </div>
          </div>

          {/* Card 2: Calendar */}
          <div className="card-box calendar-box">
            <MiniCalendar />
          </div>
        </div>
      </div>

      {/* ── Motivational Bottom Banner ── */}
      <div className="bottom-motivational-banner">
        <img
          src="/dashboard-banner-2x.png"
          alt="Discipline Today Builds a Better Tomorrow - Work Today for a Better Tomorrow"
          className="banner-exact-img"
        />
      </div>
    </>
  );
}
