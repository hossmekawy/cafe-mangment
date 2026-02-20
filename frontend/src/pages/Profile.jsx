import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import axiosInstance from '../api/axiosInstance';
import { FiSave, FiUser, FiUploadCloud } from 'react-icons/fi';

const Profile = () => {
    const { user, fetchUser } = useAuthStore();
    const [formData, setFormData] = useState({
        name: '',
        avatar: '',
    });
    const [passwords, setPasswords] = useState({
        old_password: '',
        new_password: '',
        confirm_password: ''
    });
    
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                avatar: user.avatar || '',
            });
        }
    }, [user]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePasswordChange = (e) => {
        const { name, value } = e.target;
        setPasswords(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
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

    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setMessage('');
        setError('');

        try {
            const res = await axiosInstance.patch('/auth/me/', formData);
            if (res.data.success) {
                setMessage('Profile updated successfully!');
                fetchUser(); // Refresh global user state
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update profile.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        setMessage('');
        setError('');

        if (passwords.new_password !== passwords.confirm_password) {
            setError("New passwords do not match!");
            return;
        }

        setIsLoading(true);
        try {
            const res = await axiosInstance.patch('/auth/password/change/', {
                old_password: passwords.old_password,
                new_password: passwords.new_password
            });
            if (res.data.success) {
                setMessage('Password updated successfully!');
                setPasswords({ old_password: '', new_password: '', confirm_password: '' });
            }
        } catch (err) {
            setError(err.response?.data?.detail || "Failed to update password.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    My Profile
                </h1>
                <p className="text-textMuted mt-1">Manage your account details and security.</p>
            </div>

            {message && <div className="bg-secondary/20 text-secondary p-4 rounded-lg border border-secondary/30">{message}</div>}
            {error && <div className="bg-danger/20 text-danger p-4 rounded-lg border border-danger/30">{error}</div>}

            {/* Profile Info Form */}
            <form onSubmit={handleUpdateProfile} className="glass-panel p-6 md:p-8 space-y-8">
                <h2 className="text-xl font-semibold border-b border-white/10 pb-2 text-primary">Personal Details</h2>

                <div className="flex items-center space-x-6 mb-6">
                    <div className="w-24 h-24 rounded-full bg-surface border border-dashed border-slate-600 flex items-center justify-center overflow-hidden shrink-0">
                        {formData.avatar ? (
                            <img src={formData.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <FiUser className="w-8 h-8 text-textMuted" />
                        )}
                    </div>
                    <div className="flex-1">
                        <label className="btn-secondary w-full md:w-auto inline-flex cursor-pointer space-x-2 text-sm px-4 py-2">
                            <FiUploadCloud className="w-5 h-5" />
                            <span>Upload Avatar</span>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                        <p className="text-xs text-textMuted mt-2">Square ratio recommended (Max 2MB).</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Username (Read Only)</label>
                        <input type="text" value={user?.username || ''} disabled className="glass-input w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Role</label>
                        <input type="text" value={user?.role?.replace('_', ' ').toUpperCase() || ''} disabled className="glass-input w-full opacity-50 cursor-not-allowed" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-textMuted mb-1">Full Name</label>
                        <input type="text" name="name" value={formData.name} onChange={handleChange} className="glass-input w-full" placeholder="Your name" />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={isLoading} className="btn-primary space-x-2">
                        <FiSave className="w-5 h-5" />
                        <span>Update Profile</span>
                    </button>
                </div>
            </form>

            {/* Security Form */}
            <form onSubmit={handleUpdatePassword} className="glass-panel p-6 md:p-8 space-y-8">
                <h2 className="text-xl font-semibold border-b border-white/10 pb-2 text-danger">Security</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Current Password</label>
                        <input type="password" required name="old_password" value={passwords.old_password} onChange={handlePasswordChange} className="glass-input w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">New Password</label>
                        <input type="password" required minLength={8} name="new_password" value={passwords.new_password} onChange={handlePasswordChange} className="glass-input w-full" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-textMuted mb-1">Confirm New Password</label>
                        <input type="password" required minLength={8} name="confirm_password" value={passwords.confirm_password} onChange={handlePasswordChange} className="glass-input w-full" />
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" disabled={isLoading} className="bg-danger hover:bg-red-600 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center space-x-2">
                        <FiSave className="w-5 h-5" />
                        <span>Change Password</span>
                    </button>
                </div>
            </form>

        </div>
    );
};

export default Profile;
