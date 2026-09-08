import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid,
  Users,
  CalendarCheck,
  FileBarChart,
  User,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
} from "lucide-react";
import Logo from "../Common/Logo";
import ThemeToggle from "../Common/ThemeToggle";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";

const NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/admin/employees", label: "Employees", icon: Users },
  { to: "/admin/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/profile", label: "Profile", icon: User },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.info("You have been logged out.");
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className={`admin-shell ${collapsed ? "sidebar-collapsed" : ""} ${mobileOpen ? "mobile-nav-open" : ""}`}>
      {mobileOpen && <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />}

      <aside className="admin-sidebar">
        <div className="sidebar-top">
          <Logo variant={collapsed ? "icon" : "full"} height={collapsed ? 28 : 22} />
          <button
            type="button"
            className="icon-button mobile-only"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={19} />
              <span className="sidebar-label">{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button type="button" className="sidebar-link" onClick={handleLogout}>
            <LogOut size={19} />
            <span className="sidebar-label">Logout</span>
          </button>
          <button
            type="button"
            className="sidebar-collapse-btn desktop-only"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <button
            type="button"
            className="icon-button mobile-only"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="topbar-spacer" />
          <ThemeToggle />
          <div className="avatar-circle small">{initials(user?.name)}</div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function initials(name) {
  if (!name) return "";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
