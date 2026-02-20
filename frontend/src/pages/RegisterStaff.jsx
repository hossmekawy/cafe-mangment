import { useState } from 'react';
import useAuthStore from '../store/authStore';
import axiosInstance from '../api/axiosInstance';
import { FiSave, FiUploadCloud, FiUser } from 'react-icons/fi';

const RegisterStaff = () => {
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    role: 'cashier',
    pin: '',
    avatar: ''
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Convert File to Base64 String
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB restriction
          setError("File cannot be larger than 2MB.");
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, avatar: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setError('');

    try {
      // The backend expects password to be at least 8 chars if provided, 
      // but if we leave it blank in formData, we must rely on backend default 'cafe1234'
      const payload = { ...formData };
      if (!payload.password) delete payload.password;

      const res = await axiosInstance.post('/auth/admin/users/create/', payload);
      
      if (res.data.success) {
          setMessage(`Staff account ${formData.username} created successfully!`);
          setFormData({
              username: '', name: '', password: '', role: 'cashier', pin: '', avatar: ''
          });
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed. Check if username or PIN is valid.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="mb-8">
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
              Register New Staff
          </h1>
          <p className="text-textMuted mt-1">Create accounts for cashiers, waiters, and managers.</p>
      </div>

      {message && <div className="bg-secondary/20 text-secondary p-4 rounded-lg border border-secondary/30">{message}</div>}
      {error && <div className="bg-danger/20 text-danger p-4 rounded-lg border border-danger/30">{error}</div>}

      <form onSubmit={handleSubmit} className="glass-panel p-6 md:p-8 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Username *</label>
                <input required type="text" name="username" value={formData.username} onChange={handleChange} className="glass-input w-full" placeholder="e.g. jdoe" />
            </div>
            <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Full Name *</label>
                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="glass-input w-full" placeholder="John Doe" />
            </div>

            <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Role *</label>
                <select name="role" required value={formData.role} onChange={handleChange} className="glass-input w-full appearance-none">
                    <option value="waiter">Waiter</option>
                    <option value="cashier">Cashier</option>
                    <option value="barista">Barista</option>
                    <option value="manager">Manager</option>
                    <option value="super_admin">Super Admin</option>
                </select>
            </div>
            
            <div>
                <label className="block text-sm font-medium text-textMuted mb-1">Login Password</label>
                <input type="password" name="password" minLength={8} value={formData.password} onChange={handleChange} className="glass-input w-full" placeholder="Leaves empty for default (cafe1234)" />
            </div>

            <div>
                <label className="block text-sm font-medium text-textMuted mb-1">4-6 Digit Staff PIN</label>
                <input type="text" name="pin" minLength={4} maxLength={6} pattern="\d+" value={formData.pin} onChange={(e) => handleChange({ target: { name: 'pin', value: e.target.value.replace(/\D/g, '')}} )} className="glass-input w-full tracking-widest" placeholder="e.g. 1234" />
            </div>
        </div>

        <div className="space-y-4">
            <h2 className="text-xl font-semibold border-b border-white/10 pb-2 text-primary">Avatar Profile Photo</h2>
            <div className="flex items-center space-x-6">
                <div className="w-24 h-24 rounded-full bg-surface border border-dashed border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                    {formData.avatar ? (
                        <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                        <FiUser className="w-8 h-8 text-textMuted" />
                    )}
                </div>
                <div className="flex-1">
                    <label className="btn-secondary w-full md:w-auto inline-flex cursor-pointer space-x-2 text-sm px-4 py-2">
                        <FiUploadCloud className="w-5 h-5" />
                        <span>Upload Custom Avatar Image</span>
                        <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                    </label>
                    <p className="text-xs text-textMuted mt-2">Max limit: 2MB. Square ratio recommended.</p>
                </div>
            </div>
        </div>

        <div className="pt-4 flex justify-end">
            <button type="submit" disabled={isLoading} className="btn-primary space-x-2 px-8">
                <FiSave className="w-5 h-5" />
                <span>{isLoading ? 'Registering...' : 'Register Staff Account'}</span>
            </button>
        </div>

      </form>
    </div>
  );
};

export default RegisterStaff;
