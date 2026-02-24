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
    importBulkProducts: (data) => axiosInstance.post('/inventory/products/preview_import/', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }),
    confirmBulkProducts: (data) => axiosInstance.post('/inventory/products/confirm_import/', { products: data }),
    exportProductsTemplate: () => axiosInstance.get('/inventory/products/export_template/', {
        responseType: 'blob'
    }),
    getProductAnalytics: (id, params) => axiosInstance.get(`/inventory/products/${id}/analytics/`, { params }),

    // Menu Categories
    getCategories: () => axiosInstance.get('/inventory/categories/'),
    createCategory: (data) => axiosInstance.post('/inventory/categories/', data),
    updateCategory: (id, data) => axiosInstance.put(`/inventory/categories/${id}/`, data),
    deleteCategory: (id) => axiosInstance.delete(`/inventory/categories/${id}/`),

    // Product Variations
    getVariations: () => axiosInstance.get('/inventory/product-variations/'),
    createVariation: (data) => axiosInstance.post('/inventory/product-variations/', data),
    updateVariation: (id, data) => axiosInstance.put(`/inventory/product-variations/${id}/`, data),
    deleteVariation: (id) => axiosInstance.delete(`/inventory/product-variations/${id}/`),

    // Combo Items
    getComboItems: () => axiosInstance.get('/inventory/combo-items/'),
    createComboItem: (data) => axiosInstance.post('/inventory/combo-items/', data),
    updateComboItem: (id, data) => axiosInstance.put(`/inventory/combo-items/${id}/`, data),
    deleteComboItem: (id) => axiosInstance.delete(`/inventory/combo-items/${id}/`),

    // Locations
    getLocations: () => axiosInstance.get('/inventory/locations/'),
    
    // Raw Materials
    getMaterials: () => axiosInstance.get('/inventory/materials/'),
    getMaterial: (id) => axiosInstance.get(`/inventory/materials/${id}/`),
    createMaterial: (data) => axiosInstance.post('/inventory/materials/', data),
    updateMaterial: (id, data) => axiosInstance.put(`/inventory/materials/${id}/`, data),
    deleteMaterial: (id) => axiosInstance.delete(`/inventory/materials/${id}/`),
    previewBulkMaterials: (data) => axiosInstance.post('/inventory/materials/preview_import/', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }),
    confirmBulkMaterials: (data) => axiosInstance.post('/inventory/materials/confirm_import/', { materials: data }),
    exportMaterialsTemplate: () => axiosInstance.get('/inventory/materials/export_template/', {
        responseType: 'blob'
    }),
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
    createRecipe: (data) => axiosInstance.post('/inventory/recipes/', data),
    updateRecipe: (id, data) => axiosInstance.put(`/inventory/recipes/${id}/`, data),
    deleteRecipe: (id) => axiosInstance.delete(`/inventory/recipes/${id}/`),
    previewBulkRecipes: (data) => axiosInstance.post('/inventory/recipes/preview_import/', data, {
        headers: {
            'Content-Type': 'multipart/form-data'
        }
    }),
    confirmBulkRecipes: (data) => axiosInstance.post('/inventory/recipes/confirm_import/', { recipes: data }),
    exportRecipesTemplate: () => axiosInstance.get('/inventory/recipes/export_template/', {
        responseType: 'blob'
    }),
    
    // Batch Productions
    getBatchProductions: () => axiosInstance.get('/inventory/batch-productions/'),
    createBatchProduction: (data) => axiosInstance.post('/inventory/batch-productions/', data),
    
    // Notifications
    getAlerts: () => axiosInstance.get('/inventory/alerts/'),
    markAlertsRead: () => axiosInstance.post('/inventory/alerts/mark_all_read/'),
};
