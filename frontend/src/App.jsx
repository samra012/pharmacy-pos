import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import RequireAuth from "./auth/RequireAuth";
import CheckoutPage from "./pages/CheckoutPage";
import InventoryPage from "./pages/InventoryPage";
import LoginPage from "./pages/LoginPage";
import ReportsPage from "./pages/ReportsPage";
import SalesHistoryPage from "./pages/SalesHistoryPage";
import StaffPage from "./pages/StaffPage";
import SettingsPage from "./pages/SettingsPage";
import ReceiptPage from "./pages/ReceiptPage";
import "./App.css";

const navClass = ({ isActive }) => (isActive ? "active" : "");

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isManager = user.role === "manager";

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Pharmacy POS</h1>
        <nav className="app-nav">
          <NavLink to="/checkout" className={navClass}>Checkout</NavLink>
          {isManager && <NavLink to="/inventory" className={navClass}>Inventory</NavLink>}
          <NavLink to="/sales" className={navClass}>Sales History</NavLink>
          {isManager && <NavLink to="/reports" className={navClass}>Reports</NavLink>}
          {isManager && <NavLink to="/staff" className={navClass}>Staff</NavLink>}
          {isManager && <NavLink to="/settings" className={navClass}>Settings</NavLink>}
        </nav>
        <div className="app-user">
          <span>
            {user.username} <span className="badge info">{user.role}</span>
          </span>
          <button className="secondary" onClick={handleLogout}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default function App() {
  const { checking } = useAuth();

  // While a saved token is being verified, show nothing but this, so neither
  // the login form nor a page flashes before we know who the user is.
  if (checking) {
    return <p className="empty-state" style={{ padding: "2rem" }}>Loading...</p>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/receipt/:saleId"
        element={
          <RequireAuth>
            <ReceiptPage />
          </RequireAuth>
        }
      />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Navigate to="/checkout" replace />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/sales" element={<SalesHistoryPage />} />
        <Route
          path="/inventory"
          element={
            <RequireAuth roles={["manager"]}>
              <InventoryPage />
            </RequireAuth>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireAuth roles={["manager"]}>
              <ReportsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/staff"
          element={
            <RequireAuth roles={["manager"]}>
              <StaffPage />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth roles={["manager"]}>
              <SettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/checkout" replace />} />
      </Route>
    </Routes>
  );
}
