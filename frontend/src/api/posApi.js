import axiosInstance from './axiosInstance';

export const posApi = {
    // Products & Menu (Read-Only for POS touch interface)
    getProducts: (category = '') => {
        const url = category ? `/pos/products/?category=${category}` : '/pos/products/';
        return axiosInstance.get(url);
    },
    
    // Tables
    getTables: () => axiosInstance.get('/pos/tables/'),
    getTable: (id) => axiosInstance.get(`/pos/tables/${id}/`),
    createTable: (data) => axiosInstance.post('/pos/tables/', data),
    updateTable: (id, data) => axiosInstance.patch(`/pos/tables/${id}/`, data),
    updateTableStatus: (id, status) => axiosInstance.patch(`/pos/tables/${id}/`, { status }),
    deleteTable: (id) => axiosInstance.delete(`/pos/tables/${id}/`),
    
    // Orders (with filter support)
    getOrders: (params = {}) => axiosInstance.get('/pos/orders/', { params }),
    getOrder: (id) => axiosInstance.get(`/pos/orders/${id}/`),
    createOrder: (data) => axiosInstance.post('/pos/orders/', data),
    updateOrder: (id, data) => axiosInstance.patch(`/pos/orders/${id}/`, data),
    cancelOrder: (id, reason) => axiosInstance.post(`/pos/orders/${id}/cancel/`, { reason }),
    getOrdersSummary: () => axiosInstance.get('/pos/orders/summary/'),
    
    // Payments
    processPayment: (orderId, data) => axiosInstance.post(`/pos/orders/${orderId}/process_payment/`, data),
    
    // Kitchen Display System (KDS)
    getKDSItems: (station = '', status = '') => {
        let params = new URLSearchParams();
        if (station) params.append('station', station);
        if (status) params.append('status', status);
        
        const queryString = params.toString();
        const url = queryString ? `/pos/kds-items/?${queryString}` : '/pos/kds-items/';
        return axiosInstance.get(url);
    },
    bumpItemStatus: (itemId, status) => axiosInstance.post(`/pos/kds-items/${itemId}/bump_status/`, { status }),
};
