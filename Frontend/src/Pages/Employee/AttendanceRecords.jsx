import { useEffect, useMemo, useState } from "react";
import {
  ListChecks,
  BarChart3,
  Calendar,
  Download,
  Filter,
  Clock,
  CheckCircle2,
  Home,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  AlertCircle,
  Users,
  Building,
  Building2,
  MapPin,
  X,
} from "lucide-react";
import { getMyRecords, getWorkingDays, getEmployeeSettings } from "../../Services/attendanceService";
import { formatDate, formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL } from "../../Utils/constants";
import EmptyState from "../../Components/Common/EmptyState";
import CheckInTime from "../../Components/Common/CheckInTime";
import "../../Styles/AttendanceReport.css";
// Reused so the employee's own attendance table renders with the exact same
// look as the admin Attendance Logs table (attlog-* classes).
import "../../Styles/AttendanceManagement.css";

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

function toDateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Maps a calendarDays cell's `status` to its CSS badge class. "leave" isn't
// produced anywhere yet (no leave feature to source it from), but stays
// wired up here so it lights up the moment that data exists.
const CALENDAR_STATUS_CLASS = {
  present: "present-badge",
  remote: "wfh-badge",
  leave: "leave-badge",
  absent: "absent-badge",
};

// Same holiday-date parsing as the Home dashboard's MiniCalendar (DD/MM/YYYY,
// YYYY-MM-DD, or anything the Date constructor accepts).
function parseHolidayDate(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();
  const dmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10);
    const year = parseInt(dmy[3], 10);
    return { day, month, year, dateKey: toDateKey(year, month, day) };
  }
  const ymd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    return { day, month, year, dateKey: toDateKey(year, month, day) };
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return { day: d.getDate(), month: d.getMonth() + 1, year: d.getFullYear(), dateKey: toDateKey(d.getFullYear(), d.getMonth() + 1, d.getDate()) };
  }
  return null;
}

function literalOccurrenceInMonth(day) {
  return Math.ceil(day / 7);
}

