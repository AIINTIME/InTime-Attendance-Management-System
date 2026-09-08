import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, CheckCircle2, Building2, MapPinned, Clock } from "lucide-react";
import { getDashboard, listAttendance } from "../../Services/adminService";
import { formatTime } from "../../Utils/dateUtils";
import { GOOGLE_MAPS_QUERY_URL } from "../../Utils/constants";
import StatusBadge from "../../Components/Common/StatusBadge";
import EmptyState from "../../Components/Common/EmptyState";
import DailyTrendChart from "../../Components/Charts/DailyTrendChart";
import StatusDistributionChart from "../../Components/Charts/StatusDistributionChart";
import DepartmentBreakdownChart from "../../Components/Charts/DepartmentBreakdownChart";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [today, setToday] = useState(null);

  useEffect(() => {
    getDashboard().then(setStats);
    listAttendance({ page: 1, limit: 8, fromDate: todayKey(), toDate: todayKey() }).then((d) =>
      setToday(d.records)
    );
  }, []);

  return (
    <div className="page-stack">
      <div className="page-heading">
        <h2>Dashboard</h2>
        <p className="muted">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</p>
      </div>

      <div className="stat-grid">
        <StatCard icon={Users} color="primary" value={stats?.totalEmployees} label="Total Employees" />
        <StatCard icon={CheckCircle2} color="success" value={stats?.presentToday} label="Present Today" />
        <StatCard icon={Building2} color="violet" value={stats?.officeAttendance} label="Office Attendance" />
        <StatCard icon={MapPinned} color="warning" value={stats?.distanceAttendance} label="Distance Attendance" />
      </div>

      <div className="stat-grid">
        <MiniStat value={stats?.onTime} label="On Time" color="success" />
        <MiniStat value={stats?.slightLate} label="Slight Late" color="warning" />
        <MiniStat value={stats?.veryLate} label="Very Late" color="danger" />
        <MiniStat value={stats?.insufficientHours} label="Insufficient Hrs" color="danger" />
      </div>

      <div className="chart-grid">
        <div className="card">
          <h3>Daily attendance trend</h3>
          {stats ? <DailyTrendChart data={stats.dailyTrend} /> : <div className="spinner" />}
        </div>
        <div className="card">
          <h3>On-time vs late</h3>
          {stats ? (
            <StatusDistributionChart onTime={stats.onTime} slightLate={stats.slightLate} veryLate={stats.veryLate} />
          ) : (
            <div className="spinner" />
          )}
        </div>
      </div>

      <div className="card">
        <h3>Attendance by department (today)</h3>
        {stats ? <DepartmentBreakdownChart data={stats.departmentBreakdown} /> : <div className="spinner" />}
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Today's Attendance</h3>
          <Link to="/admin/attendance" className="link-strong">
            View all →
          </Link>
        </div>

        {today === null && <div className="spinner" />}
        {today?.length === 0 && (
          <EmptyState icon={Clock} title="No attendance yet today" />
        )}
        {today?.length > 0 && (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Check-in</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Location</th>
                </tr>
              </thead>
              <tbody>
                {today.map((r) => (
                  <tr key={r._id}>
                    <td>
                      <div className="cell-with-avatar">
                        <div className="avatar-circle small">{initials(r.employeeId?.name)}</div>
                        <div>
                          <div>{r.employeeId?.name}</div>
                          <div className="muted small">{r.employeeId?.employeeId}</div>
                        </div>
                      </div>
                    </td>
                    <td>{r.employeeId?.department}</td>
                    <td>{formatTime(r.checkInTime)}</td>
                    <td>{r.loginType === "OFFICE" ? "Office" : "Distance"}</td>
                    <td>
                      <StatusBadge status={r.latenessStatus} insufficientHours={r.insufficientHours} />
                    </td>
                    <td>
                      <a href={GOOGLE_MAPS_QUERY_URL(r.latitude, r.longitude)} target="_blank" rel="noreferrer" className="link-strong">
                        View
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, color, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        <Icon size={20} />
      </div>
      <div className="stat-value">{value ?? "-"}</div>
      <div className="stat-label">{label}</div>
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

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
