import axios from 'axios';

const TOKEN_KEY = 'irc_token';
let onUnauthorized = () => {};

export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const setToken = (token) => sessionStorage.setItem(TOKEN_KEY, token);
export const clearToken = () => sessionStorage.removeItem(TOKEN_KEY);
export const setUnauthorizedHandler = (handler) => { onUnauthorized = handler; };

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api', timeout: 15000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const url = error.config?.url || '';
    const isAuthAttempt = url.endsWith('/auth/login') || url.endsWith('/auth/admin-login');
    if (error.response?.status === 401 && !isAuthAttempt) {
      onUnauthorized();
    }
    return Promise.reject(error);
  },
);

export default api;