// Whether `day` is an admin-configured off Saturday (Settings page), same
// rule the backend's computeWorkingDaysInfo uses.
function isConfiguredHalfDay(year, month, day, dayOfWeek, halfDayRules) {
  if (!halfDayRules || halfDayRules.length === 0) return false;
  const occurrence = literalOccurrenceInMonth(day);
  return halfDayRules.some((rule) => rule.dayOfWeek === dayOfWeek && rule.occurrence === occurrence);
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
  // Mobile-only: the status/date filters start collapsed behind a single
  // "Filter" toggle button (see att-mobile-filter-toggle) -- desktop always
  // shows them inline regardless of this, purely via CSS.
  const [showMobileFilters, setShowMobileFilters] = useState(false);
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

  /* ── Reports tab: its own month (always a specific month -- a calendar
     can't render "All Months"), independent of the Records tab's filter ── */
  const now = new Date();
  const [reportsMonth, setReportsMonth] = useState(now.getMonth() + 1);
  const [reportsYear, setReportsYear] = useState(now.getFullYear());
  const [reportsRecords, setReportsRecords] = useState(null);
  const [reportsWorkingDays, setReportsWorkingDays] = useState(null);
  // Holidays + half-day-Saturday rules, same source as the Home dashboard's
  // calendar -- fetched once, not per month.
  const [orgSettings, setOrgSettings] = useState(null);

  useEffect(() => {
    getEmployeeSettings()
      .then(setOrgSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab !== "reports") return;
    let cancelled = false;
    setReportsRecords(null);
    setReportsWorkingDays(null);
    const monthValue = `${reportsYear}-${String(reportsMonth).padStart(2, "0")}`;
    const lastDay = new Date(reportsYear, reportsMonth, 0).getDate();
    (async () => {
      const [recordsRes, workingDaysRes] = await Promise.allSettled([
        getMyRecords({
          fromDate: `${monthValue}-01`,
          toDate: `${monthValue}-${String(lastDay).padStart(2, "0")}`,
          limit: FETCH_LIMIT,
        }),
        getWorkingDays(reportsYear, reportsMonth),
      ]);
      if (cancelled) return;
      setReportsRecords(recordsRes.status === "fulfilled" ? recordsRes.value.records : []);
      setReportsWorkingDays(workingDaysRes.status === "fulfilled" ? workingDaysRes.value : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, reportsYear, reportsMonth]);

  const goToPrevReportsMonth = () => {
    if (reportsMonth === 1) {
      setReportsMonth(12);
      setReportsYear((y) => y - 1);
    } else {
      setReportsMonth((m) => m - 1);
    }
  };

  const goToNextReportsMonth = () => {
    if (reportsMonth === 12) {
      setReportsMonth(1);
      setReportsYear((y) => y + 1);
    } else {
      setReportsMonth((m) => m + 1);
    }
  };

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

  const isNonWorkingDay = (year, month, day, dayOfWeek) => {
    if (dayOfWeek === 0) return true; // Sunday
    if (holidayKeySet.has(toDateKey(year, month, day))) return true;
    if (dayOfWeek === 6) return isConfiguredHalfDay(year, month, day, 6, orgSettings?.halfDayRules || []);
    return false;
  };

  // Real Present / Office / Remote / On Time / Late / Absent for whichever
  // month the Reports calendar is currently showing. Leave has no backing
  // data source yet, so it's always 0 (see the module doc comment above).
  const reportsStats = useMemo(() => {
    const records = reportsRecords || [];
    const office = records.filter((r) => r.loginType === "OFFICE").length;
    const remote = records.filter((r) => r.loginType === "DISTANCE").length;
    const onTime = records.filter((r) => r.latenessStatus === "ON_TIME").length;
    const late = records.length - onTime;

    const today = new Date();
    const isCurrentMonth = reportsYear === today.getFullYear() && reportsMonth === today.getMonth() + 1;
    const isFutureMonth =
      reportsYear > today.getFullYear() || (reportsYear === today.getFullYear() && reportsMonth > today.getMonth() + 1);
    const daysInMonth = new Date(reportsYear, reportsMonth, 0).getDate();
    const lastElapsedDay = isCurrentMonth ? today.getDate() - 1 : isFutureMonth ? 0 : daysInMonth;

    let absent = 0;
    for (let d = 1; d <= lastElapsedDay; d++) {
      const dayOfWeek = new Date(reportsYear, reportsMonth - 1, d).getDay();
      if (isNonWorkingDay(reportsYear, reportsMonth, d, dayOfWeek)) continue;
      const dateKey = toDateKey(reportsYear, reportsMonth, d);
      const attended = records.some((r) => r.workingDateKey === dateKey);
      if (!attended) absent++;
    }

    return {
      present: office + remote,
      office,
      remote,
      onTime,
      late,
      absent,
      leave: 0,
      totalWorkingDays: reportsWorkingDays?.totalWorkingDays ?? null,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsRecords, reportsWorkingDays, reportsYear, reportsMonth, holidayKeySet, orgSettings]);

  const overviewBars = useMemo(
    () => [
      { label: "Present", value: reportsStats.office, colorClass: "present" },
      { label: "Remote", value: reportsStats.remote, colorClass: "wfh" },
      { label: "Leave", value: reportsStats.leave, colorClass: "leave" },
      { label: "Absent", value: reportsStats.absent, colorClass: "absent" },
    ],
    [reportsStats]
  );

  // Y-axis top value: rounded up to a multiple of 4x5 so the 4 gridlines
  // (100/75/50/25%) land on clean multiples of 5, same as the original
  // fixed 20/15/10/5/0 scale -- just no longer clipping a busy month.
  const overviewMax = useMemo(() => {
    const highest = Math.max(0, ...overviewBars.map((b) => b.value));
    const step = Math.max(5, Math.ceil(highest / 4 / 5) * 5);
    return step * 4;
  }, [overviewBars]);

  const workLocationSegments = useMemo(() => {
    const total = reportsStats.office + reportsStats.remote;
    const pct = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);
    return {
      totalDays: total,
      segments: [
        { label: "In Office", count: reportsStats.office, pct: pct(reportsStats.office), class: "green" },
        { label: "Remote", count: reportsStats.remote, pct: pct(reportsStats.remote), class: "blue" },
      ],
    };
  }, [reportsStats]);

  // Full 7-wide grid for the selected month, including dimmed padding cells
  // from the adjacent months so every week row stays 7 columns.
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(reportsYear, reportsMonth, 0).getDate();
    const firstDayOfWeek = new Date(reportsYear, reportsMonth - 1, 1).getDay();
    const prevMonthDays = new Date(reportsYear, reportsMonth - 1, 0).getDate();
    const today = new Date();
    const todayKey = toDateKey(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const records = reportsRecords || [];

    const cells = [];
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      cells.push({ key: `prev-${i}`, label: prevMonthDays - i, dimmed: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toDateKey(reportsYear, reportsMonth, d);
      const dayOfWeek = new Date(reportsYear, reportsMonth - 1, d).getDay();
      const nonWorking = isNonWorkingDay(reportsYear, reportsMonth, d, dayOfWeek);
      const isFuture = dateKey > todayKey;
      const record = records.find((r) => r.workingDateKey === dateKey);

      let status = null;
      if (record) {
        status = record.loginType === "DISTANCE" ? "remote" : "present";
      } else if (!nonWorking && !isFuture) {
        status = "absent";
      }

      cells.push({
        key: dateKey,
        label: d,
        dimmed: !status,
        status,
        isToday: dateKey === todayKey,
      });
    }
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 1; i <= 7 - remainder; i++) {
        cells.push({ key: `next-${i}`, label: "-", dimmed: true });
      }
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsYear, reportsMonth, reportsRecords, holidayKeySet, orgSettings]);

  // Per-day worked minutes for the whole month, real data from
  // totalWorkingMinutes (only set once a day is checked out -- a day still
  // in progress reads as 0 here, same as an absent day, until it's closed
  // out). Feeds both the mini stat cards below and the daily bar chart.
  const dailyWorkingHours = useMemo(() => {
    const daysInMonth = new Date(reportsYear, reportsMonth, 0).getDate();
    const records = reportsRecords || [];
    const minutesByDate = new Map();
    for (const r of records) {
      if (r.checkOutTime && r.totalWorkingMinutes != null) {
        minutesByDate.set(r.workingDateKey, r.totalWorkingMinutes);
      }
    }
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = toDateKey(reportsYear, reportsMonth, d);
      const dayOfWeek = new Date(reportsYear, reportsMonth - 1, d).getDay();
      days.push({
        day: d,
        hours: (minutesByDate.get(dateKey) || 0) / 60,
        isWeekend: isNonWorkingDay(reportsYear, reportsMonth, d, dayOfWeek),
      });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportsYear, reportsMonth, reportsRecords, holidayKeySet, orgSettings]);

  const TARGET_DAILY_HOURS = 8; // matches the chart's existing "Target Hours (8h)" line

  const workingHoursStats = useMemo(() => {
    let totalWorkedMinutes = 0;
    let extraMinutes = 0;
    let shortfallMinutes = 0;
    let presentCount = 0;
    for (const d of dailyWorkingHours) {
      if (d.hours <= 0) continue;
      presentCount++;
      const minutes = d.hours * 60;
      totalWorkedMinutes += minutes;
      const diff = minutes - TARGET_DAILY_HOURS * 60;
      if (diff > 0) extraMinutes += diff;
      else shortfallMinutes += -diff;
    }

    const totalWorkingDays = reportsWorkingDays?.totalWorkingDays ?? null;
    const targetTotalMinutes = totalWorkingDays != null ? totalWorkingDays * TARGET_DAILY_HOURS * 60 : null;
    const percentage = targetTotalMinutes ? Math.round((totalWorkedMinutes / targetTotalMinutes) * 100) : 0;
    const avgDailyMinutes = presentCount > 0 ? totalWorkedMinutes / presentCount : 0;
    const pctOfTarget = (minutes) => (targetTotalMinutes ? Math.round((minutes / targetTotalMinutes) * 100) : 0);

    return {
      totalWorkedMinutes,
      targetTotalMinutes,
      percentage,
      avgDailyMinutes,
      extraMinutes,
      shortfallMinutes,
      extraPct: pctOfTarget(extraMinutes),
      shortfallPct: pctOfTarget(shortfallMinutes),
    };
  }, [dailyWorkingHours, reportsWorkingDays]);

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
  const officeDash = (workLocationSegments.segments[0].pct / 100) * circumference;
  const remoteDash = (workLocationSegments.segments[1].pct / 100) * circumference;

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
              <div className="att-month-select-btn" style={{ cursor: "default" }} title="Change the month from the calendar card below">
                <Calendar size={16} color="#0074F1" />
                <span>{MONTH_NAMES[reportsMonth - 1].slice(0, 3)} {reportsYear}</span>
              </div>

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
              {/* Mobile-only: toggles the filter group below. Hidden on
                  desktop via CSS, where the filters already show inline. */}
              <button
                type="button"
                className={`att-btn att-mobile-filter-toggle ${hasAnyFilter ? "att-btn-active" : ""}`}
                onClick={() => setShowMobileFilters((prev) => !prev)}
                aria-expanded={showMobileFilters}
              >
                <Filter size={15} />
                <span>Filter{hasAnyFilter ? "s Active" : ""}</span>
                <ChevronDown
                  size={14}
                  style={{ transform: showMobileFilters ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
                />
              </button>

              <div className={`att-filters-collapsible ${showMobileFilters ? "open" : ""}`}>
                {/* Quick status filters -- sit to the left of the date filter,
                    same line (desktop) / same collapsible group (mobile). */}
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
              </div>

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
          {/* ── Top 5 Metric Cards (real data; Leave stays 0 -- no leave
               feature to source it from yet) ── */}
          <div className="att-metrics-grid">
            {[
              {
                label: "Present",
                value: reportsStats.present,
                sub:
                  reportsStats.totalWorkingDays != null
                    ? `${Math.round((reportsStats.present / reportsStats.totalWorkingDays) * 100)}% of work days`
                    : undefined,
                color: "green",
                icon: Users,
              },
              {
                label: "On Time",
                value: reportsStats.onTime,
                sub: reportsStats.present > 0 ? `${Math.round((reportsStats.onTime / reportsStats.present) * 100)}% of present days` : undefined,
                color: "blue",
                icon: CheckCircle2,
              },
              {
                label: "Late",
                value: reportsStats.late,
                sub: reportsStats.present > 0 ? `${Math.round((reportsStats.late / reportsStats.present) * 100)}% of present days` : undefined,
                color: "amber",
                icon: Clock,
              },
              {
                label: "Absent",
                value: reportsStats.absent,
                sub:
                  reportsStats.totalWorkingDays != null
                    ? `${Math.round((reportsStats.absent / reportsStats.totalWorkingDays) * 100)}% of work days`
                    : undefined,
                color: "red",
                icon: AlertCircle,
              },
              {
                label: "Leave",
                value: reportsStats.leave,
                sub: "Leave tracking coming soon",
                color: "purple",
                icon: Calendar,
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.label} className={`att-metric-card ${card.color}`}>
                  <div className="att-metric-icon-circle">
                    <Icon size={20} />
                  </div>
                  <div className="att-metric-content">
                    <span className="att-metric-value">{reportsRecords === null ? "—" : card.value}</span>
                    <span className="att-metric-label">{card.label}</span>
                    <span className="att-metric-sub">{card.sub ?? ""}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Middle Row (3 Columns) ── */}
          <div className="att-middle-row">
            {/* Column 1: Attendance Overview Bar Chart */}
            <div className="att-card">
              <div className="att-card-header">
                <h3 className="att-card-title">Attendance Overview</h3>
                <div className="att-card-dropdown">
                  <span>{MONTH_NAMES[reportsMonth - 1]} {reportsYear}</span>
                </div>
              </div>

              <div className="att-bar-chart-container">
                <div className="att-chart-plot-area">
                  {/* Y Axis Values */}
                  <div className="att-chart-y-axis">
                    <span>{overviewMax}</span>
                    <span>{Math.round(overviewMax * 0.75)}</span>
                    <span>{Math.round(overviewMax * 0.5)}</span>
                    <span>{Math.round(overviewMax * 0.25)}</span>
                    <span>0</span>
                  </div>

                  {/* Horizontal Guideline */}
                  <div className="att-chart-grid-line" style={{ top: "0%" }} />
                  <div className="att-chart-grid-line" style={{ top: "25%" }} />
                  <div className="att-chart-grid-line" style={{ top: "50%" }} />
                  <div className="att-chart-grid-line" style={{ top: "75%" }} />

                  {/* Bars */}
                  {overviewBars.map((item, idx) => {
                    const heightPct = item.value > 0 ? Math.max(3, (item.value / overviewMax) * 100) : 0;
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
                  {overviewBars.map((item, idx) => (
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

                    {/* Segment 1: In Office */}
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

                    {/* Segment 2: Remote */}
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
                  </svg>

                  <div className="att-donut-center">
                    <span className="att-donut-days-num">{workLocationSegments.totalDays}</span>
                    <span className="att-donut-days-label">Days</span>
                  </div>
                </div>

                {/* Legend List */}
                <div className="att-donut-legend">
                  {workLocationSegments.segments.map((seg, idx) => (
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
                  <button type="button" className="att-cal-nav-btn" onClick={goToPrevReportsMonth} title="Previous month">
                    <ChevronLeft size={16} />
                  </button>
                  <span>{MONTH_NAMES[reportsMonth - 1]} {reportsYear}</span>
                  <button type="button" className="att-cal-nav-btn" onClick={goToNextReportsMonth} title="Next month">
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

                {calendarDays.map((cell) => {
                  const statusClass = CALENDAR_STATUS_CLASS[cell.status] || "";
                  return (
                    <div
                      key={cell.key}
                      className={`att-cal-cell ${cell.dimmed ? "dimmed" : ""} ${statusClass} ${cell.isToday ? "today-ring" : ""}`}
                    >
                      {cell.label}
                    </div>
                  );
                })}
              </div>

              {/* Calendar Legend */}
              <div className="att-cal-legend-row">
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot present" />
                  <span>Present</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot wfh" />
                  <span>Remote</span>
                </div>
                <div className="att-cal-legend-item">
                  <span className="att-cal-legend-dot leave" />
                  <span>Leave</span>
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
                  <span>{MONTH_NAMES[reportsMonth - 1]} {reportsYear}</span>
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
                  <span className="att-wh-mini-val">{formatMinutesAsHours(workingHoursStats.totalWorkedMinutes)}</span>
                  <span className="att-wh-mini-sub">
                    {workingHoursStats.targetTotalMinutes != null ? `of ${formatMinutesAsHours(workingHoursStats.targetTotalMinutes)}` : ""}
                  </span>
                  <div className="att-wh-progress-wrap">
                    <div className="att-wh-progress-bar">
                      <div
                        className="att-wh-progress-fill"
                        style={{ width: `${Math.min(100, workingHoursStats.percentage)}%` }}
                      />
                    </div>
                    <span className="att-wh-progress-pct">{workingHoursStats.percentage}%</span>
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
                  <span className="att-wh-mini-val">{formatMinutesAsHours(workingHoursStats.avgDailyMinutes)}</span>
                  <span className="att-wh-mini-sub">Target: {TARGET_DAILY_HOURS}h 00m</span>
                </div>

                {/* 3. Extra Hours */}
                <div className="att-wh-mini-card purple">
                  <div className="att-wh-mini-top">
                    <div className="att-wh-mini-icon">
                      <Zap size={16} />
                    </div>
                    <span className="att-wh-mini-label">Extra Hours</span>
                  </div>
                  <span className="att-wh-mini-val">{formatMinutesAsHours(workingHoursStats.extraMinutes)}</span>
                  <span className="att-wh-delta-badge green">+{workingHoursStats.extraPct}% more</span>
                </div>

                {/* 4. Shortfall Hours */}
                <div className="att-wh-mini-card amber">
                  <div className="att-wh-mini-top">
                    <div className="att-wh-mini-icon">
                      <AlertCircle size={16} />
                    </div>
                    <span className="att-wh-mini-label">Shortfall Hours</span>
                  </div>
                  <span className="att-wh-mini-val">{formatMinutesAsHours(workingHoursStats.shortfallMinutes)}</span>
                  <span className="att-wh-delta-badge red">-{workingHoursStats.shortfallPct}% less</span>
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

                  {/* One bar per day of the selected month */}
                  <div className="att-daily-bars-row">
                    {dailyWorkingHours.map((item) => {
                      const maxHours = 12;
                      const heightPct = Math.min(100, (item.hours / maxHours) * 100);
                      const isMuted = item.isWeekend || item.hours === 0;
                      return (
                        <div key={item.day} className="att-daily-bar-item" title={`Day ${item.day}: ${item.hours.toFixed(1)}h`}>
                          <div
                            className={`att-daily-pillar ${isMuted ? "muted" : ""}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* X Axis Numbers (1 to last day of the month) */}
                <div className="att-daily-x-axis">
                  {dailyWorkingHours.map((item) => (
                    <span key={item.day} className="att-daily-x-num">
                      {item.day}
                    </span>
                  ))}
                </div>
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
