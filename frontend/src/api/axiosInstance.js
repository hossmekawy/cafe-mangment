import axios from 'axios';

const BASE_URL = `http://${window.location.hostname}:8081/api`;

const axiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach the token to every request if it exists
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle automatic refreshing of token
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // If we catch a 401 Unauthorized, and we haven't already retried this original request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error('No refresh token available');
        
        // Request a new token
        const res = await axios.post(`${BASE_URL}/auth/token/refresh/`, {
            refresh: refreshToken
        });
        
        // Save the new tokens
        localStorage.setItem('access_token', res.data.access);
        if (res.data.refresh) localStorage.setItem('refresh_token', res.data.refresh); // simplejwt can rotate refresh tokens
        
        // Update the failed request's header and retry it!
        originalRequest.headers.Authorization = `Bearer ${res.data.access}`;
        return axiosInstance(originalRequest);
        
      } catch (refreshError) {
        // If the refresh token is also invalid/expired, log the user out
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        // We will handle the redirect to /login inside the AuthStore or a Router wrapper
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
