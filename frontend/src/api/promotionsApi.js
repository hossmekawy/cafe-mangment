import axiosInstance from './axiosInstance';

export const promotionsApi = {
    // Loyalty Rules
    getLoyaltyRules: () => axiosInstance.get('/promotions/loyalty-rules/'),
    createLoyaltyRule: (data) => axiosInstance.post('/promotions/loyalty-rules/', data),
    updateLoyaltyRule: (id, data) => axiosInstance.put(`/promotions/loyalty-rules/${id}/`, data),
    deleteLoyaltyRule: (id) => axiosInstance.delete(`/promotions/loyalty-rules/${id}/`),

    // Rewards
    getRewards: () => axiosInstance.get('/promotions/rewards/'),
    createReward: (data) => axiosInstance.post('/promotions/rewards/', data),
    updateReward: (id, data) => axiosInstance.put(`/promotions/rewards/${id}/`, data),
    deleteReward: (id) => axiosInstance.delete(`/promotions/rewards/${id}/`),

    // Campaigns (Happy Hour etc)
    getCampaigns: () => axiosInstance.get('/promotions/campaigns/'),
    createCampaign: (data) => axiosInstance.post('/promotions/campaigns/', data),
    updateCampaign: (id, data) => axiosInstance.put(`/promotions/campaigns/${id}/`, data),
    deleteCampaign: (id) => axiosInstance.delete(`/promotions/campaigns/${id}/`),

    // Coupons
    getCoupons: (params) => axiosInstance.get('/promotions/coupons/', { params }),
    createCoupon: (data) => axiosInstance.post('/promotions/coupons/', data),
    updateCoupon: (id, data) => axiosInstance.put(`/promotions/coupons/${id}/`, data),
    deleteCoupon: (id) => axiosInstance.delete(`/promotions/coupons/${id}/`),
};

export default promotionsApi;
