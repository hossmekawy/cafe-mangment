import axiosInstance from './axiosInstance';

export const customersApi = {
    // Customers Core
    getCustomers: (params) => axiosInstance.get('/customers/customers/', { params }),
    getCustomer: (id) => axiosInstance.get(`/customers/customers/${id}/`),
    getCustomerStats: (id) => axiosInstance.get(`/customers/customers/${id}/stats/`),
    createCustomer: (data) => axiosInstance.post('/customers/customers/', data),
    updateCustomer: (id, data) => axiosInstance.put(`/customers/customers/${id}/`, data),
    deleteCustomer: (id) => axiosInstance.delete(`/customers/customers/${id}/`),

    // Tiers
    getTiers: () => axiosInstance.get('/customers/tiers/'),
    createTier: (data) => axiosInstance.post('/customers/tiers/', data),
    updateTier: (id, data) => axiosInstance.put(`/customers/tiers/${id}/`, data),
    deleteTier: (id) => axiosInstance.delete(`/customers/tiers/${id}/`),
};

export default customersApi;
