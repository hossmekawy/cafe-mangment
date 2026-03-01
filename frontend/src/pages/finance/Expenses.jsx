import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { FiPlus, FiCheck, FiX, FiPaperclip, FiTrendingUp } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import useAuthStore from '../../store/authStore';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import PageHeader from '../../components/PageHeader';

export default function Expenses() {
    const { user } = useAuthStore();
    const canApprove = ['super_admin', 'manager'].includes(user?.role);

    const [expenses, setExpenses] = useState([]);
    const [categories, setCategories] = useState([]);
    const [summary, setSummary] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isAddingCategory, setIsAddingCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryBudget, setNewCategoryBudget] = useState('');
    const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        category: '',
        amount: '',
        vat_amount: '0',
        vendor: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        payment_method: 'cash',
        receipt_base64: ''
    });

    const fileInputRef = useRef(null);

    // Filters
    const [filters, setFilters] = useState({
        category: '',
        status: '',
        date_from: '',
        date_to: ''
    });

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [expRes, catRes, sumRes] = await Promise.all([
                financeApi.getExpenses(filters),
                financeApi.getExpenseCategories(),
                financeApi.getExpenseSummary()
            ]);
            setExpenses(expRes.data);
            setCategories(catRes.data);
            setSummary(sumRes.data);
        } catch (error) {
            toast.error("Failed to fetch expenses");
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setFormData(prev => ({ ...prev, receipt_base64: reader.result }));
        reader.readAsDataURL(file);
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) return toast.error("Category name is required");
        setIsSubmittingCategory(true);
        const tid = toast.loading("Creating category...");
        try {
            const payload = { 
                name: newCategoryName, 
                is_active: true,
                budget: parseFloat(newCategoryBudget) || null
            };
            const res = await financeApi.createExpenseCategory(payload);
            toast.success("Category created", { id: tid });
            
            // Add to list and select it
            setCategories(prev => [...prev, res.data]);
            setFormData(prev => ({ ...prev, category: res.data.id }));
            
            // Reset state
            setIsAddingCategory(false);
            setNewCategoryName('');
            setNewCategoryBudget('');
        } catch (error) {
            toast.error("Failed to create category", { id: tid });
        } finally {
            setIsSubmittingCategory(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.category || !formData.amount) return toast.error("Category and Amount are required");

        setIsSubmitting(true);
        const tid = toast.loading("Saving expense...");
        try {
            // Managers auto-approve their own inputs based on backend logic, or we just submit
            await financeApi.createExpense({
                ...formData,
                amount: parseFloat(formData.amount),
                vat_amount: parseFloat(formData.vat_amount || 0)
            });
            toast.success("Expense recorded successfully", { id: tid });
            setIsFormOpen(false);
            setFormData({
                category: '', amount: '', vat_amount: '0', vendor: '', description: '', 
                date: new Date().toISOString().split('T')[0], payment_method: 'cash', receipt_base64: ''
            });
            fetchData();
        } catch (error) {
            toast.error("Failed to save expense", { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        const tid = toast.loading("Approving...");
        try {
            await financeApi.approveExpense(id);
            toast.success("Approved", { id: tid });
            fetchData();
        } catch (error) {
            toast.error("Error approving", { id: tid });
        }
    };

    const handleReject = async (id) => {
        const tid = toast.loading("Rejecting...");
        try {
            await financeApi.rejectExpense(id);
            toast.success("Rejected", { id: tid });
            fetchData();
        } catch (error) {
            toast.error("Error rejecting", { id: tid });
        }
    };

    const columns = useMemo(() => [
        { header: 'Date', accessorKey: 'date' },
        { header: 'Category', accessorFn: row => row.category_name },
        { header: 'Vendor', accessorFn: row => row.vendor || '-' },
        { header: 'Amount', accessorKey: 'amount', cell: info => <span className="font-mono font-bold text-white">{parseFloat(info.getValue()).toFixed(2)} EGP</span> },
        { header: 'Payment Method', accessorFn: row => row.payment_method.replace('_', ' ').toUpperCase(), cell: info => <span className="text-xs">{info.getValue()}</span> },
        { 
            header: 'Status', 
            accessorKey: 'status',
            cell: info => {
                const s = info.getValue();
                return <span className={`px-2 py-1 rounded text-xs font-bold ${
                    s === 'approved' ? 'bg-green-500/20 text-green-400' :
                    s === 'pending' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                }`}>{s.toUpperCase()}</span>;
            }
        },
        { header: 'Created By', accessorFn: row => row.created_by_name || '-' },
        {
            id: 'actions',
            header: '',
            cell: info => {
                const row = info.row.original;
                return (
                    <div className="flex gap-2 justify-end">
                        {row.receipt_base64 && (
                            <button onClick={() => {
                                const w = window.open("");
                                w.document.write(`<img src="${row.receipt_base64}" />`);
                            }} className="text-textMuted hover:text-white" title="View Receipt">
                                <FiPaperclip className="w-4 h-4" />
                            </button>
                        )}
                        {row.status === 'pending' && canApprove && (
                            <>
                                <button onClick={() => handleApprove(row.id)} className="text-green-400 hover:text-green-300 bg-green-400/10 p-1.5 rounded" title="Approve">
                                    <FiCheck className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleReject(row.id)} className="text-red-400 hover:text-red-300 bg-red-400/10 p-1.5 rounded" title="Reject">
                                    <FiX className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                );
            }
        }
    ], [canApprove]);

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader 
                title="Expenses" 
                subtitle="Track operational costs, upload receipts, and manage budgets."
                icon={FiTrendingUp}
                action={{
                    label: 'Record Expense',
                    icon: FiPlus,
                    onClick: () => setIsFormOpen(true)
                }}
            />

            {/* Budget Summary Progress Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.map(cat => {
                    const pct = cat.budget > 0 ? Math.min(100, (cat.actual / cat.budget) * 100) : 0;
                    const isOver = cat.budget > 0 && cat.actual > cat.budget;
                    return (
                        <div key={cat.id} className="glass-panel p-4">
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h4 className="font-bold text-white">{cat.name}</h4>
                                    <p className="text-xs text-textMuted mt-0.5">Budget: {cat.budget > 0 ? `${cat.budget} EGP` : 'Not Set'}</p>
                                </div>
                                <div className="text-right">
                                    <span className={`font-mono text-lg font-bold ${isOver ? 'text-red-400' : 'text-primary'}`}>
                                        {cat.actual.toFixed(2)} EGP
                                    </span>
                                </div>
                            </div>
                            {cat.budget > 0 && (
                                <div className="w-full bg-white/5 rounded-full h-2">
                                    <div 
                                        className={`h-2 rounded-full ${isOver ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-primary shadow-[0_0_10px_rgba(59,130,246,0.5)]'}`}
                                        style={{ width: `${pct}%` }}
                                    ></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <DataTable 
                columns={columns} 
                data={expenses} 
                isLoading={isLoading}
                hideSearch={true}
                extraFilters={
                    <div className="flex gap-3">
                        <select className="input text-sm p-2 w-40" value={filters.category} onChange={e => setFilters(p => ({ ...p, category: e.target.value }))}>
                            <option value="">All Categories</option>
                            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select className="input text-sm p-2 w-32" value={filters.status} onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>
                }
            />

            {/* EXPENSE FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="bg-[#1e293b] rounded-2xl w-full max-w-lg border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
                            <h3 className="font-bold text-white text-lg">Record Expense</h3>
                            <button type="button" onClick={() => setIsFormOpen(false)} className="text-textMuted hover:text-white"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-sm font-medium text-textMuted">Category *</label>
                                        {!isAddingCategory && (
                                            <button 
                                                type="button" 
                                                onClick={() => setIsAddingCategory(true)}
                                                className="text-primary text-xs font-bold hover:underline"
                                            >
                                                + Add New
                                            </button>
                                        )}
                                    </div>
                                    
                                    {isAddingCategory ? (
                                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-2 space-y-2 animate-fade-in text-sm">
                                            <input 
                                                autoFocus
                                                type="text" 
                                                placeholder="Category Name" 
                                                className="input w-full text-sm" 
                                                value={newCategoryName} 
                                                onChange={e => setNewCategoryName(e.target.value)} 
                                            />
                                            <input 
                                                type="number" 
                                                placeholder="Monthly Budget (Optional)" 
                                                className="input w-full text-sm" 
                                                value={newCategoryBudget} 
                                                onChange={e => setNewCategoryBudget(e.target.value)} 
                                            />
                                            <div className="flex gap-2 justify-end pt-1">
                                                <button type="button" onClick={() => setIsAddingCategory(false)} className="px-2 py-1 text-xs text-textMuted hover:text-white">Cancel</button>
                                                <button type="button" onClick={handleCreateCategory} disabled={isSubmittingCategory} className="px-3 py-1 text-xs bg-primary hover:bg-primary/90 text-white font-bold rounded">Add</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <select required className="input w-full" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                                            <option value="">Select Category</option>
                                            {categories.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Date *</label>
                                    <input type="date" required className="input w-full" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Total Amount (EGP) *</label>
                                    <input type="number" step="0.01" required className="input w-full font-mono text-primary" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">VAT Included (EGP)</label>
                                    <input type="number" step="0.01" className="input w-full font-mono" value={formData.vat_amount} onChange={e => setFormData({...formData, vat_amount: e.target.value})} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Vendor / Payee</label>
                                    <input type="text" className="input w-full" value={formData.vendor} onChange={e => setFormData({...formData, vendor: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Payment Method</label>
                                    <select className="input w-full" value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})}>
                                        <option value="cash">Cash</option>
                                        <option value="card">Card</option>
                                        <option value="bank_transfer">Bank Transfer</option>
                                        <option value="petty_cash">Petty Cash</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Description</label>
                                <textarea className="input w-full min-h-[60px]" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Receipt Image</label>
                                <input 
                                    type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange}
                                    className="block w-full text-sm text-textMuted file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/20 file:text-primary hover:file:bg-primary/30 transition-colors cursor-pointer"
                                />
                                {formData.receipt_base64 && <img src={formData.receipt_base64} alt="Receipt preview" className="mt-2 h-20 rounded-lg border border-white/10" />}
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors shadow-lg shadow-primary/20">Record Expense</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
