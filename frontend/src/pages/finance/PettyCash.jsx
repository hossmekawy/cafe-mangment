import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { FiPlus, FiMinus, FiDollarSign, FiAlertTriangle, FiList } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import useAuthStore from '../../store/authStore';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';

export default function PettyCash() {
    const { user } = useAuthStore();
    
    const [fund, setFund] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Form Modals
    const [spendOpen, setSpendOpen] = useState(false);
    const [replenishOpen, setReplenishOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        amount: '',
        purpose: '',
        reference: ''
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Get user's branch fund (assuming 1st for now if array)
            const fundsRes = await financeApi.getPettyCashFunds();
            const currentFund = fundsRes.data[0]; 
            if (currentFund) {
                setFund(currentFund);
                const txRes = await financeApi.getPettyCashTransactions({ fund: currentFund.id });
                setTransactions(txRes.data);
            }
        } catch (error) {
            toast.error("Failed to fetch petty cash data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleTransaction = async (type) => {
        if (!formData.amount || parseFloat(formData.amount) <= 0) return toast.error("Enter a valid amount");
        if (!formData.purpose.trim()) return toast.error("Purpose is required");
        if (type === 'spend' && parseFloat(formData.amount) > parseFloat(fund.current_balance)) {
            return toast.error("Amount exceeds current balance");
        }

        setIsSubmitting(true);
        const tid = toast.loading(`${type === 'spend' ? 'Spending' : 'Replenishing'}...`);
        try {
            await financeApi.createPettyCashTransaction({
                fund: fund.id,
                transaction_type: type,
                amount: parseFloat(formData.amount),
                purpose: formData.purpose,
                reference: formData.reference
            });
            toast.success(`Transaction successful`, { id: tid });
            if (type === 'spend') setSpendOpen(false);
            else setReplenishOpen(false);
            setFormData({ amount: '', purpose: '', reference: '' });
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Transaction failed", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Date & Time',
            accessorFn: row => new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        },
        {
            header: 'Type',
            accessorKey: 'transaction_type',
            cell: info => {
                const type = info.getValue();
                return <span className={`px-2 py-1 rounded text-xs font-bold ${
                    type === 'replenish' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>
                    {type.toUpperCase()}
                </span>;
            }
        },
        {
            header: 'Amount',
            accessorKey: 'amount',
            cell: info => {
                const type = info.row.original.transaction_type;
                const val = parseFloat(info.getValue());
                return <span className={`font-mono font-bold ${type === 'replenish' ? 'text-green-400' : 'text-orange-400'}`}>
                    {type === 'replenish' ? '+' : '-'}{val.toFixed(2)}
                </span>;
            }
        },
        { header: 'Purpose', accessorKey: 'purpose', cell: info => <span className="text-sm">{info.getValue()}</span> },
        { header: 'Reference', accessorFn: row => row.reference || '-', cell: info => <span className="font-mono text-xs text-textMuted">{info.getValue()}</span> },
        {
            header: 'Balance After',
            accessorKey: 'running_balance',
            cell: info => <span className="font-mono text-white">{parseFloat(info.getValue()).toFixed(2)}</span>
        },
        { header: 'Performed By', accessorFn: row => row.performed_by_name || '-' }
    ], []);

    const formatMoney = (val) => `${parseFloat(val || 0).toFixed(2)} EGP`;

    if (isLoading) return <div className="p-6">Loading...</div>;

    if (!fund) {
        return (
            <div className="p-6">
                <div className="glass-panel p-8 text-center bg-red-500/10 border-red-500/20">
                    <FiAlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-xl font-bold text-white mb-2">No Petty Cash Fund Found</h2>
                    <p className="text-textMuted">Please ask an administrator to set up a petty cash fund for this branch.</p>
                </div>
            </div>
        );
    }

    const pct = fund.float_amount > 0 ? (fund.current_balance / fund.float_amount) * 100 : 0;
    const isLow = pct < 20;

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader 
                title="Petty Cash Management" 
                subtitle={`Branch: ${fund.branch_name}`}
                icon={FiDollarSign}
            />

            {/* Fund Dashboard */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`col-span-1 glass-panel p-6 ${isLow ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)] bg-red-500/5' : ''}`}>
                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <h3 className="text-textMuted text-sm font-medium uppercase tracking-wider mb-1">Current Balance</h3>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-5xl font-black font-mono tracking-tighter ${isLow ? 'text-red-400' : 'text-white'}`}>
                                    {formatMoney(fund.current_balance)}
                                </span>
                            </div>
                        </div>
                        {isLow && <FiAlertTriangle className="text-red-500 w-8 h-8 animate-pulse" />}
                    </div>

                    <div className="space-y-2 mb-6 text-sm">
                        <div className="flex justify-between mt-4">
                            <span className="text-textMuted">Authorised Float</span>
                            <span className="font-mono text-white">{formatMoney(fund.float_amount)}</span>
                        </div>
                        <div className="w-full bg-black/40 rounded-full h-2">
                            <div 
                                className={`h-2 rounded-full ${isLow ? 'bg-red-500' : 'bg-primary'}`}
                                style={{ width: `${Math.min(100, pct)}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-6">
                        <button 
                            onClick={() => setSpendOpen(true)}
                            className="bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-400 font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                        >
                            <FiMinus /> Spend
                        </button>
                        <button 
                            onClick={() => setReplenishOpen(true)}
                            className="bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 font-bold py-3 rounded-xl transition-all flex justify-center items-center gap-2"
                        >
                            <FiPlus /> Replenish
                        </button>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 glass-panel p-6">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <FiList className="text-primary" /> 
                        <span>Transaction Ledger</span>
                    </h3>
                    <div className="overflow-x-auto h-[300px] scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-2">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-textMuted uppercase bg-black/20 sticky top-0 z-10 backdrop-blur-md">
                                <tr>
                                    <th className="px-4 py-3 rounded-tl-lg">Date</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3">Purpose</th>
                                    <th className="px-4 py-3">Ref</th>
                                    <th className="px-4 py-3 rounded-tr-lg text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((tx) => {
                                    const isReplenish = tx.transaction_type === 'replenish';
                                    return (
                                        <tr key={tx.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-4 py-3 text-textMuted">
                                                {new Date(tx.created_at).toLocaleDateString()} <span className="text-[10px]">{new Date(tx.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                                                    isReplenish ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'
                                                }`}>
                                                    {tx.transaction_type}
                                                </span>
                                            </td>
                                            <td className={`px-4 py-3 font-mono font-bold ${isReplenish ? 'text-green-400' : 'text-orange-400'}`}>
                                                {isReplenish ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}
                                            </td>
                                            <td className="px-4 py-3 text-xs max-w-[150px] truncate" title={tx.purpose}>{tx.purpose}</td>
                                            <td className="px-4 py-3 text-xs font-mono text-textMuted">{tx.reference || '-'}</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-white">{parseFloat(tx.running_balance).toFixed(2)}</td>
                                        </tr>
                                    );
                                })}
                                {transactions.length === 0 && (
                                    <tr><td colSpan="6" className="text-center py-8 text-textMuted">No transactions recorded yet.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* SPEND MODAL */}
            {spendOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={(e) => { e.preventDefault(); handleTransaction('spend'); }} className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-orange-500/30 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex items-center gap-2 bg-[#0f172a]">
                            <FiMinus className="text-orange-400 text-xl" />
                            <h3 className="font-bold text-white text-lg">Spend Petty Cash</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Amount (EGP) *</label>
                                <input required type="number" step="0.01" max={fund.current_balance} autoFocus
                                    className="input w-full font-mono text-orange-400 text-lg" 
                                    value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})}
                                />
                                <p className="text-xs text-textMuted mt-1 text-right">Max: {fund.current_balance} EGP</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Purpose *</label>
                                <input required type="text" className="input w-full" placeholder="e.g. Minor repairs, ice"
                                    value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Receipt Ref # (Optional)</label>
                                <input type="text" className="input w-full font-mono text-sm" placeholder="e.g. RCP-12345"
                                    value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => setSpendOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-lg shadow-orange-500/20">Record Spend</button>
                        </div>
                    </form>
                </div>
            )}

            {/* REPLENISH MODAL */}
            {replenishOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={(e) => { e.preventDefault(); handleTransaction('replenish'); }} className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-green-500/30 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex items-center gap-2 bg-[#0f172a]">
                            <FiPlus className="text-green-400 text-xl" />
                            <h3 className="font-bold text-white text-lg">Replenish Fund</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Amount (EGP) *</label>
                                <input required type="number" step="0.01" autoFocus
                                    className="input w-full font-mono text-green-400 text-lg" 
                                    defaultValue={Math.max(0, parseFloat(fund.float_amount) - parseFloat(fund.current_balance))}
                                    onChange={e => setFormData({...formData, amount: e.target.value})}
                                />
                                <p className="text-xs text-textMuted mt-1 text-right">Suggested: {Math.max(0, parseFloat(fund.float_amount) - parseFloat(fund.current_balance)).toFixed(2)} EGP</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Source / Purpose *</label>
                                <input required type="text" className="input w-full" placeholder="e.g. Bank withdrawal"
                                    value={formData.purpose} onChange={e => setFormData({...formData, purpose: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Bank Ref # (Optional)</label>
                                <input type="text" className="input w-full font-mono text-sm" placeholder="e.g. TR-998877"
                                    value={formData.reference} onChange={e => setFormData({...formData, reference: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => setReplenishOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white font-bold transition-colors shadow-lg shadow-green-500/20">Add Funds</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
