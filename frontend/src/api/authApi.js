import axiosInstance from './axiosInstance';

export const authApi = {
    // Current user endpoints
    login: (credentials) => axiosInstance.post('/auth/login/', credentials),
    pinLogin: (credentials) => axiosInstance.post('/auth/pin/login/', credentials),
    logout: (data) => axiosInstance.post('/auth/logout/', data),
    getProfile: () => axiosInstance.get('/auth/me/'),
    updateProfile: (data) => axiosInstance.patch('/auth/me/', data),
    updateTheme: (data) => axiosInstance.post('/auth/me/theme/', data),
    verifyManagerPIN: (data) => axiosInstance.post('/auth/pin/verify-manager/', data),
    
    // Admin User Management endpoints
    getUsers: () => axiosInstance.get('/auth/admin/users/'),
    createUser: (data) => axiosInstance.post('/auth/admin/users/create/', data),
    updateUser: (id, data) => axiosInstance.patch(`/auth/admin/users/${id}/`, data),
    deleteUser: (id) => axiosInstance.delete(`/auth/admin/users/${id}/`),
    getUserLogs: (id) => axiosInstance.get(`/auth/admin/users/${id}/logs/`),
    getUserSessions: (id) => axiosInstance.get(`/auth/admin/users/${id}/sessions/`),
    
    // Branches endpoint for dropdowns and management
    getBranches: () => axiosInstance.get('/auth/branches/'),
    createBranch: (data) => axiosInstance.post('/auth/branches/', data),
    updateBranch: (id, data) => axiosInstance.patch(`/auth/branches/${id}/`, data),
    deleteBranch: (id) => axiosInstance.delete(`/auth/branches/${id}/`),
};
