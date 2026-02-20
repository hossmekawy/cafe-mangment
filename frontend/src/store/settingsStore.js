import { create } from 'zustand';
import axiosInstance from '../api/axiosInstance';

const useSettingsStore = create((set) => ({
  settings: null,
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.get('/settings/');
      if (res.data.success) {
        set({ settings: res.data.data, isLoading: false });
      }
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  },

  updateSettings: async (updateData) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axiosInstance.put('/settings/', updateData);
      if (res.data.success) {
        set({ settings: res.data.data, isLoading: false });
        return { success: true };
      }
    } catch (error) {
      set({ error: error.response?.data?.detail || error.message, isLoading: false });
      return { success: false, error: error.response?.data?.detail };
    }
  }
}));

export default useSettingsStore;
