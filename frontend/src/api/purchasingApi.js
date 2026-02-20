import axiosInstance from './axiosInstance';

export const purchasingApi = {
    // Suppliers
    getSuppliers: () => axiosInstance.get('/purchasing/suppliers/'),
    getSupplier: (id) => axiosInstance.get(`/purchasing/suppliers/${id}/`),
    createSupplier: (data) => axiosInstance.post('/purchasing/suppliers/', data),
    updateSupplier: (id, data) => axiosInstance.put(`/purchasing/suppliers/${id}/`, data),
    deleteSupplier: (id) => axiosInstance.delete(`/purchasing/suppliers/${id}/`),

    // Purchase Orders
    getOrders: () => axiosInstance.get('/purchasing/purchase-orders/'),
    getOrder: (id) => axiosInstance.get(`/purchasing/purchase-orders/${id}/`),
    createOrder: (data) => axiosInstance.post('/purchasing/purchase-orders/', data),
    updateOrder: (id, data) => axiosInstance.put(`/purchasing/purchase-orders/${id}/`, data),
    confirmOrder: (id) => axiosInstance.post(`/purchasing/purchase-orders/${id}/confirm/`),
    cancelOrder: (id) => axiosInstance.post(`/purchasing/purchase-orders/${id}/cancel/`),

    // Goods Received Notes (GRN)
    getGRNs: () => axiosInstance.get('/purchasing/grns/'),
    getGRN: (id) => axiosInstance.get(`/purchasing/grns/${id}/`),
    createGRN: (data) => axiosInstance.post('/purchasing/grns/', data),
    completeGRN: (id) => axiosInstance.post(`/purchasing/grns/${id}/complete/`),

    // Invoices
    getInvoices: () => axiosInstance.get('/purchasing/invoices/'),
    getInvoice: (id) => axiosInstance.get(`/purchasing/invoices/${id}/`),
    payInvoice: (id, data) => axiosInstance.post(`/purchasing/invoices/${id}/pay/`, data),
};
