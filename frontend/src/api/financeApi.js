import axiosInstance from './axiosInstance';

export const financeApi = {
    // Shifts
    getShifts: (params) => axiosInstance.get('/finance/shifts/', { params }),
    getCurrentShift: () => axiosInstance.get('/finance/shifts/current/'),
    getShiftSummary: (id) => axiosInstance.get(`/finance/shifts/${id}/summary/`),
    openShift: (data) => axiosInstance.post('/finance/shifts/open_shift/', data),
    closeShift: (id, data) => axiosInstance.post(`/finance/shifts/${id}/close_shift/`, data),
    updateShift: (id, data) => axiosInstance.put(`/finance/shifts/${id}/`, data),
    approveShift: (id) => axiosInstance.post(`/finance/shifts/${id}/approve/`),
    getShiftAnalytics: (id) => axiosInstance.get(`/finance/shifts/${id}/shift_analytics/`),
    
    // Cash Movements & Drops
    getCashMovements: (params) => axiosInstance.get('/finance/cash-movements/', { params }),
    createCashDrop: (data) => axiosInstance.post('/finance/cash-drops/', data),

    // Sales Journal
    getTransactions: (params) => axiosInstance.get('/finance/transactions/', { params }),
    getTransactionSummary: (params) => axiosInstance.get('/finance/transactions/summary/', { params }),
    voidTransaction: (id, data) => axiosInstance.post(`/finance/transactions/${id}/void/`, data),
    createRefund: (data) => axiosInstance.post('/finance/refunds/', data),

    // Expenses
    getExpenseCategories: () => axiosInstance.get('/finance/expense-categories/'),
    createExpenseCategory: (data) => axiosInstance.post('/finance/expense-categories/', data),
    getExpenses: (params) => axiosInstance.get('/finance/expenses/', { params }),
    getExpenseSummary: () => axiosInstance.get('/finance/expenses/summary/'),
    createExpense: (data) => axiosInstance.post('/finance/expenses/', data),
    approveExpense: (id) => axiosInstance.post(`/finance/expenses/${id}/approve/`),
    rejectExpense: (id) => axiosInstance.post(`/finance/expenses/${id}/reject/`),

    // Petty Cash
    getPettyCashFunds: () => axiosInstance.get('/finance/petty-cash-funds/'),
    getPettyCashTransactions: (params) => axiosInstance.get('/finance/petty-cash-transactions/', { params }),
    createPettyCashTransaction: (data) => axiosInstance.post('/finance/petty-cash-transactions/', data),

    // Bank Reconciliation
    getBankAccounts: () => axiosInstance.get('/finance/bank-accounts/'),
    getReconciliations: (params) => axiosInstance.get('/finance/bank-reconciliations/', { params }),
    createReconciliation: (data) => axiosInstance.post('/finance/bank-reconciliations/', data),
    completeReconciliation: (id) => axiosInstance.post(`/finance/bank-reconciliations/${id}/complete/`),
    matchReconciliationItem: (id, data) => axiosInstance.post(`/finance/bank-reconciliations/${id}/match_item/`, data),
    importReconciliationCSV: (id, data) => axiosInstance.post(`/finance/bank-reconciliations/${id}/import_csv/`, data),

    // Corporate Invoicing
    getClients: (params) => axiosInstance.get('/finance/corporate-clients/', { params }),
    createClient: (data) => axiosInstance.post('/finance/corporate-clients/', data),
    updateClient: (id, data) => axiosInstance.put(`/finance/corporate-clients/${id}/`, data),
    getInvoices: (params) => axiosInstance.get('/finance/corporate-invoices/', { params }),
    getInvoice: (id) => axiosInstance.get(`/finance/corporate-invoices/${id}/`),
    createInvoice: (data) => axiosInstance.post('/finance/corporate-invoices/', data),
    recordInvoicePayment: (id, data) => axiosInstance.post(`/finance/corporate-invoices/${id}/record_payment/`, data),
    submitInvoiceETA: (id) => axiosInstance.post(`/finance/corporate-invoices/${id}/submit_eta/`),

    // Reports
    getEODReports: (params) => axiosInstance.get('/finance/eod-reports/', { params }),
    generateEODReport: (data) => axiosInstance.post('/finance/eod-reports/generate/', data),
    approveEODReport: (id) => axiosInstance.post(`/finance/eod-reports/${id}/approve/`),
    
    getFinancialReport: (params) => axiosInstance.get('/finance/reports/', { params }),
};
