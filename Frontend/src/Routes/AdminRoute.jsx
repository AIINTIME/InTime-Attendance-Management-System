import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../Context/AuthContext";
import FullScreenLoader from "../Components/Loading/FullScreenLoader";

export default function AdminRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <FullScreenLoader label="Checking your session…" />;
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" replace />;

  return <Outlet />;
}
