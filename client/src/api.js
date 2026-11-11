import axios from 'axios';

// Same domain in development (Vite proxy). Set VITE_API_URL when the backend is hosted elsewhere.
export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const api = axios.create({ baseURL: `${API_URL}/api` });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const errorMessage = (err) =>
  err.response?.data?.message || 'Could not reach the server. Is the backend running?';

export default api;
