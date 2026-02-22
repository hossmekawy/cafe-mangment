import axiosInstance from './axiosInstance';

export const reportsApi = {
    // These return JSON by default
    getSales: (params) => axiosInstance.get('/reports/sales/', { params }),
    getInventory: (params) => axiosInstance.get('/reports/inventory/', { params }),
    getCustomers: (params) => axiosInstance.get('/reports/customers/', { params }),
    getFinancials: (params) => axiosInstance.get('/reports/finance/', { params }),

    // Helper for downloading files
    downloadReport: (type, params) => {
        // map 'finance' frontend type to 'finance' route if necessary, 
        // actually looking at urls.py we have 'finance/' defined for FinancialReportView! Let me check the django urls again.
        return axiosInstance.get(`/reports/${type}/`, {
            params,
            responseType: 'blob', // Important for PDF/Excel
        });
    }
};
