import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { clearToken, getMe, getToken, login as apiLogin, setToken } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { id, username, role } or null
  // If a token is saved, we must ask the backend who it belongs to before
  // deciding whether to show the app or the login page.
  const [checking, setChecking] = useState(() => Boolean(getToken()));

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  // The API client fires this when the backend rejects our token.
  useEffect(() => {
    window.addEventListener("auth:logout", logout);
    return () => window.removeEventListener("auth:logout", logout);
  }, [logout]);

  async function login(username, password) {
    const data = await apiLogin(username, password);
    setToken(data.access_token);
    setUser({ id: data.user_id, username: data.username, role: data.role });
  }

  return (
    <AuthContext.Provider value={{ user, checking, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
