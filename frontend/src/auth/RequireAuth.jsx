import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

// Wraps pages that need a logged-in user, optionally limited to certain roles.
// Note: this only controls what the UI shows. The backend enforces the real rules.
export default function RequireAuth({ roles, children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/checkout" replace />;
  return children;
}
