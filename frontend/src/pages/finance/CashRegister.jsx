import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FiPlay, FiSquare, FiDownload, FiDollarSign, FiClock, FiActivity, FiCheckCircle } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import { authApi } from '../../api/authApi';
import useAuthStore from '../../store/authStore';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import PageHeader from '../../components/PageHeader';

const DENOMINATIONS = [200, 100, 50, 20, 10, 5, 1];

export default function CashRegister() {
    const { user } = useAuthStore();
    const [currentShift, setCurrentShift] = useState(null);
    const [shiftSummary, setShiftSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const [cashAmount, setCashAmount] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Cash Drop Modal
    const [dropOpen, setDropOpen] = useState(false);
    const [dropAmount, setDropAmount] = useState('');
    const [dropNote, setDropNote] = useState('');

    // Discrepancy Reason for Closing
    const [closingReason, setClosingReason] = useState('');

    // Collaborative Users
    const [availableUsers, setAvailableUsers] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);

    useEffect(() => {
        fetchCurrentShift();
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const res = await authApi.getUsers();
            if (res.data) setAvailableUsers(res.data.filter(u => u.id !== user?.id && u.is_active));
        } catch (e) {
            console.error("Failed to fetch users (might be restricted).");
        }
    };

    const toggleUserSelection = (userId) => {
        setSelectedUserIds(prev => {
            if (prev.includes(userId)) return prev.filter(id => id !== userId);
            if (prev.length >= 10) {
                toast.error('Maximum 10 collaborative users allowed');
                return prev;
            }
            return [...prev, userId];
        });
    };

    const fetchCurrentShift = async () => {
        setIsLoading(true);
        try {
            const res = await financeApi.getCurrentShift();
            setCurrentShift(res.data);
            if (res.data) {
                fetchMovements(res.data.id);
                fetchSummary(res.data.id);
            }
        } catch (error) {
            if (error.response?.status !== 404) {
                toast.error("Failed to load shift data.");
            } else {
                setCurrentShift(null);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const [movements, setMovements] = useState([]);
    const fetchMovements = async (shiftId) => {
        try {
            const res = await financeApi.getCashMovements({ shift: shiftId });
            setMovements(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSummary = async (shiftId) => {
        try {
            const res = await financeApi.getShiftSummary(shiftId);
            setShiftSummary(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDenomChange = (den, val) => {
        // No longer used, but keeping for safety if referenced elsewhere temporarily
    };

    const handleOpenShift = async () => {
        const total = parseFloat(cashAmount);
        if (isNaN(total) || total < 0) return toast.error("Enter a valid opening amount (0 or more)");

        const payload = {
            branch: user?.branch || 1,
            opening_cash: total,
            assigned_users: selectedUserIds
        };

        setIsSubmitting(true);
        const tid = toast.loading("Opening shift...");
        try {
            const res = await financeApi.openShift(payload);
            toast.success(`Shift opened with ${total} EGP`, { id: tid });
            setCurrentShift(res.data);
            setCashAmount('');
            setSelectedUserIds([]);
        } catch (error) {
            toast.error(error.response?.data?.error || "Error opening shift", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseShift = async () => {
        const total = parseFloat(cashAmount) || 0;
        const tid = toast.loading("Closing shift...");
        try {
            const payload = {
                actual_closing_cash: total,
                discrepancy_reason: closingReason
            };
            const res = await financeApi.closeShift(currentShift.id, payload);
            toast.success("Shift closed successfully", { id: tid });
            setCurrentShift(null);
            setCashAmount('');
            setClosingReason('');
            
            if (res.data.discrepancy !== "0.00") {
                toast(`Discrepancy recorded: ${res.data.discrepancy} EGP`, { icon: '⚠️' });
            }
        } catch (error) {
            toast.error(error.response?.data?.error || "Error closing shift", { id: tid });
        }
    };

    const handleCashDrop = async () => {
        if (!dropAmount || parseFloat(dropAmount) <= 0) return toast.error("Enter a valid amount");
        setIsSubmitting(true);
        const tid = toast.loading("Recording cash drop...");
        try {
            await financeApi.createCashDrop({
                shift: currentShift.id,
                amount: parseFloat(dropAmount),
                note: dropNote
            });
            toast.success("Cash drop recorded", { id: tid });
            setDropOpen(false);
            setDropAmount('');
            setDropNote('');
            fetchMovements(currentShift.id);
        } catch (error) {
            toast.error("Failed to record cash drop", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatMoney = (val) => `${parseFloat(val || 0).toFixed(2)} EGP`;

    // ─────────────────────────────────────────────
    // RENDER LOGIC
    // ─────────────────────────────────────────────

    if (isLoading) return <div className="p-6">Loading...</div>;

    // Shift is OPEN -> Render Dashboard
    if (currentShift) {
        return (
            <div className="p-6 space-y-6 animate-fade-in">
                <PageHeader 
                    title="Active Cash Register" 
                    subtitle={`Shift started at ${new Date(currentShift.opened_at).toLocaleTimeString()}`}
                    icon={FiActivity}
                />

                {/* Status Bar */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="glass-panel p-5 border-l-4 border-primary">
                        <p className="text-textMuted text-sm font-medium">Opening Cash</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatMoney(currentShift.opening_cash)}</p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-green-500">
                        <p className="text-textMuted text-sm font-medium">Shift Revenue</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatMoney(shiftSummary?.total_revenue ?? 0)}</p>
                        <p className="text-xs text-textMuted mt-1">{shiftSummary?.order_count ?? 0} orders</p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-orange-500">
                        <p className="text-textMuted text-sm font-medium">Cash Drops</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {formatMoney(currentShift.total_cash_drops || movements.filter(m => m.movement_type === 'cash_drop').reduce((s, m) => s + parseFloat(m.amount), 0)*-1)}
                        </p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-yellow-500">
                        <p className="text-textMuted text-sm font-medium">Expected Cash</p>
                        <p className="text-2xl font-bold text-white mt-1">
                            {formatMoney(currentShift.live_expected_cash || 0)}
                        </p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-blue-500 flex flex-col justify-center gap-2">
                        <button onClick={() => setDropOpen(true)} className="btn w-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 flex items-center justify-center gap-2 py-2">
                            <FiDownload /> <span>Safe Drop</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Live Movement Log */}
                    <div className="lg:col-span-2 glass-panel p-6">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <FiClock className="text-primary" /> 
                            <span>Live Register Log</span>
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-textMuted uppercase bg-white/5">
                                    <tr>
                                        <th className="px-4 py-3 rounded-tl-lg">Time</th>
                                        <th className="px-4 py-3">Type</th>
                                        <th className="px-4 py-3">Amount</th>
                                        <th className="px-4 py-3">Ref</th>
                                        <th className="px-4 py-3 rounded-tr-lg">Performed By</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map((m) => (
                                        <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="px-4 py-3 text-textMuted">
                                                {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    m.movement_type === 'sale' ? 'bg-green-500/20 text-green-400' :
                                                    m.movement_type === 'refund' ? 'bg-red-500/20 text-red-400' :
                                                    m.movement_type === 'cash_drop' ? 'bg-orange-500/20 text-orange-400' :
                                                    'bg-white/10 text-white'
                                                }`}>
                                                    {m.movement_type.replace('_', ' ').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 font-mono font-bold ${parseFloat(m.amount) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {parseFloat(m.amount) > 0 ? '+' : ''}{formatMoney(m.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-xs">{m.order_number || m.description || '-'}</td>
                                            <td className="px-4 py-3">{m.performed_by_name}</td>
                                        </tr>
                                    ))}
                                    {movements.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="text-center py-6 text-textMuted">No movements yet in this shift.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Closing Form */}
                    {['super_admin', 'manager'].includes(user?.role) ? (
                    <div className="glass-panel p-6 border border-red-500/20">
                        <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
                            <FiSquare /> 
                            <span>Close Shift</span>
                        </h3>
                        <p className="text-xs text-textMuted mb-2">Count your drawer to close the shift. Any discrepancy will be recorded.</p>
                        <div className="bg-black/30 p-3 rounded-lg border border-white/5 mb-6 text-center">
                            <span className="text-[10px] uppercase tracking-wider text-textMuted block mb-1">Expected Cash</span>
                            <span className="text-xl font-mono font-bold text-white">{parseFloat(currentShift.live_expected_cash || 0).toFixed(2)} EGP</span>
                        </div>
                        
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-textMuted mb-2">Total Cash in Drawer (EGP)</label>
                            <input 
                                type="number" step="0.01"
                                value={cashAmount} 
                                onChange={(e) => setCashAmount(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-2xl font-bold text-white font-mono text-center focus:border-red-500/50 outline-none transition-colors"
                                placeholder="0.00"
                            />
                        </div>

                        <div className="mb-6">
                            <label className="block text-xs font-medium text-textMuted mb-2">Reason for discrepancy (if any)</label>
                            <textarea 
                                value={closingReason} onChange={e => setClosingReason(e.target.value)}
                                className="input w-full min-h-[60px] text-sm" placeholder="Optional notes..."
                            />
                        </div>

                        <button 
                            onClick={handleCloseShift}
                            className="bg-red-500 hover:bg-red-600 text-white font-bold w-full py-3 rounded-xl transition-colors shadow-lg shadow-red-500/20 flex justify-center items-center gap-2"
                        >
                            <FiSquare /> <span>Close Shift</span>
                        </button>
                    </div>
                    ) : (
                    <div className="glass-panel p-6 border border-white/10 flex flex-col items-center justify-center">
                        <FiSquare className="w-10 h-10 text-textMuted mb-3" />
                        <p className="text-white font-bold">Shift Closing Restricted</p>
                        <p className="text-textMuted text-sm text-center mt-1">Only a Manager or Admin can close this shift.</p>
                    </div>
                    )}
                </div>

                {/* Cash Drop Modal */}
                {dropOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden shadow-2xl">
                            <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
                                <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                    <FiDownload className="text-orange-400" /> Safe Drop
                                </h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Amount to drop (EGP)</label>
                                    <input 
                                        type="number" step="0.01" value={dropAmount} onChange={e => setDropAmount(e.target.value)}
                                        className="input w-full text-lg font-mono text-orange-400" autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Description (Optional)</label>
                                    <input 
                                        type="text" value={dropNote} onChange={e => setDropNote(e.target.value)}
                                        className="input w-full" placeholder="e.g., Mid-day pickup"
                                    />
                                </div>
                            </div>
                            <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                                <button onClick={() => setDropOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 font-medium transition-colors">Cancel</button>
                                <button onClick={handleCashDrop} disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg shadow-orange-500/20 transition-colors">Confirm Drop</button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        );
    }

    // Shift is CLOSED -> Render Opening Form
    return (
        <div className="p-6 flex justify-center items-center min-h-[calc(100vh-100px)] animate-fade-in">
            <div className="w-full max-w-lg glass-panel p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <FiDollarSign className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-black text-white">Start New Shift</h2>
                    <p className="text-textMuted mt-2">Count your drawer to set the opening cash float.</p>
                </div>

                <div className="mb-8">
                    <label className="block text-sm font-bold text-textMuted mb-2 text-center">Total Opening Cash (EGP)</label>
                    <input 
                        type="number" step="0.01"
                        value={cashAmount} 
                        onChange={(e) => setCashAmount(e.target.value)}
                        className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-4 text-3xl font-bold text-primary font-mono text-center focus:border-primary/50 outline-none transition-colors"
                        placeholder="0.00"
                    />
                </div>

                {availableUsers.length > 0 && (
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-white mb-3">Collaborative Cashiers (Max 10)</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                            {availableUsers.map(u => (
                                <label key={u.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selectedUserIds.includes(u.id) ? 'bg-primary/20 border-primary' : 'bg-black/20 border-white/5 hover:border-white/20'}`}>
                                    <input 
                                        type="checkbox" 
                                        className="checkbox checkbox-primary checkbox-sm" 
                                        checked={selectedUserIds.includes(u.id)} 
                                        onChange={() => toggleUserSelection(u.id)} 
                                    />
                                    <span className="text-sm font-medium text-white select-none truncate">{u.name} <span className="text-xs text-textMuted ml-1">({u.role})</span></span>
                                </label>
                            ))}
                        </div>
                    </div>
                )}


                <button 
                    onClick={handleOpenShift}
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] transition-all flex justify-center items-center gap-2 text-lg disabled:opacity-50"
                >
                    <FiPlay />
                    <span>Open Shift & Start Selling</span>
                </button>
            </div>
        </div>
    );
}
