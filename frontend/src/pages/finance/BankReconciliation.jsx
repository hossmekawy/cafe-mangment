import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { FiUpload, FiCheck, FiX, FiCheckCircle, FiFileText, FiRefreshCw } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import useAuthStore from '../../store/authStore';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';

export default function BankReconciliation() {
    const { user } = useAuthStore();
    const canReconcile = ['super_admin', 'manager'].includes(user?.role);

    const [accounts, setAccounts] = useState([]);
    const [reconciliations, setReconciliations] = useState([]);
    const [activeAccount, setActiveAccount] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    // New Recon Form
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        bank_account: '',
        period_start: '',
        period_end: ''
    });

    // Active Recon View
    const [activeRecon, setActiveRecon] = useState(null);
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        setIsLoading(true);
        try {
            const accRes = await financeApi.getBankAccounts();
            setAccounts(accRes.data);
            if (accRes.data.length > 0) {
                setActiveAccount(accRes.data[0].id);
                fetchReconciliations(accRes.data[0].id);
            } else {
                setIsLoading(false);
            }
        } catch (error) {
            toast.error("Failed to fetch bank accounts");
            setIsLoading(false);
        }
    };

    const fetchReconciliations = async (accountId) => {
        setIsLoading(true);
        try {
            const res = await financeApi.getReconciliations({ bank_account: accountId });
            setReconciliations(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchSingleRecon = async (id) => {
        const tid = toast.loading("Loading reconciliation details...");
        try {
            // Note: Our ViewSet doesn't have a single retrieve endpoint specified in financeApi yet, 
            // but DRF ModelViewSet provides it by default at /api/finance/bank-reconciliations/{id}/.
            // Let's just filter it from the list or make an explicit call if we add it.
            // For now, let's assume the nested items come with the list response.
            const recon = reconciliations.find(r => r.id === id);
            if (recon) setActiveRecon(recon);
            toast.dismiss(tid);
        } catch (error) {
            toast.error("Error loading details", { id: tid });
        }
    };

    const handleAccountChange = (e) => {
        const accId = e.target.value;
        setActiveAccount(accId);
        setActiveRecon(null);
        fetchReconciliations(accId);
    };

    const handleStartRecon = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const tid = toast.loading("Starting reconciliation...");
        try {
            const res = await financeApi.createReconciliation(formData);
            toast.success("Period started", { id: tid });
            setIsFormOpen(false);
            setFormData({ bank_account: '', period_start: '', period_end: '' });
            fetchReconciliations(activeAccount);
            setActiveRecon(res.data);
        } catch (error) {
            toast.error("Failed to start recon", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    // CSV Parse Mock implementation (In a real app, use PapaParse)
    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !activeRecon) return;

        // Dummy text parser replacing PapaParse for demo
        const reader = new FileReader();
        reader.onload = async (event) => {
            const text = event.target.result;
            const lines = text.split('\n').filter(line => line.trim() !== '');
            // Assume CSV: Date,Description,Amount
            const items = lines.slice(1).map(line => {
                const [date, desc, amt] = line.split(',');
                return { date: date?.trim(), description: desc?.trim(), amount: parseFloat(amt?.trim()) };
            }).filter(i => i.date && !isNaN(i.amount));

            const tid = toast.loading("Importing bank statement...");
            try {
                await financeApi.importReconciliationCSV(activeRecon.id, { items });
                toast.success(`Imported ${items.length} records`, { id: tid });
                // We'd ideally re-fetch the single recon to get updated items
                fetchReconciliations(activeAccount); // Quick refresh hack
                setActiveRecon(null); // Force close to refresh view
            } catch (error) {
                toast.error("Failed to import CSV", { id: tid });
            }
        };
        reader.readAsText(file);
    };

    const handleMatch = async (systemId, bankId) => {
        const tid = toast.loading("Matching items...");
        try {
            await financeApi.matchReconciliationItem(activeRecon.id, {
                system_item: systemId,
                bank_item: bankId
            });
            toast.success("Items matched", { id: tid });
            fetchReconciliations(activeAccount);
            setActiveRecon(null); // Force refresh
        } catch (error) {
            toast.error("Match failed", { id: tid });
        }
    };

    const handleComplete = async () => {
        const tid = toast.loading("Completing reconciliation...");
        try {
            await financeApi.completeReconciliation(activeRecon.id);
            toast.success("Reconciliation locked", { id: tid });
            fetchReconciliations(activeAccount);
            setActiveRecon(null);
        } catch (error) {
            toast.error("Failed to complete", { id: tid });
        }
    };

    const columns = useMemo(() => [
        { header: 'Period Start', accessorKey: 'period_start' },
        { header: 'Period End', accessorKey: 'period_end' },
        { 
            header: 'Status', 
            accessorKey: 'status',
            cell: info => {
                const s = info.getValue();
                return <span className={`px-2 py-1 rounded text-xs font-bold ${
                    s === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'
                }`}>{s.replace('_', ' ').toUpperCase()}</span>;
            }
        },
        { header: 'System Bal', accessorKey: 'system_balance', cell: info => parseFloat(info.getValue()).toFixed(2) },
        { header: 'Bank Bal', accessorKey: 'bank_balance', cell: info => parseFloat(info.getValue()).toFixed(2) },
        { 
            header: 'Difference', 
            accessorKey: 'difference', 
            cell: info => {
                const diff = parseFloat(info.getValue());
                if (diff === 0) return <span className="text-green-400">0.00</span>;
                return <span className="text-red-400 font-bold">{diff.toFixed(2)}</span>;
            } 
        },
        {
            id: 'actions',
            header: 'Actions',
            cell: info => {
                return (
                    <button 
                        onClick={() => fetchSingleRecon(info.row.original.id)}
                        className="btn bg-white/5 hover:bg-white/10 py-1 px-3 text-xs"
                    >
                        View / Edit
                    </button>
                );
            }
        }
    ], [reconciliations]);

    if (isLoading) return <div className="p-6">Loading accounts...</div>;

    return (
        <div className="p-6 space-y-6 animate-fade-in relative h-[calc(100vh-100px)] flex flex-col">
            <PageHeader 
                title="Bank Reconciliation" 
                subtitle="Match system transactions with bank statements to ensure accuracy."
                icon={FiCheckCircle}
            />

            {/* Account Selector & New Recon Button */}
            <div className="flex justify-between items-center glass-panel p-4">
                <div className="flex items-center gap-4">
                    <label className="text-sm text-textMuted font-medium">Select Account:</label>
                    <select 
                        className="input min-w-[250px] bg-black/40"
                        value={activeAccount}
                        onChange={handleAccountChange}
                    >
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>{acc.name} - {acc.bank_name}</option>
                        ))}
                    </select>
                </div>
                {canReconcile && !activeRecon && (
                    <button onClick={() => { setFormData({...formData, bank_account: activeAccount}); setIsFormOpen(true); }} className="btn btn-primary flex items-center gap-2">
                        <FiCheckCircle /> Start New Period
                    </button>
                )}
                {activeRecon && (
                    <button onClick={() => setActiveRecon(null)} className="btn bg-white/5 hover:bg-white/10 text-white flex gap-2 items-center">
                        Back to List
                    </button>
                )}
            </div>

            {/* Main Area: Either List or Active Recon View */}
            {!activeRecon ? (
                <div className="flex-1 overflow-hidden flex flex-col">
                    <DataTable 
                        columns={columns} 
                        data={reconciliations} 
                        hideSearch={true}
                    />
                </div>
            ) : (
                <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                    {/* Active Recon Header */}
                    <div className="glass-panel p-5 grid grid-cols-4 gap-4 items-center border-l-4 border-primary">
                        <div>
                            <p className="text-xs text-textMuted uppercase tracking-wider">Period</p>
                            <p className="font-bold text-lg text-white">{activeRecon.period_start} <span className="text-textMuted mx-1">to</span> {activeRecon.period_end}</p>
                        </div>
                        <div>
                            <p className="text-xs text-textMuted uppercase tracking-wider">Status</p>
                            <span className={`inline-block mt-1 px-2 py-1 rounded text-xs font-bold ${activeRecon.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                {activeRecon.status.replace('_', ' ').toUpperCase()}
                            </span>
                        </div>
                        <div>
                            <p className="text-xs text-textMuted uppercase tracking-wider">Difference</p>
                            <p className={`font-mono font-bold text-xl ${parseFloat(activeRecon.difference) === 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {parseFloat(activeRecon.difference).toFixed(2)} EGP
                            </p>
                        </div>
                        <div className="flex justify-end gap-3">
                            {activeRecon.status !== 'completed' && (
                                <>
                                    <input type="file" ref={fileInputRef} className="hidden" accept=".csv" onChange={handleFileUpload} />
                                    <button onClick={() => fileInputRef.current?.click()} className="btn bg-white/5 hover:bg-white/10 text-white flex gap-2">
                                        <FiUpload /> Import CSV
                                    </button>
                                    <button onClick={handleComplete} className="btn bg-green-500 hover:bg-green-600 text-white flex gap-2 shadow-lg shadow-green-500/20">
                                        <FiCheck /> Complete (Lock)
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Matching Interface (Two columns) */}
                    <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                        {/* System Items */}
                        <div className="glass-panel p-2 flex flex-col">
                            <h4 className="text-center font-bold text-textMuted bg-white/5 py-2 rounded-t-lg border-b border-white/5 flex justify-center items-center gap-2">
                                <FiFileText /> System Records
                            </h4>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {activeRecon.items?.filter(i => i.source === 'system').map(item => (
                                    <div key={item.id} className={`p-3 rounded-lg border flex justify-between items-center transition-colors ${item.status === 'matched' ? 'bg-green-500/10 border-green-500/30' : 'bg-black/20 border-white/5 hover:border-primary/50 cursor-pointer'}`}>
                                        <div>
                                            <p className="font-mono text-xs text-textMuted">{item.date}</p>
                                            <p className="text-sm font-medium text-white">{item.description}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-mono font-bold ${item.status === 'matched' ? 'text-green-400' : 'text-white'}`}>{parseFloat(item.amount).toFixed(2)}</p>
                                            {item.status === 'matched' && <span className="text-[10px] text-green-400 uppercase tracking-widest flex items-center gap-1 justify-end"><FiCheck size={10} /> Matched</span>}
                                        </div>
                                    </div>
                                ))}
                                {!activeRecon.items?.filter(i => i.source === 'system').length && (
                                    <p className="text-center text-textMuted py-8 text-sm">No system records found for this period.</p>
                                )}
                            </div>
                        </div>

                        {/* Bank Items */}
                        <div className="glass-panel p-2 flex flex-col">
                            <h4 className="text-center font-bold text-textMuted bg-white/5 py-2 rounded-t-lg border-b border-white/5 flex justify-center items-center gap-2">
                                <FiUpload /> Bank Statement (CSV)
                            </h4>
                            <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                {activeRecon.items?.filter(i => i.source === 'bank').map(item => (
                                    <div key={item.id} className={`p-3 rounded-lg border flex justify-between items-center transition-colors ${item.status === 'matched' ? 'bg-green-500/10 border-green-500/30' : 'bg-black/20 border-white/5 hover:border-blue-500/50 cursor-pointer'}`}>
                                        <div>
                                            <p className="font-mono text-xs text-textMuted">{item.date}</p>
                                            <p className="text-sm font-medium text-white">{item.description}</p>
                                        </div>
                                        <div className="text-right flex items-center gap-3">
                                            {item.status !== 'matched' && activeRecon.status !== 'completed' && (
                                                <button onClick={() => {
                                                    // Super simple matching logic for demo — in real app you'd select system item then bank item
                                                    const sysItem = activeRecon.items.find(si => si.source === 'system' && si.status === 'unmatched' && parseFloat(si.amount) === parseFloat(item.amount));
                                                    if (sysItem) handleMatch(sysItem.id, item.id);
                                                    else toast.error("No exact matching unmatched system amount found");
                                                }} className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded hover:bg-blue-500/30 transition-colors">Auto-Match Amount</button>
                                            )}
                                            <div>
                                                <p className={`font-mono font-bold ${item.status === 'matched' ? 'text-green-400' : 'text-orange-400'}`}>{parseFloat(item.amount).toFixed(2)}</p>
                                                {item.status === 'matched' && <span className="text-[10px] text-green-400 uppercase tracking-widest flex items-center gap-1 justify-end"><FiCheck size={10} /> Matched</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {!activeRecon.items?.filter(i => i.source === 'bank').length && (
                                    <div className="text-center py-8">
                                        <p className="text-textMuted text-sm mb-4">Upload a bank statement CSV to begin matching.</p>
                                        <button onClick={() => fileInputRef.current?.click()} className="btn bg-white/5 hover:bg-white/10 text-white mx-auto inline-flex gap-2">
                                            <FiUpload /> Browse CSV
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* NEW RECON FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleStartRecon} className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
                            <h3 className="font-bold text-white text-lg">Start Reconciliation</h3>
                            <button type="button" onClick={() => setIsFormOpen(false)} className="text-textMuted hover:text-white"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Period Start</label>
                                <input required type="date" className="input w-full" value={formData.period_start} onChange={e => setFormData({...formData, period_start: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Period End</label>
                                <input required type="date" className="input w-full" value={formData.period_end} onChange={e => setFormData({...formData, period_end: e.target.value})} />
                            </div>
                            <p className="text-xs text-yellow-500/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
                                This will import all system transactions for the selected account within this exact date range.
                            </p>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors shadow-lg shadow-primary/20">Generate Period</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
