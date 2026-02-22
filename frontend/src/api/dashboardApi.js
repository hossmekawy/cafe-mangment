import axiosInstance from './axiosInstance';

export const dashboardApi = {
    getDashboard: () => axiosInstance.get('/dashboard/'),
};
