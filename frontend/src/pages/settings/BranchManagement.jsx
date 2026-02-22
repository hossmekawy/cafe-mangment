import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { FiMapPin, FiPlus, FiEdit2, FiTrash2, FiShield } from 'react-icons/fi';
import { authApi } from '../../api/authApi';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import ConfirmModal from '../../components/ConfirmModal';

export default function BranchManagement() {
    const [branches, setBranches] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Modals
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteId, setDeleteId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [editingBranch, setEditingBranch] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        is_active: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await authApi.getBranches();
            // getBranches was defined to return all branches (is_active filtering was removed in backend, but just in case)
            setBranches(res.data || []); 
        } catch (error) {
            toast.error("Failed to fetch branches");
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenForm = (branch = null) => {
        if (branch) {
            setEditingBranch(branch);
            setFormData({
                name: branch.name,
                address: branch.address || '',
                is_active: branch.is_active
            });
        } else {
            setEditingBranch(null);
            setFormData({
                name: '',
                address: '',
                is_active: true
            });
        }
        setIsFormOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        const tid = toast.loading(editingBranch ? "Updating branch..." : "Creating branch...");
        
        try {
            const payload = { ...formData };

            if (editingBranch) {
                await authApi.updateBranch(editingBranch.id, payload);
                toast.success("Branch updated successfully", { id: tid });
            } else {
                await authApi.createBranch(payload);
                toast.success("Branch created successfully", { id: tid });
            }
            setIsFormOpen(false);
            fetchData();
        } catch (error) {
            const errMsg = error.response?.data?.detail || error.response?.data?.error || "Error saving branch";
            toast.error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg), { id: tid });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        const tid = toast.loading("Deleting branch...");
        try {
            await authApi.deleteBranch(deleteId);
            toast.success("Branch deleted", { id: tid });
            setDeleteId(null);
            fetchData();
        } catch (error) {
            toast.error("Delete failed. It may be in use.", { id: tid });
        }
    };

    const columns = useMemo(() => [
        { header: 'Branch Name', accessorKey: 'name', cell: info => <span className="font-bold text-white">{info.getValue()}</span> },
        { header: 'Address', accessorKey: 'address', cell: info => <span className="text-sm text-textMuted">{info.getValue() || '—'}</span> },
        { 
            header: 'Status', 
            accessorKey: 'is_active',
            cell: info => info.getValue() 
                ? <span className="text-green-400 text-xs font-bold bg-green-500/10 px-2 py-1 rounded">ACTIVE</span>
                : <span className="text-textMuted text-xs font-bold bg-white/5 px-2 py-1 rounded">INACTIVE</span>
        },
        { header: 'Created At', accessorFn: row => new Date(row.created_at).toLocaleDateString() },
        {
            id: 'actions',
            header: '',
            cell: info => {
                const row = info.row.original;
                return (
                    <div className="flex gap-2 justify-end">
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
                title="Branch Management" 
                subtitle="Manage your cafe branches, locations, and status."
                icon={FiMapPin}
                action={{
                    label: 'Add New Branch',
                    icon: FiPlus,
                    onClick: () => handleOpenForm()
                }}
            />

            <DataTable 
                columns={columns} 
                data={branches} 
                isLoading={isLoading} 
                searchPlaceholder="Search branch names or addresses..."
            />

            {/* FORM MODAL */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleSubmit} className="bg-[#1e293b] rounded-2xl w-full max-w-lg border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                            <h3 className="font-bold text-white text-lg flex items-center gap-2">
                                <FiMapPin className="text-primary"/> {editingBranch ? 'Edit Branch' : 'Create Branch'}
                            </h3>
                            <button type="button" onClick={() => setIsFormOpen(false)} className="text-textMuted hover:text-white">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Branch Name *</label>
                                <input required type="text" className="input w-full" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. Downtown Branch" />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Address (Optional)</label>
                                <textarea className="input w-full min-h-[80px]" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Street address..." />
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl bg-black/20 border border-white/5 hover:bg-black/30 transition-colors">
                                    <input type="checkbox" className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary accent-primary" 
                                        checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} 
                                    />
                                    <div>
                                        <span className="text-white font-medium block">Branch Active</span>
                                        <span className="text-xs text-textMuted">If unchecked, this branch will not appear for selection.</span>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3 shrink-0">
                            <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-white font-bold transition-colors shadow-lg shadow-primary/20">
                                {editingBranch ? 'Save Changes' : 'Create Branch'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <ConfirmModal 
                isOpen={!!deleteId}
                onClose={() => setDeleteId(null)}
                onConfirm={handleDelete}
                title="Delete Branch"
                message="Are you sure you want to delete this branch? Linked users might lose their branch assignment."
                confirmText="Delete"
                confirmColor="bg-red-500 hover:bg-red-600"
            />
        </div>
    );
}
