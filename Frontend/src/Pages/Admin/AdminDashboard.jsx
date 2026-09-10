import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Check,
  X,
  Clock,
  Calendar,
  ChevronRight,
  UserPlus,
  CalendarCheck,
  FileCheck2,
  Laptop,
  KeyRound,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { useToast } from "../../Context/ToastContext";
import "../../Styles/AdminDashboard.css";

// ══════════════════════════ SAMPLE DATA ══════════════════════════

const WEEKLY_DATA_OPTIONS = {
  "This Week": [
    { day: "Mon 1 Sep", present: 70, absent: 10, leave: 5, wfh: 8 },
    { day: "Tue 2 Sep", present: 86, absent: 10, leave: 6, wfh: 6 },
    { day: "Wed 3 Sep", present: 78, absent: 9, leave: 5, wfh: 8 },
    { day: "Thu 4 Sep", present: 68, absent: 11, leave: 7, wfh: 8 },
    { day: "Fri 5 Sep", present: 80, absent: 9, leave: 6, wfh: 7 },
    { day: "Sat 6 Sep", present: 54, absent: 14, leave: 10, wfh: 9 },
    { day: "Sun 7 Sep", present: 58, absent: 10, leave: 7, wfh: 7 },
  ],
  "Last Week": [
    { day: "Mon 25 Aug", present: 72, absent: 8, leave: 6, wfh: 9 },
    { day: "Tue 26 Aug", present: 84, absent: 9, leave: 5, wfh: 7 },
    { day: "Wed 27 Aug", present: 80, absent: 7, leave: 4, wfh: 8 },
    { day: "Thu 28 Aug", present: 70, absent: 10, leave: 6, wfh: 9 },
    { day: "Fri 29 Aug", present: 82, absent: 8, leave: 5, wfh: 8 },
    { day: "Sat 30 Aug", present: 50, absent: 16, leave: 11, wfh: 10 },
    { day: "Sun 31 Aug", present: 52, absent: 12, leave: 8, wfh: 8 },
  ],
};

const MONTHLY_DONUT_DATA = [
  { name: "Present", value: 79, count: 98, color: "#00B368" },
  { name: "Absent", value: 10, count: 12, color: "#FF3838" },
  { name: "On Leave", value: 6, count: 8, color: "#FF8C00" },
  { name: "Work From Home", value: 5, count: 6, color: "#0074F1" },
];

const renderCustomXAxisTick = ({ x, y, payload }) => {
  if (!payload || !payload.value) return null;
  const parts = payload.value.split(" ");
  const dayName = parts[0];
  const dateStr = parts.slice(1).join(" ");

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={12} textAnchor="middle" fill="#64748B" fontSize={11} fontWeight={600}>
        {dayName}
      </text>
      <text x={0} y={26} textAnchor="middle" fill="#8C9BB0" fontSize={10} fontWeight={500}>
        {dateStr}
      </text>
    </g>
  );
};

