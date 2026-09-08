import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";
import FullScreenLoader from "../Components/Loading/FullScreenLoader";

export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader label="Checking your session…" />;
  if (!user || user.role !== "employee") return <Navigate to="/employee/login" replace />;

  return <Outlet />;
}
