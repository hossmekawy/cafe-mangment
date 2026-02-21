import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { FiUsers, FiPlus, FiEdit2, FiTrash2, FiActivity, FiShield } from 'react-icons/fi';
import { authApi } from '../../api/authApi';
import { settingsApi } from '../../api/settingsApi';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import ConfirmModal from '../../components/ConfirmModal';

export default function UserManagement() {
    const [users, setUsers] = useState([]);
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isLogsOpen, setIsLogsOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        name: '',
        role: 'cashier',
        branch: '',
        password: '',
        pin: '',
        is_active: true
    });

    // Logs state
    const [selectedUserLogs, setSelectedUserLogs] = useState([]);
    const [selectedUserSessions, setSelectedUserSessions] = useState([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [activeUserForLogs, setActiveUserForLogs] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [usersRes, branchesRes] = await Promise.all([
                authApi.getUsers(),
                authApi.getBranches() 
            ]);
            setUsers(usersRes.data);
            setBranches(branchesRes.data || []); 
        } catch (error) {
            toast.error("Failed to fetch users");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchLogs = async (userId, userName) => {
        setLogsLoading(true);
        setActiveUserForLogs(userName);
        setIsLogsOpen(true);
        try {
            const [logsRes, sessionsRes] = await Promise.all([
                authApi.getUserLogs(userId),
                authApi.getUserSessions(userId)
            ]);
            setSelectedUserLogs(logsRes.data);
            setSelectedUserSessions(sessionsRes.data);
        } catch (error) {
            toast.error("Failed to load user logs");
        } finally {
            setLogsLoading(false);
        }
    };

    const handleOpenForm = (user = null) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                username: user.username,
                name: user.name,
                role: user.role,
                branch: user.branch || '',
                password: '', // blank unless changing
                pin: user.pin ? '####' : '', // mask pin
                is_active: user.is_active
            });
        } else {
            setEditingUser(null);
            setFormData({
                username: '',
                name: '',
                role: 'cashier',
                branch: '',
                password: '',
                pin: '',
                is_active: true
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const tid = toast.loading(editingUser ? "Updating user..." : "Creating user...");
        
        try {
            const payload = { ...formData };
            if (!payload.password) delete payload.password;
            if (payload.pin === '####') delete payload.pin;
            if (!payload.branch) payload.branch = null;

            if (editingUser) {
                await authApi.updateUser(editingUser.id, payload);
                toast.success("User updated successfully", { id: tid });
            } else {
                await authApi.createUser(payload);
                toast.success("User created successfully", { id: tid });
            }
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            const errMsg = error.response?.data?.detail || error.response?.data?.error || "Error saving user";
            toast.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const tid = toast.loading("Deleting user...");
        try {
            await authApi.deleteUser(deleteId);
            toast.success("User deleted", { id: tid });
            setDeleteId(null);
            fetchData();
        } catch (error) {
            toast.error("Delete failed", { id: tid });
        }
    };

    const columns = useMemo(() => [
        { header: 'Name', accessorKey: 'name', cell: info => <span className="font-bold text-white">{info.getValue()}</span> },
        { header: 'Username', accessorKey: 'username', cell: info => <span className="text-sm font-mono tracking-wider">{info.getValue()}</span> },
        { 
            header: 'Role', 
            accessorKey: 'role',
            cell: info => {
                const val = info.getValue() || '';
                const roleColors = {
                    super_admin: 'bg-red-500/20 text-red-400',
                    manager: 'bg-orange-500/20 text-orange-400',
                    cashier: 'bg-blue-500/20 text-blue-400',
                };
                return <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${roleColors[val] || 'bg-white/10 text-white'}`}>
                    {val.replace('_', ' ')}
                </span>
            }
        },
        { 
            header: 'Status', 
            accessorKey: 'is_active',
            cell: info => info.getValue() 
                ? <span className="text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded">ACTIVE</span>
                : <span className="text-textMuted text-xs font-bold bg-white/5 px-2 py-1 rounded">INACTIVE</span>
        },
        { header: 'Created', accessorFn: row => new Date(row.created_at).toLocaleDateString() },
        {
            id: 'actions',
            header: '',
            cell: info => {
                const row = info.row.original;
                return (
                    <div className="flex gap-2 justify-end">
                        <button onClick={() => fetchLogs(row.id, row.name)} className="text-blue-400 hover:text-blue-300 p-1.5 bg-blue-400/10 rounded" title="View Trace Logs">
                            <FiActivity />
                        </button>
                        <button onClick={() => handleOpenForm(row)} className="text-orange-400 hover:text-orange-300 p-1.5 bg-orange-400/10 rounded">
                            <FiEdit2 />
                        </button>
                        <button onClick={() => setDeleteId(row.id)} className="text-red-400 hover:text-red-300 p-1.5 bg-red-400/10 rounded">
                            <FiTrash2 />
                        </button>
                    </div>
                );
            }
        }
    ], []);

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader 
                title="User Management" 
                subtitle="Manage roles, assignments, passwords, and view system login sessions."
                icon={FiUsers}
                action={{
                    label: 'Add New User',
                    icon: FiPlus,
                    onClick: () => handleOpenForm()
                }}
            />

            <DataTable 
                columns={columns} 
                data={users} 
                isLoading={isLoading} 
                searchPlaceholder="Search usernames or names..."
            />

            {/* FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="bg-[#1e293b] rounded-2xl w-full max-w-lg border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <FiShield className="text-primary"/> {editingUser ? 'Edit User' : 'Create User'}
                            </h3>
                            <button type="button" onClick={() => setIsFormOpen(false)} className="text-textMuted hover:text-white">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Full Name *</label>
                                    <input required type="text" className="input w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Username *</label>
                                    <input required type="text" className="input w-full" value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} disabled={editingUser} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Role *</label>
                                    <select required className="input w-full cursor-pointer" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}>
                                        <option value="super_admin">Super Admin</option>
                                        <option value="manager">Manager</option>
                                        <option value="cashier">Cashier</option>
                                        <option value="waiter">Waiter</option>
                                        <option value="barista">Barista</option>
                                        <option value="chef">Chef</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Assigned Branch (Optional)</label>
                                    <select className="input w-full cursor-pointer" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                                        <option value="">-- No Branch Assigned --</option>
                                        {branches.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">{editingUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
                                    <input required={!editingUser} type="password" minLength={8} className="input w-full" placeholder="Min 8 characters" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Quick Login PIN (Optional)</label>
                                    <input type="password" minLength={4} maxLength={6} className="input w-full tracking-[0.3em] font-mono" placeholder="4-6 digits" value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-black/30 transition-colors">
                                    <input type="checkbox" className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary accent-primary" 
                                        checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                                    />
                                    <div>
                                        <span className="text-white font-medium block">Account Active</span>
                                        <span className="text-xs text-textMuted">If unchecked, the user will be unable to log in.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors shadow-lg shadow-primary/20">
                                {editingUser ? 'Save Changes' : 'Create User'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* LOGS MODAL */}
            {isLogsOpen && (
                <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-all duration-300">
                    <div className="bg-[#0f172a] w-full max-w-md h-full shadow-[-20px_0_50px_rgba(0,0,0,0.5)] border-l border-white/10 flex flex-col animate-[slideIn_0.3s_ease-out]">
                        <div className="p-6 border-b border-white/10 shrink-0 flex justify-between items-start">
                            <div>
                                <h3 className="font-bold text-white text-lg">{activeUserForLogs}</h3>
                                <p className="text-sm text-textMuted">Security & Session Logs</p>
                            </div>
                            <button onClick={() => setIsLogsOpen(false)} className="text-textMuted hover:text-white bg-white/5 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-8">
                            {logsLoading ? (
                                <div className="animate-pulse space-y-4 pt-10 px-4">
                                    {[1,2,3].map(i => <div key={i} className="h-20 bg-white/5 rounded-xl"></div>)}
                                </div>
                            ) : (
                                <>
                                    {/* Active Sessions */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-textMuted mb-3 px-2">Active Sessions</h4>
                                        {selectedUserSessions.length === 0 ? (
                                            <p className="text-sm text-textMuted italic px-2">No active sessions.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {selectedUserSessions.map(sess => (
                                                    <div key={sess.id} className="bg-white/5 p-3 rounded-lg border border-white/5">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <span className="text-xs font-mono font-bold text-green-400">ONLINE</span>
                                                            <span className="text-[10px] text-textMuted">{new Date(sess.last_used_at).toLocaleDateString()}</span>
                                                        </div>
                                                        <p className="text-xs text-white max-w-[250px] truncate" title={sess.device_info}>{sess.device_info}</p>
                                                        <p className="text-[10px] font-mono text-textMuted mt-1">IP: {sess.ip_address || 'Unknown'}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* Audit Logs */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-widest text-textMuted mb-3 px-2">Audit History</h4>
                                        {selectedUserLogs.length === 0 ? (
                                            <p className="text-sm text-textMuted italic px-2">No logs found.</p>
                                        ) : (
                                            <div className="relative border-l border-white/10 ml-4 space-y-4">
                                                {selectedUserLogs.map(log => {
                                                    const isFail = log.action === 'FAILED_LOGIN';
                                                    return (
                                                        <div key={log.id} className="relative pl-6">
                                                            <div className={`absolute -left-[5px] top-1.5 w-2 h-2 rounded-full ${isFail ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-primary'}`}></div>
                                                            <div className="bg-white/5 px-3 py-2 rounded border border-white/5">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <span className={`text-[10px] font-bold uppercase ${isFail ? 'text-red-400' : 'text-blue-400'}`}>{log.action.replace('_', ' ')}</span>
                                                                    <span className="text-[10px] text-textMuted">{new Date(log.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                                                </div>
                                                                <p className="text-[10px] font-mono text-textMuted break-all">{log.device_info && log.device_info.split(' ')[0]}</p>
                                                                <p className="text-[10px] text-textMuted">{new Date(log.timestamp).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete User"
                message="Are you sure you want to delete this user? Their sales transactions and activity will remain linked to their ID for historical purposes, but they will be permanently unable to log in."
                confirmText="Delete"
                confirmColor="bg-red-500 hover:bg-red-600"
            />
        </div>
    );
}
