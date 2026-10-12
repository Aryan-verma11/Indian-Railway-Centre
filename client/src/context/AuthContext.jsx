
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import api, {
  clearToken,
  getToken,
  setToken,
  setUnauthorizedHandler,
} from '../services/api.js';

const AuthContext = createContext(null);

const DEMO_USERS = [
  {
    roll_number: 'IRC001',
    date_of_birth: '2004-12-08',
    name: 'Demo Student 1',
    father_name: 'Demo Father 1',
    gender: 'Male',
    role: 'student',
  },
  {
    roll_number: 'IRC002',
    date_of_birth: '2003-05-15',
    name: 'Demo Student 2',
    father_name: 'Demo Father 2',
    gender: 'Female',
    role: 'student',
  },
  {
    roll_number: 'IRC003',
    date_of_birth: '2004-09-20',
    name: 'Demo Student 3',
    father_name: 'Demo Father 3',
    gender: 'Male',
    role: 'student',
  },
];

const DEMO_SESSION_KEY = 'irc_demo_user';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = useCallback(() => {
    clearToken();
    localStorage.removeItem(DEMO_SESSION_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(clearSession);

    // Restore temporary frontend demo session.
    const savedDemoUser = localStorage.getItem(DEMO_SESSION_KEY);

    if (savedDemoUser) {
      try {
        const parsedUser = JSON.parse(savedDemoUser);

        const isValidDemoUser = DEMO_USERS.some(
          (demoUser) =>
            demoUser.roll_number === parsedUser.roll_number &&
            demoUser.date_of_birth === parsedUser.date_of_birth
        );

        if (isValidDemoUser) {
          setUser(parsedUser);
          setLoading(false);
          return;
        }

        localStorage.removeItem(DEMO_SESSION_KEY);
      } catch {
        localStorage.removeItem(DEMO_SESSION_KEY);
      }
    }

    // Restore regular backend session if one exists.
    if (!getToken()) {
      setLoading(false);
      return;
    }

    api
      .get('/auth/me')
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        clearSession();
      })
      .finally(() => {
        setLoading(false);
      });
  }, [clearSession]);

  const login = useCallback(async (rollNumber, dateOfBirth) => {
    const normalizedRollNumber = String(rollNumber ?? '')
      .trim()
      .toUpperCase();

    const normalizedDateOfBirth = String(dateOfBirth ?? '').trim();

    const matchedUser = DEMO_USERS.find(
      (demoUser) =>
        demoUser.roll_number === normalizedRollNumber &&
        demoUser.date_of_birth === normalizedDateOfBirth
    );

    if (!matchedUser) {
      throw new Error(
        'Registration number or date of birth is incorrect.'
      );
    }

    clearToken();

    const demoUser = { ...matchedUser };

    localStorage.setItem(
      DEMO_SESSION_KEY,
      JSON.stringify(demoUser)
    );

    setUser(demoUser);

    return demoUser;
  }, []);

  // Admin login continues to use the backend.
  const adminLogin = useCallback(async (rollNumber, password) => {
    const { data } = await api.post('/auth/admin-login', {
      roll_number: rollNumber,
      password,
    });

    localStorage.removeItem(DEMO_SESSION_KEY);
    setToken(data.token);
    setUser(data.user);

    return data.user;
  }, []);

  const logout = useCallback(async () => {
    const isDemoSession = Boolean(
      localStorage.getItem(DEMO_SESSION_KEY)
    );

    if (!isDemoSession) {
      try {
        await api.post('/auth/logout');
      } catch {
        // Clear local session even if the backend is unavailable.
      }
    }

    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    await api.post('/auth/logout-all');
    clearSession();
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      adminLogin,
      logout,
      logoutAll,
    }),
    [user, loading, login, adminLogin, logout, logoutAll]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
