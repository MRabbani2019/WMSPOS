import axios from 'axios';
import { useAuthStore } from '../stores/authStore'; // used in request interceptor

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:9000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.dispatchEvent(new CustomEvent('pos:auth-expired'));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
