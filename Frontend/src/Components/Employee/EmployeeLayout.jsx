import { useState, useEffect, useRef } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import "../../Styles/EmployeeDashboard.css";

export default function EmployeeLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const { logout, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  /* Auto-close mobile drawer on desktop resize */
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth > 768) {
        setMobileOpen(false);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  /* Live clock */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  /* Close dropdown when clicking outside */
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.info("You have been logged out.");
    navigate("/employee/login", { replace: true });
  };

  const greeting = () => {
    const h = currentTime.getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const dateFormatted = currentTime.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const userName = user?.name || "Employee";
  const firstName = userName.split(" ")[0] || "Employee";

  const navItems = [
    {
      label: "Dashboard",
      path: "/employee/home",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      label: "Take Attendance",
      path: "/employee/attendance",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      ),
    },
    {
      label: "Report",
      path: "/employee/records",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      label: "Leave Apply",
      path: "/employee/leave",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="12" y1="14" x2="12" y2="18" />
          <line x1="10" y1="16" x2="14" y2="16" />
        </svg>
      ),
    },
    {
      label: "Profile",
      path: "/employee/profile",
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="emp-app-layout">
      {/* ══════════════════════════ TOP HEADER ══════════════════════════ */}
      <header className="emp-top-header">
        <div className={`header-left ${sidebarCollapsed ? "collapsed" : ""}`}>
          <div className="header-logo-container">
            {!sidebarCollapsed ? (
              <img src="/Logos/intime-dashboard-logo.png" alt="InTime" className="header-logo-img" />
            ) : (
              <img src="/Logos/Intime Fevicon.png" alt="InTime" className="header-logo-favicon" />
            )}
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => {
              if (window.innerWidth <= 768) {
                setMobileOpen((prev) => !prev);
              } else {
                setSidebarCollapsed((prev) => !prev);
              }
            }}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label="Toggle navigation"
          >
            {/* On mobile: Hamburger or Close (X) icon */}
            <span className="emp-mobile-icon-wrap">
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
            <span className="emp-desktop-icon-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                {sidebarCollapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </span>
          </button>
        </div>

        <div className="header-right" ref={dropdownRef}>
          <div
            className="header-greeting-block"
            onClick={() => setUserDropdownOpen((prev) => !prev)}
            style={{ cursor: "pointer", position: "relative" }}
            title="Click for account options"
          >
            <span className="header-greeting-text">{greeting()}, {firstName}! 👋</span>
            <span className="header-greeting-date">{dateFormatted}</span>

            {userDropdownOpen && (
              <div className="user-dropdown-menu">
                <div className="dropdown-user-header">
                  <strong>{userName}</strong>
                  <span>{user?.designation || user?.role || "Employee"}</span>
                </div>
                <div className="dropdown-divider" />
                <button
                  type="button"
                  className="dropdown-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserDropdownOpen(false);
                    navigate("/employee/profile");
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                  Profile
                </button>
                <button
                  type="button"
                  className="dropdown-item logout"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserDropdownOpen(false);
                    handleLogout();
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ══════════════════════════ BODY (SIDEBAR + MAIN) ══════════════════════════ */}
      <div className="emp-body-container">
        {/* Mobile Backdrop Scrim */}
        {mobileOpen && (
          <div
            className="emp-sidebar-scrim"
            onClick={() => setMobileOpen(false)}
            aria-label="Close sidebar backdrop"
          />
        )}

        {/* ── Sidebar ── */}
        <aside className={`emp-sidebar ${sidebarCollapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.path}
                className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
                title={sidebarCollapsed ? item.label : ""}
                onClick={() => setMobileOpen(false)}
              >
                <span className="sidebar-icon">{item.icon}</span>
                {(!sidebarCollapsed || mobileOpen) && <span className="sidebar-label">{item.label}</span>}
              </NavLink>
            ))}

            {/* Logout button just below Profile section */}
            <button
              type="button"
              className="sidebar-link logout-btn"
              onClick={() => {
                setMobileOpen(false);
                handleLogout();
              }}
              title={sidebarCollapsed ? "Logout" : ""}
            >
              <span className="sidebar-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </span>
              {(!sidebarCollapsed || mobileOpen) && <span className="sidebar-label">Logout</span>}
            </button>
          </nav>

          {/* Bottom Sidebar Motivation Card & Copyright */}
          <div className="sidebar-bottom">
            <img
              src="/sidebar-bottom-exact.png"
              alt="Discipline Today Builds a Better Tomorrow"
              className="sidebar-bottom-card-img"
            />
          </div>
        </aside>

        {/* ── Main Dashboard Content ── */}
        <main className="emp-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
