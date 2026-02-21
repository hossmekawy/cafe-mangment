import axiosInstance from './axiosInstance';

export const settingsApi = {
    getSettings: () => axiosInstance.get('/settings/'),
    updateSettings: (data) => axiosInstance.put('/settings/', data),
    
    // Backup endpoints
    downloadBackup: () => axiosInstance.get('/settings/backup/', { responseType: 'blob' }),
    uploadRestore: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return axiosInstance.post('/settings/restore/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },

    // Order Cancellation Reasons (configurable)
    getCancelReasons: () => axiosInstance.get('/settings/cancel-reasons/'),
    createCancelReason: (data) => axiosInstance.post('/settings/cancel-reasons/', data),
    updateCancelReason: (id, data) => axiosInstance.patch(`/settings/cancel-reasons/${id}/`, data),
    deleteCancelReason: (id) => axiosInstance.delete(`/settings/cancel-reasons/${id}/`),
};
