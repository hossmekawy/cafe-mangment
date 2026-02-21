import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { FiSearch, FiFilter, FiDownload, FiXCircle, FiRefreshCw, FiDollarSign } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import useAuthStore from '../../store/authStore';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import PageHeader from '../../components/PageHeader';

export default function SalesJournal() {
    const { user } = useAuthStore();
    const canVoidRefund = ['super_admin', 'manager'].includes(user?.role);
    
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // Filters
    const [filters, setFilters] = useState({
        search: '',
        transaction_type: '',
        date_from: '',
        date_to: ''
    });

    // Modals
    const [voidItem, setVoidItem] = useState(null);
    const [voidReason, setVoidReason] = useState('');
    
    const [refundItem, setRefundItem] = useState(null);
    const [refundAmount, setRefundAmount] = useState('');
    const [refundReason, setRefundReason] = useState('');

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [txRes, sumRes] = await Promise.all([
                financeApi.getTransactions(filters),
                financeApi.getTransactionSummary()
            ]);
            setTransactions(txRes.data);
            setSummary(sumRes.data);
        } catch (error) {
            toast.error("Failed to fetch journal data");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVoid = async () => {
        if (!voidReason.trim()) return toast.error("Void reason is required.");
        const tid = toast.loading("Processing void...");
        try {
            await financeApi.voidTransaction(voidItem.id, { reason: voidReason });
            toast.success("Transaction voided successfully", { id: tid });
            setVoidItem(null);
            setVoidReason('');
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || "Failed to void transaction", { id: tid });
        }
    };

    const handleRefund = async () => {
        if (!refundAmount || parseFloat(refundAmount) <= 0) return toast.error("Enter a valid refund amount");
        if (!refundReason.trim()) return toast.error("Refund reason is required.");
        
        const tid = toast.loading("Processing refund...");
        try {
            await financeApi.createRefund({
                original_transaction: refundItem.id,
                amount: parseFloat(refundAmount),
                reason: refundReason
            });
            toast.success("Refund processed successfully", { id: tid });
            setRefundItem(null);
            setRefundAmount('');
            setRefundReason('');
            fetchData();
        } catch (error) {
            // Check if validation error (e.g. exceeds original amount)
            const errDetail = error.response?.data?.non_field_errors?.[0] || error.response?.data?.detail || "Failed to process refund";
            toast.error(errDetail, { id: tid });
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Time',
            accessorFn: row => new Date(row.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
        },
        {
            header: 'Transaction #',
            accessorKey: 'transaction_number',
            cell: info => <span className="font-mono text-xs text-textMuted">{info.getValue()}</span>
        },
        {
            header: 'Type',
            accessorKey: 'transaction_type',
            cell: info => {
                const type = info.getValue();
                const isVoided = info.row.original.is_voided;
                if (isVoided) return <span className="px-2 py-1 rounded text-xs font-bold bg-red-500/20 text-red-400 line-through -ml-2">VOIDED</span>;
                
                return <span className={`px-2 py-1 rounded text-xs font-bold ${
                    type === 'sale' ? 'bg-green-500/20 text-green-400' :
                    type === 'refund' ? 'bg-orange-500/20 text-orange-400' :
                    'bg-red-500/20 text-red-400'
                }`}>
                    {type.toUpperCase()}
                </span>;
            }
        },
        {
            header: 'Order Ref',
            accessorFn: row => row.order_number || '-',
            cell: info => <span className="font-mono text-xs">{info.getValue()}</span>
        },
        {
            header: 'Amount',
            accessorKey: 'net_amount',
            cell: info => {
                const val = parseFloat(info.getValue());
                return <span className={`font-mono font-bold ${val > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {val > 0 ? '+' : ''}{val.toFixed(2)}
                </span>;
            }
        },
        {
            header: 'Payment Method',
            accessorFn: row => row.payment_method ? row.payment_method.replace('_', ' ').toUpperCase() : '-',
            cell: info => <span className="text-xs">{info.getValue()}</span>
        },
        {
            header: 'Cashier',
            accessorFn: row => row.cashier_name || '-'
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: info => {
                const row = info.row.original;
                if (!canVoidRefund) return null;
                if (row.transaction_type !== 'sale' || row.is_voided) return null;

                return (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setRefundItem(row)}
                            className="p-1.5 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 rounded transition-colors"
                            title="Issue Refund"
                        >
                            <FiRefreshCw className="w-4 h-4" />
                        </button>
                        <button 
                            onClick={() => setVoidItem(row)}
                            className="p-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded transition-colors"
                            title="Void Transaction"
                        >
                            <FiXCircle className="w-4 h-4" />
                        </button>
                    </div>
                );
            }
        }
    ], [canVoidRefund]);

    const formatMoney = (val) => `${parseFloat(val || 0).toFixed(2)} EGP`;

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader 
                title="Sales Journal" 
                subtitle="Complete log of all financial transactions, refunds, and voids."
                icon={FiDollarSign}
            />

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-panel p-5 border-l-4 border-green-500">
                        <p className="text-textMuted text-sm font-medium">Gross Sales</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatMoney(summary.total_sales)}</p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-orange-500">
                        <p className="text-textMuted text-sm font-medium">Total Refunds</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatMoney(summary.total_refunds)}</p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-red-500">
                        <p className="text-textMuted text-sm font-medium">Total Voids</p>
                        <p className="text-2xl font-bold text-white mt-1">{formatMoney(summary.total_voids)}</p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-primary bg-primary/5">
                        <p className="text-primary text-sm font-bold tracking-wide">NET REVENUE</p>
                        <p className="text-3xl font-black text-white mt-1">{formatMoney(summary.net_revenue)}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="glass-panel p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs text-textMuted mb-1">Search Ref #</label>
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" />
                        <input 
                            type="text" 
                            className="input w-full pl-9" 
                            placeholder="TXN-... or ORD-..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                        />
                    </div>
                </div>
                <div className="w-40">
                    <label className="block text-xs text-textMuted mb-1">Type</label>
                    <select 
                        className="input w-full text-sm"
                        value={filters.transaction_type}
                        onChange={(e) => setFilters(prev => ({ ...prev, transaction_type: e.target.value }))}
                    >
                        <option value="">All Types</option>
                        <option value="sale">Sale</option>
                        <option value="refund">Refund</option>
                        <option value="void">Void</option>
                    </select>
                </div>
                <div className="w-40">
                    <label className="block text-xs text-textMuted mb-1">Date From</label>
                    <input 
                        type="date" className="input w-full text-sm"
                        value={filters.date_from} onChange={(e) => setFilters(prev => ({ ...prev, date_from: e.target.value }))}
                    />
                </div>
                <div className="w-40">
                    <label className="block text-xs text-textMuted mb-1">Date To</label>
                    <input 
                        type="date" className="input w-full text-sm"
                        value={filters.date_to} onChange={(e) => setFilters(prev => ({ ...prev, date_to: e.target.value }))}
                    />
                </div>
                <button 
                    onClick={() => setFilters({ search: '', transaction_type: '', date_from: '', date_to: '' })}
                    className="btn bg-white/5 hover:bg-white/10 text-white flex gap-2 items-center"
                >
                    <FiFilter /> Clear
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={transactions} 
                isLoading={isLoading}
                hideSearch={true}
            />

            {/* VOID MODAL */}
            {voidItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-red-500/30 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex items-center gap-2 bg-[#0f172a]">
                            <FiXCircle className="text-red-400 text-xl" />
                            <h3 className="font-bold text-white text-lg">Void Transaction</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm border border-red-500/20">
                                You are about to void transaction <strong>{voidItem.transaction_number}</strong> for {formatMoney(voidItem.net_amount)}. This will reverse the revenue.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Reason for Void *</label>
                                <textarea 
                                    className="input w-full min-h-[80px]" placeholder="Required for audit logs..."
                                    value={voidReason} onChange={e => setVoidReason(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button onClick={() => setVoidItem(null)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={handleVoid} className="px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-bold transition-colors shadow-lg shadow-red-500/20">Confirm Void</button>
                        </div>
                    </div>
                </div>
            )}

            {/* REFUND MODAL */}
            {refundItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-orange-500/30 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex items-center gap-2 bg-[#0f172a]">
                            <FiRefreshCw className="text-orange-400 text-xl" />
                            <h3 className="font-bold text-white text-lg">Issue Refund</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-orange-500/10 text-orange-400 p-3 rounded-lg text-sm border border-orange-500/20">
                                Max available refund: <strong>{formatMoney(refundItem.net_amount)}</strong>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Refund Amount (EGP)</label>
                                <input 
                                    type="number" step="0.01" max={parseFloat(refundItem.net_amount)}
                                    className="input w-full font-mono text-orange-400 text-lg" 
                                    value={refundAmount} onChange={e => setRefundAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Reason for Refund *</label>
                                <input 
                                    type="text" className="input w-full" placeholder="e.g. Customer complaint"
                                    value={refundReason} onChange={e => setRefundReason(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button onClick={() => setRefundItem(null)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={handleRefund} className="px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors shadow-lg shadow-orange-500/20">Process Refund</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
