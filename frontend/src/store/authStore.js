import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

// Small decoding utility to extract claims. You will need to `npm install jwt-decode`
// Wait, I will use a simple base64 decode if not installed to avoid extra dependency.
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

const useAuthStore = create((set, get) => ({
  user: null, // { username, role, branch_id }
  isAuthenticated: false,
  isLoading: true, // Used for initial mount check

  // Check LocalStorage on app load
  initAuth: () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      const decoded = parseJwt(token);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        set({ user: decoded, isAuthenticated: true, isLoading: false });
      } else {
        // Expired token (interceptor will handle refresh on next request, but for immediate mount state:)
        set({ user: null, isAuthenticated: false, isLoading: false }); 
      }
    } else {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  // Login Action
  login: async (username, password) => {
    try {
      const res = await axiosInstance.post('/auth/login/', { username, password });
      if (res.data.success) {
        const { access, refresh } = res.data.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        
        const decoded = parseJwt(access);
        set({ user: decoded, isAuthenticated: true });
        return { success: true };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || "Login failed" 
      };
    }
  },

  // PIN Login Action (Staff)
  pinLogin: async (username, pin) => {
    try {
      const res = await axiosInstance.post('/auth/pin/login/', { username, pin });
      if (res.data.success) {
        const { access, refresh } = res.data.data;
        localStorage.setItem('access_token', access);
        localStorage.setItem('refresh_token', refresh);
        
        const decoded = parseJwt(access);
        set({ user: decoded, isAuthenticated: true });
        return { success: true };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.detail || "PIN Login failed" 
      };
    }
  },

  // Logout Action
  logout: async () => {
    try {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
         await axiosInstance.post('/auth/logout/', { refresh });
      }
    } catch (e) {
        console.error("Logout API failed", e);
    } finally {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, isAuthenticated: false });
    }
  }
}));

export default useAuthStore;
