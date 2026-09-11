import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../../Context/ToastContext";
import {
  getTodayAttendance,
  getMyRecords,
  getWorkingDays,
  getEmployeeSettings,
} from "../../Services/attendanceService";
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

/* Helper to parse holiday date strings in DD/MM/YYYY or YYYY-MM-DD or standard formats */
function parseHolidayDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    return {
      day,
      month,
      year,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dateObj: new Date(year, month - 1, day),
    };
  }
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    return {
      day,
      month,
      year,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dateObj: new Date(year, month - 1, day),
    };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    return {
      day,
      month,
      year,
      dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      dateObj: d,
    };
  }
  return null;
}

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function literalOccurrenceInMonth(day) {
  return Math.ceil(day / 7);
}

function isConfiguredHalfDay(year, month, day, dayOfWeek, halfDayRules) {
  if (!halfDayRules || halfDayRules.length === 0) return false;
  const occurrence = literalOccurrenceInMonth(day);
  return halfDayRules.some(
    (rule) => rule.dayOfWeek === dayOfWeek && rule.occurrence === occurrence
  );
}

/* ── Donut Chart Component ───────────────────────────────────── */
function DonutChart({
  present = 0,
  weeklyOff = 0,
  leave = 0,
  absent = 0,
  total = 24,
  daysInMonth = 30,
}) {
  const size = 150;
  const stroke = 15;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const cx = size / 2,
    cy = size / 2;

  const safeTotal = total > 0 ? total : 24;
  const baseDays = daysInMonth > 0 ? daysInMonth : 30;

  const segments = [
    { value: present, color: "#10B981" }, // Green - Present
    { value: weeklyOff, color: "#3B82F6" }, // Blue - Weekly Off
    { value: leave, color: "#F59E0B" }, // Yellow - Leave
    { value: absent, color: "#EF4444" }, // Red - Absent
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const pct = s.value / baseDays;
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
function MiniCalendar({ holidays = [], halfDayRules = [] }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [viewRecords, setViewRecords] = useState([]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-indexed
  const monthName = viewDate.toLocaleString("en-US", { month: "long" });
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  // Load attendance records for the calendar month currently viewed
  useEffect(() => {
    let active = true;
    const fetchRecords = async () => {
      try {
        const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        const toDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
        const res = await getMyRecords({ fromDate, toDate, limit: 100 });
        if (active && res?.records) {
          setViewRecords(res.records);
        }
      } catch (err) {
        console.error("Failed to load calendar month records:", err);
      }
    };
    fetchRecords();
    return () => {
      active = false;
    };
  }, [year, month, daysInMonth]);

  // Map of holiday dates: YYYY-MM-DD -> holiday
  const holidayMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(holidays)) return map;
    for (const h of holidays) {
      const parsed = parseHolidayDate(h.date);
      if (parsed) {
        map.set(parsed.dateKey, h);
      }
    }
    return map;
  }, [holidays]);

  // Map of attendance records: YYYY-MM-DD -> record
  const recordsMap = useMemo(() => {
    const map = new Map();
    if (!Array.isArray(viewRecords)) return map;
    for (const r of viewRecords) {
      if (r.workingDateKey) {
        map.set(r.workingDateKey, r);
      } else if (r.date) {
        const d = new Date(r.date);
        if (!isNaN(d.getTime())) {
          map.set(toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate()), r);
        }
      }
    }
    return map;
  }, [viewRecords]);

  // Today reference at midnight
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: prevMonthDays - i, isCurrent: false, statusClass: "cal-muted" });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = toDateKey(year, month + 1, d);
    const dateObj = new Date(year, month, d);
    const cellMidnight = dateObj.getTime();
    const dayOfWeek = dateObj.getDay();

    const isToday = cellMidnight === todayMidnight;
    const isPast = cellMidnight < todayMidnight;
    const isFuture = cellMidnight > todayMidnight;

    const holiday = holidayMap.get(dateKey);
    const isSunday = dayOfWeek === 0;
    const isOffSaturday =
      dayOfWeek === 6 && isConfiguredHalfDay(year, month + 1, d, 6, halfDayRules);
    const isWeeklyOff = isSunday || isOffSaturday;
    const record = recordsMap.get(dateKey);

    let statusClass = "";
    let title = "";

    // 1. Holiday: purple color (all holidays in calendar marked with purple color)
    if (holiday) {
      statusClass = "status-holiday";
      title = `${holiday.name} (Holiday)`;
    } else if (record) {
      // 2. Present: green outline box
      statusClass = "status-present";
      title = `Present (${formatTimeAmPm(record.checkInTime)})`;
    } else if (isWeeklyOff && (isPast || isToday)) {
      // 3. Weekly off: blue outline box for elapsed/current off days
      statusClass = "status-weekoff";
      title = "Weekly Off";
    } else if (isPast) {
      // 4. Past working day without attendance: absent red outline box
      statusClass = "status-absent";
      title = "Absent";
    } else if (isToday) {
      statusClass = "is-today";
      title = "Today";
    } else {
      // 5. Upcoming dates: keep blank only date no border with color
      statusClass = "status-upcoming";
      title = isWeeklyOff ? "Weekly Off" : "";
    }

    cells.push({
      day: d,
      isCurrent: true,
      statusClass,
      title,
    });
  }

  const remaining = 35 - cells.length;
  const extraNeeded = remaining < 0 ? 42 - cells.length : remaining;
  for (let d = 1; d <= extraNeeded; d++) {
    cells.push({ day: d, isCurrent: false, statusClass: "cal-muted" });
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
            className={`cal-day-cell ${!c.isCurrent ? "cal-muted" : ""} ${c.statusClass || ""}`}
            title={c.title || ""}
          >
            <div className="cal-day-inner">{c.day}</div>
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
          <span className="leg-dot" style={{ background: "#3B82F6" }} />
          Weekly Off
        </span>
        <span>
          <span className="leg-dot" style={{ background: "#8B5CF6" }} />
          Holiday
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
  const [recentRecords, setRecentRecords] = useState([]);
  const [currentMonthRecords, setCurrentMonthRecords] = useState([]);
  const [orgSettings, setOrgSettings] = useState(null);
  const [workingDaysData, setWorkingDaysData] = useState(null);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());

  /* Fetch live attendance, settings, and records from real APIs */
  useEffect(() => {
    let isMounted = true;
    const loadData = async () => {
      try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        const lastDay = new Date(year, month, 0).getDate();
        const fromDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const toDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const [todayAtt, recents, monthRecs, settings, wDays] = await Promise.allSettled([
          getTodayAttendance(),
          getMyRecords({ limit: 5 }),
          getMyRecords({ fromDate, toDate, limit: 100 }),
          getEmployeeSettings(),
          getWorkingDays(year, month),
        ]);

        if (!isMounted) return;

        if (todayAtt.status === "fulfilled") setTodayAttendance(todayAtt.value || null);
        if (recents.status === "fulfilled") setRecentRecords(recents.value?.records || []);
        if (monthRecs.status === "fulfilled") setCurrentMonthRecords(monthRecs.value?.records || []);
        if (settings.status === "fulfilled") setOrgSettings(settings.value || null);
        if (wDays.status === "fulfilled") setWorkingDaysData(wDays.value || null);
      } catch (err) {
        console.error("Failed to load employee dashboard data:", err);
      } finally {
        if (isMounted) setLoadingAttendance(false);
      }
    };

    loadData();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData();
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

  /* Fast lookup set of holiday date keys (YYYY-MM-DD) */
  const holidayKeySet = useMemo(() => {
    const set = new Set();
    if (Array.isArray(orgSettings?.holidays)) {
      for (const h of orgSettings.holidays) {
        const p = parseHolidayDate(h.date);
        if (p) set.add(p.dateKey);
      }
    }
    return set;
  }, [orgSettings]);

  /* Real attendance history formatted for display */
  const attendanceHistoryList = useMemo(() => {
    if (!recentRecords || recentRecords.length === 0) {
      return [];
    }
    return recentRecords.map((r) => {
      const d = new Date(r.date || r.checkInTime);
      const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
      const day = String(d.getDate()).padStart(2, "0");
      const weekday = d.toLocaleString("en-US", { weekday: "long" });

      let status = "Present";
      let statusType = "green";

      if (r.insufficientHours) {
        status = "Insufficient Hours";
        statusType = "orange";
      } else if (r.latenessStatus === "VERY_LATE") {
        status = "Very Late";
        statusType = "red";
      } else if (r.latenessStatus === "LATE") {
        status = "Late";
        statusType = "orange";
      } else if (r.latenessStatus === "SLIGHT_LATE") {
        status = "Slight Late";
        statusType = "blue";
      } else {
        status = "Present";
        statusType = "green";
      }

      return {
        month,
        day,
        weekday,
        status,
        statusType,
        checkIn: formatTimeAmPm(r.checkInTime),
        checkOut: formatTimeAmPm(r.checkOutTime),
      };
    });
  }, [recentRecords]);

  /* Real upcoming holidays from admin settings */
  const upcomingHolidaysList = useMemo(() => {
    if (!orgSettings?.holidays || !Array.isArray(orgSettings.holidays)) {
      return [];
    }
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const parsedList = [];
    for (const h of orgSettings.holidays) {
      const parsed = parseHolidayDate(h.date);
      if (parsed && parsed.dateObj) {
        parsedList.push({
          ...h,
          parsed,
          timestamp: parsed.dateObj.getTime(),
        });
      }
    }

    // Filter holidays on or after today, sort ascending
    const upcoming = parsedList.filter((h) => h.timestamp >= todayMidnight);
    upcoming.sort((a, b) => a.timestamp - b.timestamp);

    const listToUse = upcoming.length > 0 ? upcoming : parsedList;

    return listToUse.map((h) => {
      const month = h.parsed.dateObj.toLocaleString("en-US", { month: "short" }).toUpperCase();
      const day = String(h.parsed.day).padStart(2, "0");
      const weekday = h.parsed.dateObj.toLocaleString("en-US", { weekday: "long" });
      return {
        name: h.name,
        month,
        day,
        weekday,
      };
    });
  }, [orgSettings]);

  /* Real monthly breakdown for This Month card */
  const thisMonthStats = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayDate = now.getDate();

    const totalWorkingDays = workingDaysData?.totalWorkingDays ?? 24;
    const weeklyOff = Math.max(0, daysInMonth - totalWorkingDays);

    const presentCount = currentMonthRecords.length;
    const leaveCount = 0;

    // Absent count: elapsed working days prior to today without attendance
    let absentCount = 0;
    for (let d = 1; d < todayDate; d++) {
      const dObj = new Date(year, month - 1, d);
      const dayOfWeek = dObj.getDay();
      const dateKey = toDateKey(year, month, d);

      const isHoliday = holidayKeySet.has(dateKey);
      const isSun = dayOfWeek === 0;
      const isOffSat =
        dayOfWeek === 6 && isConfiguredHalfDay(year, month, d, 6, orgSettings?.halfDayRules || []);
      const isOff = isSun || isOffSat;

      if (!isHoliday && !isOff) {
        const attended = currentMonthRecords.some((r) => r.workingDateKey === dateKey);
        if (!attended) {
          absentCount++;
        }
      }
    }

    return {
      present: presentCount,
      weeklyOff,
      leave: leaveCount,
      absent: absentCount,
      totalWorkingDays,
      daysInMonth,
    };
  }, [workingDaysData, currentMonthRecords, holidayKeySet, orgSettings]);

  return (
    <>
      {/* ── Top Metric Cards Row (4 cards) ── */}
      <div className="metrics-grid">
        {/* 1. Check-In Card (Real Data) */}
        <div className="metric-card">
          <div className="metric-icon-circle green">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#10B981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="metric-info">
            <span className="metric-label">Check-In</span>
            <span
              className="metric-value"
              style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
            >
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#EF4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#3B82F6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8B5CF6"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
        {/* ══ COLUMN 1: Attendance History (Real Data) ══ */}
        <div className="card-box history-box">
          <div className="card-box-header">
            <h2 className="card-box-title">Attendance History</h2>
            <Link to="/employee/records" className="card-box-link">
              View All →
            </Link>
          </div>

          <div className="history-list">
            {attendanceHistoryList.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px 16px",
                  color: "#94A3B8",
                  fontSize: "13px",
                }}
              >
                No attendance records found yet.
              </div>
            ) : (
              attendanceHistoryList.map((item, idx) => (
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
              ))
            )}
          </div>
        </div>

        {/* ══ COLUMN 2: This Month + Upcoming Holiday ══ */}
        <div className="stacked-cards-col">
          {/* Card 1: This Month (Real Data) */}
          <div className="card-box this-month-box">
            <div className="card-box-header">
              <h2 className="card-box-title">This Month</h2>
              <Link to="/employee/records" className="card-box-link">
                View Details →
              </Link>
            </div>

            <div className="this-month-body">
              <DonutChart
                present={thisMonthStats.present}
                weeklyOff={thisMonthStats.weeklyOff}
                leave={thisMonthStats.leave}
                absent={thisMonthStats.absent}
                total={thisMonthStats.totalWorkingDays}
                daysInMonth={thisMonthStats.daysInMonth}
              />

              <div className="donut-legend">
                <div className="legend-item">
                  <span className="leg-dot green" />
                  <span className="leg-name">Present</span>
                  <span className="leg-val">{thisMonthStats.present}</span>
                </div>
                <div className="legend-item">
                  <span className="leg-dot blue" />
                  <span className="leg-name">Weekly Off</span>
                  <span className="leg-val">{thisMonthStats.weeklyOff}</span>
                </div>
                <div className="legend-item">
                  <span className="leg-dot yellow" />
                  <span className="leg-name">Leave</span>
                  <span className="leg-val">{thisMonthStats.leave}</span>
                </div>
                <div className="legend-item">
                  <span className="leg-dot red" />
                  <span className="leg-name">Absent</span>
                  <span className="leg-val">{thisMonthStats.absent}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Upcoming Holiday (Real Data from Admin Settings) */}
          <div className="card-box holiday-box">
            <div className="card-box-header">
              <h2 className="card-box-title">Upcoming Holiday</h2>
            </div>

            <div className="holiday-list">
              {upcomingHolidaysList.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "40px 16px",
                    color: "#94A3B8",
                    fontSize: "13px",
                  }}
                >
                  No upcoming holidays scheduled
                </div>
              ) : (
                upcomingHolidaysList.map((h, i) => (
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
                ))
              )}
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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8B5CF6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
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
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                </div>
                <span className="qa-text">View Reports</span>
              </button>
            </div>
          </div>

          {/* Card 2: Calendar (Real Data, Purple Holidays, Status Outline Boxes) */}
          <div className="card-box calendar-box">
            <MiniCalendar
              holidays={orgSettings?.holidays || []}
              halfDayRules={orgSettings?.halfDayRules || []}
            />
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
