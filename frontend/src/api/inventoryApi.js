import axiosInstance from './axiosInstance';

export const inventoryApi = {
    // Units
    getUnits: () => axiosInstance.get('/inventory/units/'),
    
    // Locations
    getLocations: () => axiosInstance.get('/inventory/locations/'),
    
    // Raw Materials
    getMaterials: () => axiosInstance.get('/inventory/materials/'),
    getMaterial: (id) => axiosInstance.get(`/inventory/materials/${id}/`),
    createMaterial: (data) => axiosInstance.post('/inventory/materials/', data),
    updateMaterial: (id, data) => axiosInstance.put(`/inventory/materials/${id}/`, data),
    deleteMaterial: (id) => axiosInstance.delete(`/inventory/materials/${id}/`),
    getLowStock: () => axiosInstance.get('/inventory/materials/low_stock/'),
    adjustStock: (id, data) => axiosInstance.post(`/inventory/materials/${id}/adjust_stock/`, data),

    // Stock Movements
    getMovements: (params) => axiosInstance.get('/inventory/movements/', { params }),

    // Waste Logs
    getWasteLogs: () => axiosInstance.get('/inventory/waste/'),
    createWasteLog: (data) => axiosInstance.post('/inventory/waste/', data),

    // Physical Counts
    getCounts: () => axiosInstance.get('/inventory/physical-counts/'),
    createCount: (data) => axiosInstance.post('/inventory/physical-counts/', data),
    completeCount: (id) => axiosInstance.post(`/inventory/physical-counts/${id}/complete/`),

    // Recipes
    getRecipes: () => axiosInstance.get('/inventory/recipes/'),
    
    // Notifications
    getAlerts: () => axiosInstance.get('/inventory/alerts/'),
    markAlertsRead: () => axiosInstance.post('/inventory/alerts/mark_all_read/'),
};
