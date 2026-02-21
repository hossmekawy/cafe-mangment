import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FiX } from 'react-icons/fi';
import { inventoryApi } from '../../api/inventoryApi';

const PromotionModal = ({ isOpen, onClose, onSubmit, type, initialData }) => {
    const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm();
    const [categories, setCategories] = useState([]);
    const [products, setProducts] = useState([]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // formatting dates if present
                const formatted = { ...initialData };
                if (formatted.start_date) formatted.start_date = formatted.start_date.substring(0, 16);
                if (formatted.end_date) formatted.end_date = formatted.end_date.substring(0, 16);
                if (formatted.expiry_date) formatted.expiry_date = formatted.expiry_date.substring(0, 16);
                reset(formatted);
            } else {
                reset({
                    is_active: true,
                    is_percentage: false,
                    usage_limit: 0
                });
            }

            if (type === 'rewards' || type === 'campaigns') {
                inventoryApi.getProducts().then(res => setProducts(res.data)).catch(() => {});
            }
            if (type === 'campaigns') {
                inventoryApi.getCategories().then(res => setCategories(res.data)).catch(() => {});
            }
        }
    }, [isOpen, initialData, type, reset]);

    const handleFormSubmit = async (data) => {
        // Convert empty strings to null for foreign keys
        const cleanedData = { ...data };
        if (cleanedData.free_product === "") cleanedData.free_product = null;
        if (cleanedData.target_category === "") cleanedData.target_category = null;
        if (cleanedData.target_product === "") cleanedData.target_product = null;
        if (cleanedData.start_date === "") cleanedData.start_date = null;
        if (cleanedData.end_date === "") cleanedData.end_date = null;
        if (cleanedData.expiry_date === "") cleanedData.expiry_date = null;

        await onSubmit(cleanedData);
    };

    if (!isOpen) return null;

    const titles = {
        loyalty: 'Loyalty Rule',
        rewards: 'Reward',
        campaigns: 'Campaign',
        coupons: 'Coupon Code'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
            <div className="relative bg-surface w-full max-w-lg rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-white/10">
                    <h2 className="text-xl font-bold text-textMain">
                        {initialData ? 'Edit' : 'Create'} {titles[type]}
                    </h2>
                    <button onClick={onClose} className="p-2 text-textMuted hover:text-textMain hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-colors">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <form id="promoForm" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
                        
                        {/* LOYALTY RULES */}
                        {type === 'loyalty' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Rule Name</label>
                                    <input type="text" {...register('name', { required: true })} className="form-input" placeholder="e.g. Standard Earn Rate" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Spend Amount (EGP)</label>
                                        <input type="number" step="0.01" {...register('spend_amount', { required: true })} className="form-input" placeholder="10.00" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Points Earned</label>
                                        <input type="number" step="0.01" {...register('points_earned', { required: true })} className="form-input" placeholder="1.0" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* REWARDS */}
                        {type === 'rewards' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Reward Name</label>
                                    <input type="text" {...register('name', { required: true })} className="form-input" placeholder="e.g. Free Coffee" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Points Cost</label>
                                    <input type="number" {...register('points_cost', { required: true })} className="form-input" placeholder="100" />
                                </div>
                                
                                <div className="border border-slate-200 dark:border-white/10 p-4 rounded-xl space-y-4">
                                    <h4 className="text-sm font-semibold text-textMain">Reward Effect</h4>
                                    <div className="flex items-center space-x-2">
                                        <input type="checkbox" id="is_percentage" {...register('is_percentage')} className="form-checkbox bg-transparent" />
                                        <label htmlFor="is_percentage" className="text-sm text-textMuted select-none cursor-pointer">Is Percentage Discount?</label>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Discount Value</label>
                                        <input type="number" step="0.01" {...register('discount_value')} className="form-input" placeholder={watch('is_percentage') ? "e.g. 15 (%)" : "e.g. 50 (EGP)"} />
                                    </div>
                                    <div className="pt-2 border-t border-slate-100 dark:border-white/5">
                                        <label className="block text-sm font-medium text-textMain mb-1">Or Free Product</label>
                                        <select {...register('free_product')} className="form-input">
                                            <option value="">-- No Free Product --</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* CAMPAIGNS */}
                        {type === 'campaigns' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Campaign Name</label>
                                    <input type="text" {...register('name', { required: true })} className="form-input" placeholder="e.g. Summer Happy Hour" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Description</label>
                                    <textarea {...register('description')} className="form-input" rows="2" placeholder="Internal notes..."></textarea>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Start Date</label>
                                        <input type="datetime-local" {...register('start_date')} className="form-input" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">End Date</label>
                                        <input type="datetime-local" {...register('end_date')} className="form-input" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Target Category</label>
                                        <select {...register('target_category')} className="form-input">
                                            <option value="">-- Any --</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Target Product</label>
                                        <select {...register('target_product')} className="form-input">
                                            <option value="">-- Any --</option>
                                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Discount %</label>
                                    <input type="number" step="0.01" {...register('discount_percentage', { required: true })} className="form-input" placeholder="10" />
                                </div>
                            </>
                        )}

                        {/* COUPONS */}
                        {type === 'coupons' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Coupon Code</label>
                                    <input type="text" {...register('code', { required: true })} className="form-input uppercase font-mono" placeholder="WELCOME10" />
                                </div>
                                <div className="flex items-center space-x-2 my-2">
                                    <input type="checkbox" id="coupon_is_percentage" {...register('is_percentage')} className="form-checkbox bg-transparent" />
                                    <label htmlFor="coupon_is_percentage" className="text-sm font-medium text-textMain select-none cursor-pointer">Is Percentage Discount?</label>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Discount Value</label>
                                    <input type="number" step="0.01" {...register('discount_value', { required: true })} className="form-input" placeholder={watch('is_percentage') ? "e.g. 15 (%)" : "e.g. 50 (EGP)"} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 mt-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Usage Limit</label>
                                        <input type="number" {...register('usage_limit')} className="form-input" placeholder="0 for unlimited" />
                                        <p className="text-xs text-textMuted mt-1">Leave 0 for unlimited uses</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMain mb-1">Expiry Date</label>
                                        <input type="datetime-local" {...register('expiry_date')} className="form-input" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* COMMON ACTIVE TOGGLE */}
                        <div className="pt-4 border-t border-slate-200 dark:border-white/10 mt-4">
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="is_active" {...register('is_active')} className="form-checkbox w-5 h-5 text-primary rounded border-slate-300 dark:border-white/20 bg-transparent focus:ring-primary focus:ring-offset-background" />
                                <label htmlFor="is_active" className="text-sm font-medium text-textMain select-none cursor-pointer">Active / Enabled</label>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 rounded-b-2xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-textMain hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="promoForm" disabled={isSubmitting} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg disabled:opacity-50 transition-colors flex items-center">
                        {isSubmitting ? (
                            <><div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div> Saving...</>
                        ) : 'Save Details'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PromotionModal;