const CHECKIN_DETAILS_SAMPLE = [
  {
    id: 1,
    name: "Rohit Sharma",
    dept: "Product & Tech",
    checkIn: "09:01 AM",
    checkOut: "06:10 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
  {
    id: 2,
    name: "Priya Singh",
    dept: "Design",
    checkIn: "09:05 AM",
    checkOut: "-",
    mode: "Remote",
    location: "Kolkata, WB",
  },
  {
    id: 3,
    name: "Amit Verma",
    dept: "Sales",
    checkIn: "09:08 AM",
    checkOut: "06:02 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
  {
    id: 4,
    name: "Sneha Iyer",
    dept: "HR",
    checkIn: "09:12 AM",
    checkOut: "-",
    mode: "Remote",
    location: "Kolkata, WB",
  },
  {
    id: 5,
    name: "Karan Das",
    dept: "Finance",
    checkIn: "09:15 AM",
    checkOut: "05:55 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
  {
    id: 6,
    name: "Ananya Dey",
    dept: "Marketing",
    checkIn: "09:18 AM",
    checkOut: "06:05 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
  {
    id: 7,
    name: "Rahul Sen",
    dept: "Product & Tech",
    checkIn: "09:20 AM",
    checkOut: "-",
    mode: "Remote",
    location: "Kolkata, WB",
  },
  {
    id: 8,
    name: "Pooja Patel",
    dept: "Design",
    checkIn: "09:22 AM",
    checkOut: "06:12 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
  {
    id: 9,
    name: "Vikram Roy",
    dept: "Operations",
    checkIn: "09:25 AM",
    checkOut: "-",
    mode: "Remote",
    location: "Bangalore, KA",
  },
  {
    id: 10,
    name: "Meera Nair",
    dept: "HR",
    checkIn: "09:28 AM",
    checkOut: "06:00 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
  {
    id: 11,
    name: "Rajesh Kumar",
    dept: "Finance",
    checkIn: "09:30 AM",
    checkOut: "05:50 PM",
    mode: "Office",
    location: "Kolkata Office",
  },
];

const INITIAL_APPROVALS = [
  {
    id: 1,
    type: "leave",
    name: "Priya Sharma",
    actionText: "applied for leave (1 day)",
    time: "2 minutes ago",
    icon: Calendar,
    iconColor: "amber",
    btnType: "review",
    status: "pending",
  },
  {
    id: 2,
    type: "device",
    name: "Amit Verma",
    actionText: "requested device re-registration",
    time: "18 minutes ago",
    icon: Laptop,
    iconColor: "purple",
    btnType: "approve",
    status: "pending",
  },
  {
    id: 3,
    type: "password",
    name: "Rohan Mehta",
    actionText: "requested password change",
    time: "1 hour ago",
    icon: KeyRound,
    iconColor: "green",
    btnType: "approve",
    status: "pending",
  },
  {
    id: 4,
    type: "leave",
    name: "Sneha Iyer",
    actionText: "applied for half day",
    time: "2 hours ago",
    icon: Calendar,
    iconColor: "amber",
    btnType: "review",
    status: "pending",
  },
  {
    id: 5,
    type: "device",
    name: "Karan Das",
    actionText: "requested device re-registration",
    time: "3 hours ago",
    icon: Laptop,
    iconColor: "purple",
    btnType: "approve",
    status: "pending",
  },
  {
    id: 6,
    type: "leave",
    name: "Vikram Roy",
    actionText: "applied for leave (2 days)",
    time: "4 hours ago",
    icon: Calendar,
    iconColor: "amber",
    btnType: "review",
    status: "pending",
  },
  {
    id: 7,
    type: "password",
    name: "Ananya Dey",
    actionText: "requested password change",
    time: "5 hours ago",
    icon: KeyRound,
    iconColor: "green",
    btnType: "approve",
    status: "pending",
  },
  {
    id: 8,
    type: "device",
    name: "Rahul Sen",
    actionText: "requested device re-registration",
    time: "6 hours ago",
    icon: Laptop,
    iconColor: "purple",
    btnType: "approve",
    status: "pending",
  },
  {
    id: 9,
    type: "leave",
    name: "Pooja Patel",
    actionText: "applied for sick leave (1 day)",
    time: "7 hours ago",
    icon: Calendar,
    iconColor: "amber",
    btnType: "review",
    status: "pending",
  },
];

export default function AdminDashboard() {
  const toast = useToast();
  const navigate = useNavigate();

  // State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weeklyFilter, setWeeklyFilter] = useState("This Week");
  const [monthlyFilter, setMonthlyFilter] = useState("September 2025");
  const [approvals, setApprovals] = useState(INITIAL_APPROVALS);

  // Live timer for top-right clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format live current date and time with seconds matching the screenshot
  const formatCurrentDateTime = (date) => {
    const dayOfWeek = date.toLocaleDateString("en-GB", { weekday: "short" });
    const day = date.toLocaleDateString("en-GB", { day: "2-digit" });
    const month = date.toLocaleDateString("en-GB", { month: "short" }).replace(/\bSep\b/, "Sept");
    const year = date.getFullYear();
    const time = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
    return `${dayOfWeek} | ${day} ${month} ${year}, ${time}`;
  };

  const formattedDateTime = formatCurrentDateTime(currentTime);

  // Approval actions
  const handleApprove = (id, name) => {
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "approved" } : item
      )
    );
    toast.success(`Request for ${name} approved successfully`);
  };

  const handleReject = (id, name) => {
    setApprovals((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, status: "rejected" } : item
      )
    );
    toast.info(`Request for ${name} rejected`);
  };

  const handleReview = (id, name) => {
    toast.info(`Opening review sheet for ${name}`);
    navigate("/admin/leave-management");
  };

  return (
    <div className="admin-dash-page">
      {/* ══════════════════════════ DASHBOARD HEADER ══════════════════════════ */}
      <div className="admin-dash-header">
        <div className="admin-dash-titles">
          <h1>Dashboard</h1>
          <p>Welcome back, Admin! Here's an overview of your organization's attendance today.</p>
        </div>

        <div className="admin-dash-datetime-badge">
          <Calendar size={20} strokeWidth={2.2} />
          <span>{formattedDateTime}</span>
        </div>
      </div>

      {/* ══════════════════════════ 4 METRIC CARDS ══════════════════════════ */}
      <div className="admin-metrics-grid">
        {/* Card 1: Total Employees */}
        <div className="admin-metric-card card-total">
          <div className="admin-card-main-content">
            <div className="admin-card-icon-halo blue">
              <Users size={22} className="admin-card-icon-svg blue" fill="#0074F1" color="#0074F1" />
            </div>
            <div className="admin-card-info">
              <div className="admin-card-num">124</div>
              <div className="admin-card-title">Total Employees</div>
              <div className="admin-card-trend up">↑ 5%</div>
              <div className="admin-card-trend-sub">vs last month</div>
            </div>
          </div>
          <div className="admin-card-watermark-wrap">
            <Users size={34} className="admin-card-watermark-icon" fill="#79B8F8" color="#79B8F8" />
          </div>
        </div>

        {/* Card 2: Present Today */}
        <div className="admin-metric-card card-present">
          <div className="admin-card-main-content">
            <div className="admin-card-icon-halo green">
              <div className="admin-card-icon-inner green">
                <Check size={16} strokeWidth={3.5} color="#FFFFFF" />
              </div>
            </div>
            <div className="admin-card-info">
              <div className="admin-card-num">98</div>
              <div className="admin-card-title">Present Today</div>
              <div className="admin-card-trend up">↑ 12%</div>
              <div className="admin-card-trend-sub">vs yesterday</div>
            </div>
          </div>
          <div className="admin-card-pct-ring green">
            <span>79%</span>
          </div>
        </div>

        {/* Card 3: Absent Today */}
        <div className="admin-metric-card card-absent">
          <div className="admin-card-main-content">
            <div className="admin-card-icon-halo red">
              <div className="admin-card-icon-inner red">
                <X size={16} strokeWidth={3.5} color="#FFFFFF" />
              </div>
            </div>
            <div className="admin-card-info">
              <div className="admin-card-num">12</div>
              <div className="admin-card-title">Absent Today</div>
              <div className="admin-card-trend down">↓ 3%</div>
              <div className="admin-card-trend-sub">vs yesterday</div>
            </div>
          </div>
          <div className="admin-card-pct-ring red">
            <span>10%</span>
          </div>
        </div>

        {/* Card 4: On Leave */}
        <div className="admin-metric-card card-leave">
          <div className="admin-card-main-content">
            <div className="admin-card-icon-halo amber">
              <div className="admin-card-icon-inner amber">
                <Clock size={16} strokeWidth={3} color="#FFFFFF" />
              </div>
            </div>
            <div className="admin-card-info">
              <div className="admin-card-num">8</div>
              <div className="admin-card-title">On Leave</div>
              <div className="admin-card-trend neutral">→ 0%</div>
              <div className="admin-card-trend-sub">vs yesterday</div>
            </div>
          </div>
          <div className="admin-card-pct-ring amber">
            <span>6%</span>
          </div>
        </div>
      </div>

      {/* ══════════════════════════ MIDDLE ROW (CHARTS & ACTIONS) ══════════════════════════ */}
      <div className="admin-middle-grid">
        {/* Card 1: Weekly Attendance Overview */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Weekly Attendance Overview</h3>
            <select
              className="admin-card-select"
              value={weeklyFilter}
              aria-label="Filter weekly attendance overview"
              onChange={(e) => setWeeklyFilter(e.target.value)}
            >
              <option value="This Week">This Week</option>
              <option value="Last Week">Last Week</option>
            </select>
          </div>

          <div className="admin-chart-legend">
            <div className="admin-legend-item">
              <span className="admin-legend-pill green" />
              <span>Present</span>
            </div>
            <div className="admin-legend-item">
              <span className="admin-legend-pill red" />
              <span>Absent</span>
            </div>
            <div className="admin-legend-item">
              <span className="admin-legend-pill amber" />
              <span>Leave</span>
            </div>
            <div className="admin-legend-item">
              <span className="admin-legend-pill blue" />
              <span>Work From Home</span>
            </div>
          </div>

          <div style={{ width: "100%", height: 215 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={WEEKLY_DATA_OPTIONS[weeklyFilter]}
                margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                barCategoryGap="20%"
                barGap={1.5}
              >
                <CartesianGrid strokeDasharray="0 0" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="day"
                  axisLine={{ stroke: "#EEF2F6" }}
                  tickLine={false}
                  interval={0}
                  tick={renderCustomXAxisTick}
                  height={38}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  tick={{ fill: "#8C9BB0", fontSize: 11, fontWeight: 500 }}
                />
                <Tooltip
                  cursor={{ fill: "rgba(0, 116, 241, 0.04)" }}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid #E2E8F0",
                    boxShadow: "0 4px 12px rgba(15, 23, 42, 0.08)",
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="present" fill="#00B368" radius={[3, 3, 0, 0]} maxBarSize={8} />
                <Bar dataKey="absent" fill="#FF3838" radius={[3, 3, 0, 0]} maxBarSize={8} />
                <Bar dataKey="leave" fill="#FF8C00" radius={[3, 3, 0, 0]} maxBarSize={8} />
                <Bar dataKey="wfh" fill="#0074F1" radius={[3, 3, 0, 0]} maxBarSize={8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Monthly Attendance Distribution */}
        <div className="admin-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Monthly Attendance Distribution</h3>
            <select
              className="admin-card-select"
              value={monthlyFilter}
              aria-label="Filter monthly attendance distribution"
              onChange={(e) => setMonthlyFilter(e.target.value)}
            >
              <option value="September 2025">September 2025</option>
              <option value="August 2025">August 2025</option>
            </select>
          </div>

          <div className="admin-donut-container">
            <div className="admin-donut-chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={MONTHLY_DONUT_DATA}
                    cx="50%"
                    cy="50%"
                    startAngle={90}
                    endAngle={-270}
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={0}
                    stroke="#FFFFFF"
                    strokeWidth={3}
                    dataKey="value"
                  >
                    {MONTHLY_DONUT_DATA.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val, name, item) => [`${val}% (${item.payload.count})`, name]}
                    contentStyle={{
                      borderRadius: 8,
                      border: "1px solid #E2E8F0",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="admin-donut-center-label">
                <div className="admin-donut-center-val">124</div>
                <div className="admin-donut-center-sub">Total Employees</div>
              </div>
            </div>

            <div className="admin-donut-legend-list">
              {MONTHLY_DONUT_DATA.map((item) => (
                <div key={item.name} className="admin-donut-legend-row">
                  <span className="admin-donut-legend-label">
                    <span
                      className="admin-donut-dot"
                      style={{ backgroundColor: item.color }}
                    />
                    {item.name}
                  </span>
                  <div className="admin-donut-legend-stat">
                    <strong>{item.value}%</strong> <span>({item.count})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Quick Actions */}
        <div className="admin-card admin-quick-actions-card">
          <h3 className="admin-quick-actions-heading">Quick Actions</h3>

          <div className="admin-quick-actions-list">
            {/* Add Employee */}
            <button
              type="button"
              className="admin-quick-action-btn action-add-emp"
              onClick={() => navigate("/admin/employees")}
            >
              <div className="admin-quick-action-left">
                <div className="admin-quick-icon-wrap blue">
                  <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
                    <circle cx="15.5" cy="11.5" r="6.5" fill="#0074F1" />
                    <path
                      d="M4 31C4 24.9249 8.92487 20 15 20C17.7479 20 20.2612 21.0105 22.186 22.6841C20.2198 24.3644 19 26.8837 19 29.7042C19 30.1469 19.0305 30.5818 19.0898 31.0069C18.9943 31.0023 18.8974 31 18.8 31H4Z"
                      fill="#0074F1"
                    />
                    <circle cx="27" cy="27" r="7" fill="#0074F1" />
                    <path
                      d="M27 23.5V30.5M23.5 27H30.5"
                      stroke="#FFFFFF"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
                <div className="admin-quick-texts">
                  <strong>Add Employee</strong>
                  <span>Create a new employee account</span>
                </div>
              </div>
              <ChevronRight size={19} strokeWidth={2.4} className="admin-quick-chevron" />
            </button>

            {/* Manage Holidays */}
            <button
              type="button"
              className="admin-quick-action-btn action-manage-holidays"
              onClick={() => toast.info("Opening holiday calendar...")}
            >
              <div className="admin-quick-action-left">
                <div className="admin-quick-icon-wrap green">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <rect x="7.5" y="1" width="3" height="6" rx="1.5" fill="#00B368" />
                    <rect x="17.5" y="1" width="3" height="6" rx="1.5" fill="#00B368" />
                    <rect x="3" y="4" width="22" height="22" rx="5" fill="#00B368" />
                    <path
                      d="M9 15.5L13 19.5L20 12.5"
                      stroke="#FFFFFF"
                      strokeWidth="2.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="admin-quick-texts">
                  <strong>Manage Holidays</strong>
                  <span>Add or edit company holidays</span>
                </div>
              </div>
              <ChevronRight size={19} strokeWidth={2.4} className="admin-quick-chevron" />
            </button>

            {/* Leave Approval */}
            <button
              type="button"
              className="admin-quick-action-btn action-leave-approval"
              onClick={() => navigate("/admin/leave-management")}
            >
              <div className="admin-quick-action-left">
                <div className="admin-quick-icon-wrap purple">
                  <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                    <path
                      d="M5 3.5C5 2.11929 6.11929 1 7.5 1H15.5L21 6.5V20.5C21 21.8807 19.8807 23 18.5 23H7.5C6.11929 23 5 21.8807 5 20.5V3.5Z"
                      fill="#8B5CF6"
                    />
                    <path d="M15 1V6C15 6.55228 15.4477 7 16 7H21" fill="#7C3AED" />
                    <line
                      x1="8.5"
                      y1="10"
                      x2="16.5"
                      y2="10"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="8.5"
                      y1="14"
                      x2="16.5"
                      y2="14"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <line
                      x1="8.5"
                      y1="18"
                      x2="13.5"
                      y2="18"
                      stroke="#FFFFFF"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle cx="21" cy="21" r="5.5" fill="#8B5CF6" stroke="#FFFFFF" strokeWidth="1.5" />
                    <path
                      d="M19 21L20.5 22.5L23 19.5"
                      stroke="#FFFFFF"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <div className="admin-quick-texts">
                  <strong>Leave Approval</strong>
                  <span>Review and approve leave requests</span>
                </div>
              </div>
              <ChevronRight size={19} strokeWidth={2.4} className="admin-quick-chevron" />
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════ BOTTOM ROW (DETAILS & APPROVALS) ══════════════════════════ */}
      <div className="admin-bottom-grid">
        {/* Table Card: Today's Check-in / Check-out Details */}
        <div className="admin-card admin-scrollable-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Today's Check-in / Check-out Details</h3>
          </div>

          <div className="admin-table-container">
            <table className="admin-data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Mode</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {CHECKIN_DETAILS_SAMPLE.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td className="admin-emp-name-cell">{row.name}</td>
                    <td>{row.dept}</td>
                    <td>{row.checkIn}</td>
                    <td>{row.checkOut}</td>
                    <td>
                      <span
                        className={`admin-mode-pill ${
                          row.mode.toLowerCase() === "office" ? "office" : "remote"
                        }`}
                      >
                        <span className="admin-mode-dot" />
                        {row.mode}
                      </span>
                    </td>
                    <td>{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Notifications & Approvals Card */}
        <div className="admin-card admin-scrollable-card">
          <div className="admin-card-header">
            <h3 className="admin-card-title">Notifications & Approvals</h3>
          </div>

          <div className="admin-approvals-list">
            {approvals.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.id} className="admin-approval-item">
                  <div className="admin-approval-left">
                    <div className={`admin-approval-icon-box ${item.iconColor}`}>
                      <Icon size={18} />
                    </div>
                    <div className="admin-approval-text">
                      <p className="admin-approval-msg">
                        <strong>{item.name}</strong> {item.actionText}
                      </p>
                      <div className="admin-approval-time">{item.time}</div>
                    </div>
                  </div>

                  <div className="admin-approval-actions">
                    {item.status === "pending" ? (
                      <>
                        {item.btnType === "review" ? (
                          <button
                            type="button"
                            className="admin-btn-action review"
                            onClick={() => handleReview(item.id, item.name)}
                          >
                            Review
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn-action approve"
                            onClick={() => handleApprove(item.id, item.name)}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          type="button"
                          className="admin-btn-action reject"
                          onClick={() => handleReject(item.id, item.name)}
                        >
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className={`admin-approval-badge-done ${item.status}`}>
                        {item.status === "approved" ? "Approved" : "Rejected"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
