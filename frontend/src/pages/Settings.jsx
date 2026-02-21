import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
    FiSave, FiLoader, FiGlobe, FiDollarSign, FiPrinter, FiShield, FiDatabase,
    FiDownload, FiUploadCloud, FiCheckCircle, FiSettings
} from 'react-icons/fi';
import { settingsApi } from '../api/settingsApi';
import toast from 'react-hot-toast';
import useSettingsStore from '../store/settingsStore';
import ReceiptPreview from '../components/ReceiptPreview'; // We will build this next

const TABS = [
    { id: 'general', label: 'Store Info', icon: FiGlobe },
    { id: 'financial', label: 'Financial & Localization', icon: FiDollarSign },
    { id: 'receipt', label: 'Printers & Receipts', icon: FiPrinter },
    { id: 'system', label: 'System & Backup', icon: FiDatabase },
];

export default function Settings() {
    const { settings, fetchSettings } = useSettingsStore();
    const [activeTab, setActiveTab] = useState('general');
    const [isSaving, setIsSaving] = useState(false);
    const [isBackingUp, setIsBackingUp] = useState(false);
    
    const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
        defaultValues: settings || {}
    });

    const [logoBase64, setLogoBase64] = useState(settings?.logo_base64 || '');

    // Real-time watching for the Preview component
    const watchReceiptProps = watch(['brand_name', 'brand_phone', 'address', 'tax_label', 'tax_rate', 'tax_inclusive', 'receipt_printer_type', 'receipt_language', 'receipt_header_msg', 'receipt_footer_msg', 'wifi_password', 'currency']);

    useEffect(() => {
        if (settings) {
            reset(settings);
            setLogoBase64(settings.logo_base64 || '');
        }
    }, [settings, reset]);

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result;
                setLogoBase64(base64String);
                setValue('logo_base64', base64String, { shouldDirty: true });
            };
            reader.readAsDataURL(file);
        }
    };

    const onSubmit = async (data) => {
        setIsSaving(true);
        try {
            await settingsApi.updateSettings(data);
            await fetchSettings(); // Refresh global local storage State
            toast.success('Settings updated successfully!');
        } catch (error) {
            console.error('Failed to update settings:', error);
            const msg = error.response?.data?.detail || error.response?.data?.error || 'Failed to update settings';
            toast.error(msg);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadBackup = async () => {
        setIsBackingUp(true);
        try {
            const res = await settingsApi.downloadBackup();
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `waitless_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
            toast.success('Backup downloaded successfully!');
        } catch (error) {
            toast.error('Failed to download backup');
        } finally {
            setIsBackingUp(false);
        }
    };

    const handleRestoreUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const confirm = window.confirm("WARNING: This will completely OVERWRITE your database with the backup file. Are you absolutely sure?");
        if (!confirm) {
            e.target.value = null;
            return;
        }

        const restoreToast = toast.loading("Restoring database... Please do not close this window.");
        try {
            await settingsApi.uploadRestore(file);
            toast.success("System Restored Successfully! Reloading in 3 seconds...", { id: restoreToast });
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } catch (error) {
            console.error(error);
            toast.error("Restore failed. Check console for details.", { id: restoreToast });
        } finally {
            e.target.value = null;
        }
    };

    if (!settings) {
        return (
            <div className="flex justify-center items-center h-[calc(100vh-100px)]">
                <FiLoader className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto flex flex-col items-center">
            
            <div className="w-full flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center">
                        <FiShield className="mr-3 text-primary" /> System Settings
                    </h1>
                    <p className="text-textMuted mt-1 text-sm">Configure branch details, POS behavior, taxes, and backups.</p>
                </div>
            </div>

            <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Sidebar Tabs */}
                <div className="lg:col-span-1 space-y-2">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center p-4 rounded-xl transition-all duration-200 text-left ${
                                    isActive 
                                    ? 'bg-primary/20 text-primary border border-primary/30 shadow-lg shadow-primary/10' 
                                    : 'bg-black/20 text-textMuted hover:bg-white/5 border border-transparent'
                                }`}
                            >
                                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                                <span className="font-semibold">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 glass-panel p-6 rounded-2xl relative min-h-[600px]">
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                        
                        {/* TAB: GENERAL */}
                        {activeTab === 'general' && (
                            <div className="animate-fade-in space-y-6">
                                <h2 className="text-xl font-bold text-white mb-6 border-b border-white/10 pb-2">Store Information</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-textMuted block mb-2">Cafe Logo</label>
                                        <div className="flex items-center space-x-6 bg-black/20 p-4 rounded-xl border border-white/5">
                                            <div className="w-20 h-20 rounded-xl overflow-hidden bg-primary/20 flex items-center justify-center shrink-0 border border-primary/30">
                                                {logoBase64 ? (
                                                    <img src={logoBase64} alt="Current Logo" className="w-full h-full object-contain" />
                                                ) : (
                                                    <span className="text-xs text-primary font-bold">No Logo</span>
                                                )}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <input 
                                                    type="file" 
                                                    accept="image/*" 
                                                    onChange={handleLogoUpload}
                                                    className="block w-full text-sm text-textMuted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 transition-colors"
                                                />
                                                <p className="text-xs text-textMuted">Recommended format: Square PNG or JPG, max 500x500px.</p>
                                            </div>
                                            {/* Hidden input to ensure it gets registered if present */}
                                            <input type="hidden" {...register('logo_base64')} />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-textMuted">Brand / Store Name</label>
                                        <input {...register('brand_name', { required: true })} className="input w-full" placeholder="e.g. Waitless Cafe" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-textMuted">Contact Phone</label>
                                        <input {...register('brand_phone')} className="input w-full" placeholder="e.g. 01099641402" />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-textMuted">Physical Address</label>
                                        <input {...register('address')} className="input w-full" placeholder="123 Main St, City" />
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-textMuted">Social Link / QR Data</label>
                                        <input {...register('social_link')} className="input w-full" placeholder="https://instagram.com/yourcafe" />
                                        <p className="text-xs text-textMuted mt-1">If set, a QR code pointing here will be printed on receipts.</p>
                                    </div>
                                    <div className="space-y-1 md:col-span-2">
                                        <label className="text-sm font-medium text-textMuted">Operating Hours (Internal Reference)</label>
                                        <textarea {...register('operating_hours')} className="input w-full h-24" placeholder="Mon-Fri: 8am - 10pm..." />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: FINANCIAL */}
                        {activeTab === 'financial' && (
                            <div className="animate-fade-in space-y-6">
                                <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">Financial & Localization</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-1 bg-black/20 p-4 rounded-xl border border-white/5">
                                        <label className="text-sm font-bold text-white block mb-2">Primary Currency</label>
                                        <select {...register('currency')} className="input w-full">
                                            <option value="EGP">Egyptian Pound (EGP)</option>
                                            <option value="USD">US Dollar ($)</option>
                                            <option value="EUR">Euro (€)</option>
                                            <option value="SAR">Saudi Riyal (SAR)</option>
                                            <option value="AED">Emirati Dirham (AED)</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1 bg-black/20 p-4 rounded-xl border border-white/5">
                                        <label className="text-sm font-bold text-white block mb-2">POS Interface Language</label>
                                        <select {...register('default_language')} className="input w-full">
                                            <option value="en">English</option>
                                            <option value="ar">Arabic (عربي)</option>
                                        </select>
                                        <p className="text-xs text-textMuted mt-2">Sets the default UI language for new staff sessions.</p>
                                    </div>
                                    
                                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-textMuted">Tax Label</label>
                                            <input {...register('tax_label')} className="input w-full" placeholder="VAT, GST, etc." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-textMuted">Tax Rate (%)</label>
                                            <input type="number" step="0.01" {...register('tax_rate')} className="input w-full" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-textMuted">Service Charge (%)</label>
                                            <input type="number" step="0.01" {...register('service_charge_rate')} className="input w-full" />
                                        </div>
                                    </div>
                                    
                                    <div className="md:col-span-2 flex items-center space-x-3 p-4 bg-primary/10 border border-primary/20 rounded-xl">
                                        <input type="checkbox" {...register('tax_inclusive')} id="tax_inc" className="w-5 h-5 rounded border-white/20 bg-black/20 text-primary focus:ring-primary" />
                                        <label htmlFor="tax_inc" className="font-medium text-white cursor-pointer select-none">
                                            Prices are Tax Inclusive
                                            <span className="block text-xs text-textMuted font-normal mt-0.5">If checked, taxes are calculated *out* of the final price rather than added on top.</span>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: PRINTERS & RECEIPTS */}
                        {activeTab === 'receipt' && (
                            <div className="animate-fade-in flex flex-col xl:flex-row gap-8">
                                <div className="flex-1 space-y-6">
                                    <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">Receipt Configuration</h2>
                                    
                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-white">Printer Paper Size</label>
                                        <select {...register('receipt_printer_type')} className="input w-full">
                                            <option value="thermal80">Thermal POS Printer (80mm)</option>
                                            <option value="thermal72">Thermal POS Printer (72mm)</option>
                                            <option value="a4">Standard A4 Printer</option>
                                            <option value="a5">Standard A5 Printer</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-bold text-white">Receipt Language</label>
                                        <select {...register('receipt_language')} className="input w-full">
                                            <option value="en">English</option>
                                            <option value="ar">Arabic</option>
                                        </select>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-textMuted">Header Message (Top of Receipt)</label>
                                        <textarea {...register('receipt_header_msg')} className="input w-full h-20" placeholder="Welcome to our store!" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-textMuted">Footer Message (Bottom of Receipt)</label>
                                        <textarea {...register('receipt_footer_msg')} className="input w-full h-20" placeholder="Thank you for your visit!" />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-textMuted">Guest Wi-Fi Password (Optional)</label>
                                        <input {...register('wifi_password')} className="input w-full" placeholder="e.g. cafe1234" />
                                        <p className="text-xs text-textMuted">Prints credentials securely at the bottom of the receipt.</p>
                                    </div>
                                </div>

                                {/* PREVIEW PANE SIDEBAR */}
                                <div className="w-full xl:w-96 shrink-0 bg-[#0f172a] rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                                    <div className="bg-black/40 p-3 border-b border-white/10 text-center text-sm font-bold text-textMuted uppercase tracking-wider">
                                        Live Receipt Preview
                                    </div>
                                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar flex justify-center bg-gray-900/50">
                                        <ReceiptPreview data={watchReceiptProps} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* TAB: SYSTEM & BACKUP */}
                        {activeTab === 'system' && (
                            <div className="animate-fade-in space-y-8">
                                <h2 className="text-xl font-bold text-white border-b border-white/10 pb-2">System Maintenance</h2>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* POS Behavior */}
                                    <div className="bg-black/20 border border-white/10 p-5 rounded-xl space-y-4">
                                        <h3 className="font-bold text-white flex items-center mb-4"><FiSettings className="mr-2"/> Checkout Flow</h3>
                                        <div className="flex items-center space-x-3">
                                            <input type="checkbox" {...register('enable_tips')} id="tips_inc" className="w-5 h-5 rounded border-white/20 bg-black/20 text-primary focus:ring-primary" />
                                            <label htmlFor="tips_inc" className="font-medium text-white cursor-pointer select-none">
                                                Enable Tip Prompts
                                            </label>
                                        </div>
                                    </div>

                                    {/* Backups */}
                                    <div className="md:col-span-2 bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 p-6 rounded-xl">
                                        <h3 className="text-lg font-bold text-blue-400 flex items-center mb-2">
                                            <FiDatabase className="mr-2" /> Database Backups
                                        </h3>
                                        <p className="text-sm text-textMuted mb-6">Create full JSON snapshots of your database, or safely restore the entire system from a previous snapshot.</p>
                                        
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <button 
                                                type="button"
                                                onClick={handleDownloadBackup}
                                                disabled={isBackingUp}
                                                className="btn bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 flex items-center justify-center space-x-2 border border-blue-500/30 flex-1"
                                            >
                                                {isBackingUp ? <FiLoader className="animate-spin" /> : <FiDownload />}
                                                <span>{isBackingUp ? 'Generating...' : 'Download Full Backup (.json)'}</span>
                                            </button>
                                            
                                            <div className="relative flex-1">
                                                <input 
                                                    type="file" 
                                                    accept=".json"
                                                    onChange={handleRestoreUpload}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                                <button 
                                                    type="button"
                                                    className="w-full btn bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center space-x-2 border border-red-500/20"
                                                >
                                                    <FiUploadCloud />
                                                    <span>Restore from Backup</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SAVE BUTTON FOR GENERAL/FINANCIAL/RECEIPT TABS */}
                        {activeTab !== 'system' && (
                            <div className="pt-6 mt-6 border-t border-white/10 flex justify-end">
                                <button type="submit" disabled={isSaving} className="btn btn-primary flex items-center space-x-2 px-8 py-3 text-lg font-bold shadow-lg shadow-primary/20">
                                    {isSaving ? <FiLoader className="animate-spin w-5 h-5" /> : <FiSave className="w-5 h-5" />}
                                    <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
                                </button>
                            </div>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
}
