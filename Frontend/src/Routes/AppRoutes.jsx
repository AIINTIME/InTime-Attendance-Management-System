import { Routes, Route, Navigate } from "react-router-dom";
import { CalendarCheck, BarChart3 } from "lucide-react";
import { useAuth } from "../Context/AuthContext";
import FullScreenLoader from "../Components/Loading/FullScreenLoader";
import ComingSoon from "../Components/Common/ComingSoon";

import EmployeeLogin from "../Pages/Auth/EmployeeLogin";
import AdminLogin from "../Pages/Auth/AdminLogin";

import EmployeeLayout from "../Components/Employee/EmployeeLayout";
import EmployeeHome from "../Pages/Employee/EmployeeHome";
import Attendance from "../Pages/Employee/Attendance";
import AttendanceRecords from "../Pages/Employee/AttendanceRecords";
import LeaveApply from "../Pages/Employee/LeaveApply";
import EmployeeProfile from "../Pages/Employee/EmployeeProfile";

import AdminLayout from "../Components/Admin/AdminLayout";
import AdminDashboard from "../Pages/Admin/AdminDashboard";
import EmployeeManagement from "../Pages/Admin/EmployeeManagement";
import EmployeeDetails from "../Pages/Admin/EmployeeDetails";
import AttendanceManagement from "../Pages/Admin/AttendanceManagement";
import AdminProfile from "../Pages/Admin/AdminProfile";
import AdminSettings from "../Pages/Admin/Settings";

import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";

function RootRedirect() {
  const { user, isLoading } = useAuth();
  if (isLoading) return <FullScreenLoader />;
  if (user?.role === "employee") return <Navigate to="/employee/home" replace />;
  if (user?.role === "admin") return <Navigate to="/admin/attendance" replace />;
  return <Navigate to="/employee/login" replace />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />

      <Route path="/login" element={<EmployeeLogin />} />
      <Route path="/employee/login" element={<EmployeeLogin />} />
      <Route path="/admin/login" element={<AdminLogin />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<EmployeeLayout />}>
          <Route path="/dashboard" element={<Navigate to="/employee/home" replace />} />
          <Route path="/employee/home" element={<EmployeeHome />} />
          <Route path="/employee/attendance" element={<Attendance />} />
          <Route path="/employee/records" element={<AttendanceRecords />} />
          <Route path="/employee/leave" element={<LeaveApply />} />
          <Route path="/employee/profile" element={<EmployeeProfile />} />
        </Route>
      </Route>

      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<Navigate to="/admin/attendance" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/employees" element={<EmployeeManagement />} />
          <Route path="/admin/employees/:id" element={<EmployeeDetails />} />
          <Route path="/admin/attendance" element={<AttendanceManagement />} />
          <Route
            path="/admin/leave-management"
            element={
              <ComingSoon
                icon={CalendarCheck}
                title="Leave Management"
                message="Reviewing and approving employee leave requests is coming soon."
              />
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ComingSoon
                icon={BarChart3}
                title="Analysis"
                message="Attendance analytics and insights are coming soon."
              />
            }
          />
          <Route path="/admin/profile" element={<AdminProfile />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
