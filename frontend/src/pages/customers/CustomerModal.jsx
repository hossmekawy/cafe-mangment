import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { FiX } from 'react-icons/fi';

const schema = yup.object().shape({
    first_name: yup.string().required('First name is required'),
    last_name: yup.string().nullable(),
    phone: yup.string().required('Phone number is required').min(10, 'Invalid phone number'),
    email: yup.string().email('Invalid email').nullable(),
    marketing_consent: yup.boolean(),
    preferences: yup.object().shape({
        allergies: yup.string().nullable(),
        general_notes: yup.string().nullable()
    })
});

const CustomerModal = ({ isOpen, onClose, onSubmit, customer = null }) => {
    const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            first_name: '',
            last_name: '',
            phone: '',
            email: '',
            marketing_consent: false,
            preferences: {
                allergies: '',
                general_notes: ''
            }
        }
    });

    useEffect(() => {
        if (customer) {
            reset({
                first_name: customer.first_name || '',
                last_name: customer.last_name || '',
                phone: customer.phone || '',
                email: customer.email || '',
                marketing_consent: customer.marketing_consent || false,
                preferences: {
                    allergies: customer.preferences?.allergies || '',
                    general_notes: customer.preferences?.general_notes || ''
                }
            });
        } else {
            reset({
                first_name: '',
                last_name: '',
                phone: '',
                email: '',
                marketing_consent: false,
                preferences: { allergies: '', general_notes: '' }
            });
        }
    }, [customer, reset, isOpen]);

    if (!isOpen) return null;

    const handleFormSubmit = async (data) => {
        await onSubmit(data);
        reset();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-surface rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
                    <h2 className="text-xl font-bold text-textMain">
                        {customer ? 'Edit Profile' : 'New Customer'}
                    </h2>
                    <button onClick={onClose} className="p-2 text-textMuted hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors">
                        <FiX className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    <form id="customer-form" onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Core Info */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-textMuted uppercase tracking-wider mb-2">Basic Info</h3>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">First Name *</label>
                                    <input {...register('first_name')} className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                                    {errors.first_name && <p className="text-red-500 text-xs mt-1">{errors.first_name.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Last Name</label>
                                    <input {...register('last_name')} className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Phone Number *</label>
                                    <input {...register('phone')} className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                                    {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Email</label>
                                    <input type="email" {...register('email')} className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" />
                                </div>
                                <div className="flex items-center gap-2 pt-2">
                                    <input type="checkbox" id="marketing" {...register('marketing_consent')} className="w-4 h-4 text-primary rounded" />
                                    <label htmlFor="marketing" className="text-sm text-textMain">Accepts Marketing & SMS Promos</label>
                                </div>
                            </div>

                            {/* Preferences & CRM */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-textMuted uppercase tracking-wider mb-2">Preferences</h3>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">Allergies</label>
                                    <textarea 
                                        {...register('preferences.allergies')} 
                                        rows="2"
                                        placeholder="e.g. Peanuts, Gluten"
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMain mb-1">General Notes</label>
                                    <textarea 
                                        {...register('preferences.general_notes')} 
                                        rows="3"
                                        placeholder="Likes window seat, regular cortado..."
                                        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-sm" 
                                    />
                                </div>
                                
                                {customer && (
                                    <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl mt-4 border border-slate-200 dark:border-white/10">
                                        <div className="flex justify-between items-center text-sm mb-2">
                                            <span className="text-textMuted">Loyalty Tier:</span>
                                            <span className="font-semibold text-textMain">{customer.loyalty_account?.current_tier_name || 'Standard'}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-textMuted">Points Balance:</span>
                                            <span className="font-semibold text-primary">{parseFloat(customer.loyalty_account?.points_balance || 0)} pts</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 dark:bg-black/20">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-textMain bg-surface border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        form="customer-form"
                        type="submit" 
                        disabled={isSubmitting}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CustomerModal;
