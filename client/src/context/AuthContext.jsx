import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { clearToken, getToken, setToken, setUnauthorizedHandler } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);
    if (!getToken()) {
      setLoading(false);
      return;
    }
    api.get('/auth/me')
      .then((response) => setUser(response.data.user))
      .catch(clearSession)
      .finally(() => setLoading(false));
  }, [clearSession]);

  const login = useCallback(async (rollNumber, dateOfBirth) => {
    const { data } = await api.post('/auth/login', { roll_number: rollNumber, date_of_birth: dateOfBirth });
    setToken(data.token); setUser(data.user); return data.user;
  }, []);

  const adminLogin = useCallback(async (rollNumber, password) => {
    const { data } = await api.post('/auth/admin-login', { roll_number: rollNumber, password });
    setToken(data.token); setUser(data.user); return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The local session is removed regardless of the server response.
    }
    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    await api.post('/auth/logout-all');
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({ user, loading, login, adminLogin, logout, logoutAll }),
    [user, loading, login, adminLogin, logout, logoutAll],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
