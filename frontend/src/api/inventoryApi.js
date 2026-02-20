import axiosInstance from './axiosInstance';

export const inventoryApi = {
    // Units
    getUnits: () => axiosInstance.get('/inventory/units/'),
    createUnit: (data) => axiosInstance.post('/inventory/units/', data),
    updateUnit: (id, data) => axiosInstance.put(`/inventory/units/${id}/`, data),
    deleteUnit: (id) => axiosInstance.delete(`/inventory/units/${id}/`),
    
    // Unit Conversions
    getConversions: () => axiosInstance.get('/inventory/conversions/'),
    createConversion: (data) => axiosInstance.post('/inventory/conversions/', data),
    updateConversion: (id, data) => axiosInstance.put(`/inventory/conversions/${id}/`, data),
    deleteConversion: (id) => axiosInstance.delete(`/inventory/conversions/${id}/`),

    // Products (Menu Items)
    getProducts: () => axiosInstance.get('/inventory/products/'),
    createProduct: (data) => axiosInstance.post('/inventory/products/', data),
    updateProduct: (id, data) => axiosInstance.put(`/inventory/products/${id}/`, data),
    deleteProduct: (id) => axiosInstance.delete(`/inventory/products/${id}/`),

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
