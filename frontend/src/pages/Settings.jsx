import { useEffect, useState } from 'react';
import useSettingsStore from '../store/settingsStore';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiSave } from 'react-icons/fi';

const Settings = () => {
  const { settings, fetchSettings, updateSettings, isLoading, error } = useSettingsStore();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({});
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    const res = await updateSettings(formData);
    if (res.success) {
      setSuccessMsg('Settings updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    }
  };

  if (isLoading && !settings) {
      return <div className="min-h-screen bg-background flex items-center justify-center text-primary">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-background text-textMain p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center space-x-4 mb-8">
            <button onClick={() => navigate('/')} className="p-2 hover:bg-surface rounded-full transition-colors">
                <FiArrowLeft className="w-6 h-6 text-textMuted hover:text-white" />
            </button>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-accent to-primary">
                Global Cafe Settings
            </h1>
        </div>

        {error && <div className="bg-danger/20 text-danger p-4 rounded-lg border border-danger/30">{error}</div>}
        {successMsg && <div className="bg-secondary/20 text-secondary p-4 rounded-lg border border-secondary/30">{successMsg}</div>}

        <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 space-y-8">
            
            {/* Brand Settings Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b border-white/10 pb-2 text-primary">Brand Information</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Brand Name</label>
                        <input type="text" name="brand_name" value={formData.brand_name || ''} onChange={handleChange} className="glass-input w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Contact Phone</label>
                        <input type="text" name="brand_phone" value={formData.brand_phone || ''} onChange={handleChange} className="glass-input w-full" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-textMuted mb-1">Social Link (For QR)</label>
                        <input type="url" name="social_link" value={formData.social_link || ''} onChange={handleChange} className="glass-input w-full" placeholder="https://linktr.ee/..." />
                    </div>
                </div>
            </section>

            {/* Financial Settings Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b border-white/10 pb-2 text-accent">Financial & Taxes</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Currency</label>
                        <input type="text" name="currency" value={formData.currency || ''} onChange={handleChange} className="glass-input w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">VAT (%)</label>
                        <input type="number" step="0.01" name="vat_percentage" value={formData.vat_percentage || ''} onChange={handleChange} className="glass-input w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Service Charge (%)</label>
                        <input type="number" step="0.01" name="service_percentage" value={formData.service_percentage || ''} onChange={handleChange} className="glass-input w-full" />
                    </div>
                </div>
                <div className="flex items-center space-x-3 mt-4">
                    <input 
                        type="checkbox" 
                        name="tax_inclusive" 
                        id="tax_inclusive"
                        checked={formData.tax_inclusive || false}
                        onChange={handleChange}
                        className="w-5 h-5 rounded border-slate-600 bg-surface text-primary focus:ring-primary focus:ring-offset-background"
                    />
                    <div>
                        <label htmlFor="tax_inclusive" className="font-medium">Prices are Tax Inclusive</label>
                        <p className="text-xs text-textMuted">If enabled, VAT is already included in menu prices.</p>
                    </div>
                </div>
            </section>

            {/* Receipt Settings Section */}
            <section className="space-y-4">
                <h2 className="text-xl font-semibold border-b border-white/10 pb-2 text-secondary">Receipt & Printing</h2>
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Receipt Footer Message</label>
                        <textarea name="receipt_ending_message" value={formData.receipt_ending_message || ''} onChange={handleChange} rows="2" className="glass-input w-full"></textarea>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Branch Address</label>
                            <input type="text" name="address" value={formData.address || ''} onChange={handleChange} className="glass-input w-full" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-textMuted mb-1">Guest Wi-Fi Password</label>
                            <input type="text" name="wifi_password" value={formData.wifi_password || ''} onChange={handleChange} className="glass-input w-full" />
                        </div>
                    </div>
                </div>
            </section>

            <div className="pt-4 flex justify-end">
                <button type="submit" disabled={isLoading} className="btn-primary space-x-2">
                    <FiSave className="w-5 h-5" />
                    <span>{isLoading ? 'Saving...' : 'Save Settings'}</span>
                </button>
            </div>
            
        </form>
      </div>
    </div>
  );
};

export default Settings;
