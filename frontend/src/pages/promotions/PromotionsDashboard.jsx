import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/PageHeader';
import { FiGift, FiPercent, FiStar, FiTag, FiPlus, FiEdit, FiTrash2 } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { promotionsApi } from '../../api/promotionsApi';
import DataTable from '../../components/DataTable';
import PromotionModal from './PromotionModal';

const PromotionsDashboard = () => {
    const [activeTab, setActiveTab] = useState('loyalty'); // loyalty, rewards, campaigns, coupons
    const [data, setData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            let res;
            if (activeTab === 'loyalty') res = await promotionsApi.getLoyaltyRules();
            else if (activeTab === 'rewards') res = await promotionsApi.getRewards();
            else if (activeTab === 'campaigns') res = await promotionsApi.getCampaigns();
            else res = await promotionsApi.getCoupons();
            setData(res.data);
        } catch (error) {
            toast.error(`Failed to load ${activeTab}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure?")) return;
        try {
            if (activeTab === 'loyalty') await promotionsApi.deleteLoyaltyRule(id);
            else if (activeTab === 'rewards') await promotionsApi.deleteReward(id);
            else if (activeTab === 'campaigns') await promotionsApi.deleteCampaign(id);
            else await promotionsApi.deleteCoupon(id);
            toast.success('Successfully deleted');
            fetchData();
        } catch (err) {
            toast.error('Failed to delete item');
        }
    };

    const handleCreate = () => {
        setEditingItem(null);
        setIsModalOpen(true);
    };

    const handleEdit = (item) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (formData) => {
        try {
            if (editingItem) {
                if (activeTab === 'loyalty') await promotionsApi.updateLoyaltyRule(editingItem.id, formData);
                else if (activeTab === 'rewards') await promotionsApi.updateReward(editingItem.id, formData);
                else if (activeTab === 'campaigns') await promotionsApi.updateCampaign(editingItem.id, formData);
                else await promotionsApi.updateCoupon(editingItem.id, formData);
                toast.success('Successfully updated');
            } else {
                if (activeTab === 'loyalty') await promotionsApi.createLoyaltyRule(formData);
                else if (activeTab === 'rewards') await promotionsApi.createReward(formData);
                else if (activeTab === 'campaigns') await promotionsApi.createCampaign(formData);
                else await promotionsApi.createCoupon(formData);
                toast.success('Successfully created');
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.detail || error.response?.data?.error || 'Failed to save details');
        }
    };

    const getColumns = () => {
        const actionCol = {
            header: "Actions",
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => handleEdit(row.original)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <FiEdit className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleDelete(row.original.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        };

        if (activeTab === 'loyalty') {
            return [
                { header: "Rule Name", accessorKey: "name" },
                { header: "Spend Req.", accessorFn: (r) => `${r.spend_amount} EGP` },
                { header: "Points Earned", accessorFn: (r) => `${r.points_earned} pts` },
                { 
                    header: "Status", 
                    id: "status",
                    cell: ({ row }) => {
                        const r = row.original;
                        return (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-textMain'}`}>
                                {r.is_active ? 'Active' : 'Inactive'}
                            </span>
                        );
                    }
                },
                actionCol
            ];
        }

        if (activeTab === 'rewards') {
            return [
                { header: "Reward Name", accessorKey: "name" },
                { header: "Points Cost", accessorFn: (r) => `${r.points_cost} pts` },
                { header: "Discount Value", accessorFn: (r) => r.is_percentage ? `${r.discount_value}%` : `${r.discount_value} EGP` },
                { 
                    header: "Status", 
                    id: "status",
                    cell: ({ row }) => {
                        const r = row.original;
                        return (
                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-textMain'}`}>
                                {r.is_active ? 'Active' : 'Inactive'}
                            </span>
                        );
                    }
                },
                actionCol
            ];
        }

        // Add Campaign and Coupon columns similarly if needed...
        return [{ header: "Name/Code", accessorFn: (r) => r.name || r.code }, actionCol]; 
    };

    const tabs = [
        { id: 'loyalty', label: 'Loyalty Engine', icon: FiStar, description: 'Earning rules' },
        { id: 'rewards', label: 'Rewards Menu', icon: FiGift, description: 'Burning rules' },
        { id: 'campaigns', label: 'Campaigns', icon: FiPercent, description: 'Happy hour etc.' },
        { id: 'coupons', label: 'Promo Codes', icon: FiTag, description: 'Vouchers' }
    ];

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Promotions Engine"
                subtitle="Configure how customers earn points, redeem rewards, and use discounts"
                icon={FiGift}
                action={{
                    label: `New ${tabs.find(t => t.id === activeTab)?.label.split(' ')[0] || 'Item'}`,
                    icon: FiPlus,
                    onClick: handleCreate
                }}
            />

            {/* Navigation Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`
                            flex flex-col items-start p-4 rounded-xl border transition-all duration-200 text-left
                            ${activeTab === tab.id 
                                ? 'bg-primary/10 border-primary/30 shadow-sm ring-1 ring-primary/20' 
                                : 'glass-panel hover:border-slate-200 dark:border-white/10'
                            }
                        `}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 rounded-lg ${activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-surface text-textMuted'}`}>
                                <tab.icon className="w-5 h-5" />
                            </div>
                            <span className={`font-semibold ${activeTab === tab.id ? 'text-primary' : 'text-textMain'}`}>
                                {tab.label}
                            </span>
                        </div>
                        <span className="text-xs text-textMuted px-1">{tab.description}</span>
                    </button>
                ))}
            </div>

            {/* Data Grid */}
            <div className="glass-panel overflow-hidden">
                <DataTable 
                    columns={getColumns()}
                    data={data}
                    isLoading={isLoading}
                    emptyMessage={`No ${activeTab} configured yet.`}
                />
            </div>

            <PromotionModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                type={activeTab}
                initialData={editingItem}
            />
        </div>
    );
};

export default PromotionsDashboard;
