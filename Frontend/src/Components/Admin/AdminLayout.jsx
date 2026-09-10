import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Clock,
  Users,
  CalendarCheck,
  BarChart3,
  User,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import "../../Styles/AdminDashboard.css";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/attendance", label: "Attendance Logs", icon: Clock },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/leave-management", label: "Leave Management", icon: CalendarCheck },
  { to: "/admin/reports", label: "Analysis", icon: BarChart3 },
  { to: "/admin/profile", label: "Profile", icon: User },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const { logout, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  const [currentTime, setCurrentTime] = useState(new Date());

  // Auto-close mobile drawer on desktop resize
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Live timer for header clock/greeting
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.info("You have been logged out.");
    navigate("/admin/login", { replace: true });
  };

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const dateFormatted = currentTime
    .toLocaleDateString("en-GB", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .replace(/\bSep\b/, "Sept");

  const adminName = user?.name || "Admin";
  const adminFirstName = adminName.split(" ")[0] || "Admin";

  return (
    <div className="admin-app-layout">
      {/* ══════════════════════════ TOP HEADER ══════════════════════════ */}
      <header className="admin-top-header">
        <div className={`admin-header-left ${collapsed ? "collapsed" : ""}`}>
          <div className="admin-brand-container">
            {!collapsed ? (
              <img
                src="/Logos/intime-dashboard-logo.png"
                alt="InTime"
                className="admin-header-logo-img"
              />
            ) : (
              <img
                src="/Logos/Intime Fevicon.png"
                alt="InTime"
                className="admin-header-logo-favicon"
              />
            )}
          </div>

          <button
            type="button"
            className="admin-collapse-toggle"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileOpen((prev) => !prev);
              } else {
                setCollapsed((prev) => !prev);
              }
            }}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle navigation"
          >
            {/* On mobile: Hamburger or Close (X) icon */}
            <span className="admin-mobile-icon-wrap">
              {mobileOpen ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </span>
            {/* On desktop: Chevron Left or Chevron Right */}
            <span className="admin-desktop-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {collapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </span>
          </button>
        </div>

        <div className="admin-header-right" ref={dropdownRef}>
          {/* Greeting message based on admin name */}
          <div
            className="admin-header-greeting-block"
            onClick={() => setDropdownOpen((prev) => !prev)}
            style={{ cursor: "pointer", position: "relative" }}
            title="Click for account options"
          >
            <span className="admin-header-greeting-text">
              {greeting()}, {adminFirstName}! 👋
            </span>
            <span className="admin-header-greeting-date">{dateFormatted}</span>

            {dropdownOpen && (
              <div className="admin-dropdown-menu">
                <div className="admin-dropdown-header">
                  <strong>{adminName}</strong>
                  <span>{user?.designation || "senior hr"}</span>
                </div>
                <div className="admin-dropdown-divider" />
                <button
                  type="button"
                  className="admin-dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(false);
                    navigate("/admin/profile");
                  }}
                >
                  <User size={16} />
                  <span>Profile</span>
                </button>
                <button
                  type="button"
                  className="admin-dropdown-item logout"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(false);
                    handleLogout();
                  }}
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════ BODY (SIDEBAR + MAIN) ══════════════════════════ */}
      <div className="admin-body-container">
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            className="admin-sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={`admin-sidebar ${collapsed ? "collapsed" : ""} ${
            mobileOpen ? "mobile-open" : ""
          }`}
        >
          <nav className="admin-sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.label}
                  to={item.to}
                  className={({ isActive }) =>
                    `admin-sidebar-link ${isActive ? "active" : ""}`
                  }
                  title={collapsed ? item.label : ""}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="admin-sidebar-icon">
                    <Icon size={20} />
                  </span>
                  {!collapsed && <span>{item.label}</span>}
                </NavLink>
              );
            })}

            {/* Logout button */}
            <button
              type="button"
              className="admin-sidebar-link logout-btn"
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              title={collapsed ? "Logout" : ""}
            >
              <span className="admin-sidebar-icon">
                <LogOut size={20} />
              </span>
              {!collapsed && <span>Logout</span>}
            </button>
          </nav>

          {/* Bottom Motivation Graphic & Copyright */}
          <div className="admin-sidebar-bottom">
            <img
              src="/sidebar-bottom-exact.png"
              alt="Discipline Today Builds a Better Tomorrow"
              className="admin-sidebar-bottom-img"
            />
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="admin-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
