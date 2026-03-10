// components/auth/PrivateRoute.tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#f0eee9]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <div className="text-textColorPrimary text-lg">Carregando...</div>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/dashboard-admin/login" replace />;
};