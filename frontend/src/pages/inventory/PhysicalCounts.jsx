import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEye, FiCheckCircle } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { inventoryApi } from '../../api/inventoryApi';

const countSchema = yup.object().shape({
  notes: yup.string(),
  items: yup.array().of(
    yup.object().shape({
      raw_material: yup.string().required('Material is required'),
      counted_quantity: yup.number().min(0, 'Cannot be negative').required('Required'),
    })
  ).min(1, 'At least one item is required')
});

const PhysicalCounts = () => {
    const [counts, setCounts] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewCount, setViewCount] = useState(null);
    const [confirmAction, setConfirmAction] = useState({ open: false, count: null });

    const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: yupResolver(countSchema),
        defaultValues: { items: [] }
    });

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: "items"
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [countsRes, matRes] = await Promise.all([
                inventoryApi.getCounts(),
                inventoryApi.getMaterials()
            ]);
            setCounts(countsRes.data);
            setMaterials(matRes.data);
        } catch (error) {
            toast.error('Failed to load physical counts');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handlePreFill = () => {
        // Pre-fill the count form with ALL active materials, initializing current stock
        const allItems = materials.filter(m => m.is_active).map(m => ({
            raw_material: m.id,
            counted_quantity: parseFloat(m.current_stock) || 0
        }));
        replace(allItems);
    };

    const onSubmit = async (data) => {
        try {
            await inventoryApi.createCount(data);
            toast.success('Physical count drafted. Review it before completion.');
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
             toast.error('Failed to draft physical count');
        }
    };

    const handleComplete = async () => {
        try {
            await inventoryApi.completeCount(confirmAction.count.id);
            toast.success('Physical count completed. Variances logged and stock updated.');
            setConfirmAction({ open: false, count: null });
            setViewCount(null);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.error || `Failed to complete count`);
            setConfirmAction({ open: false, count: null });
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Date Counted',
            accessorFn: row => new Date(row.count_date).toLocaleDateString(),
            cell: info => <span className="font-semibold">{info.getValue()}</span>
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: info => {
                const status = info.getValue();
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {status}
                    </span>
                )
            }
        },
        {
            header: 'Items Counted',
            accessorFn: row => row.items?.length || 0,
        },
        {
            header: 'Conducted By',
            accessorKey: 'conducted_by_name',
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <button 
                    onClick={(e) => { e.stopPropagation(); setViewCount(info.row.original); }}
                    className="p-1.5 bg-white/5 text-white rounded hover:bg-white/10 transition-colors"
                >
                    <FiEye className="w-4 h-4" />
                </button>
            )
        }
    ], []);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Physical Counts (Reconciliation)</h1>
                <button 
                    onClick={() => {
                        reset({ items: [] });
                        setIsCreateModalOpen(true);
                        setTimeout(handlePreFill, 50); // Pre-fill with all items
                    }}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Start Full Count</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={counts} 
                isLoading={isLoading}
                searchPlaceholder="Search counts..."
            />

            {/* Create Count Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-4xl p-6 max-h-[90vh] flex flex-col">
                        <h2 className="text-xl font-bold text-white mb-2">Step 1: Record Physical Stock</h2>
                        <p className="text-textMuted text-sm mb-6">
                            Enter the exact quantities currently sitting on your shelves. 
                            The system will save this as a <strong>'Draft'</strong> so you can review the differences (variances) and approve them before your inventory is permanently adjusted.
                        </p>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1 flex flex-col overflow-hidden">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Notes / Area Covered</label>
                                <input {...register('notes')} className="form-input" placeholder="e.g. Fridge A & Dry Storage" />
                            </div>

                            <div className="flex-1 overflow-y-auto border border-white/10 rounded-lg p-4 bg-white/5 mt-4">
                                <div className="space-y-3">
                                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-textMuted uppercase tracking-wider px-2 sticky top-0 bg-[#16213e] py-2 z-10">
                                        <div className="col-span-1">#</div>
                                        <div className="col-span-5">Material</div>
                                        <div className="col-span-3 text-center">System Stock</div>
                                        <div className="col-span-3 text-center">Actual Counted</div>
                                    </div>
                                    {fields.map((field, index) => {
                                        const material = materials.find(m => m.id === field.raw_material);
                                        return (
                                            <div key={field.id} className="grid grid-cols-12 gap-4 items-center p-2 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                <div className="col-span-1 text-textMuted text-sm">{index + 1}</div>
                                                <div className="col-span-5">
                                                    <select {...register(`items.${index}.raw_material`)} className="form-input text-sm py-1" style={{ pointerEvents: 'none', appearance: 'none' }} tabIndex="-1" readOnly>
                                                        {materials.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-3 text-center font-mono text-textMuted text-sm">
                                                    {parseFloat(material?.current_stock || 0)} {material?.unit?.abbreviation}
                                                </div>
                                                <div className="col-span-3">
                                                    <input type="number" step="0.001" {...register(`items.${index}.counted_quantity`)} className="form-input text-center font-bold text-accent" />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-4 mt-4">
                                <button type="button" onClick={() => append({ raw_material: '', counted_quantity: 0 })} className="text-sm text-primary hover:text-primary/80 flex items-center space-x-1">
                                    <FiPlus /> <span>Add Unlisted Item</span>
                                </button>
                                <div className="flex space-x-3">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                        Discard
                                    </button>
                                    <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium shadow-lg transition-all">
                                        Save for Review (Draft)
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Count Modal */}
            {viewCount && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewCount(null)}></div>
                    <div className="relative glass-panel w-full max-w-3xl p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">Step 2: Variance Review</h2>
                                <p className="text-textMuted mt-1">Conducted By: {viewCount.conducted_by_name} on {new Date(viewCount.count_date).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full uppercase tracking-wider text-xs font-bold ${viewCount.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {viewCount.status}
                            </span>
                        </div>
                        
                        <div className="glass-panel p-4 mb-6 max-h-[50vh] overflow-y-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 bg-[#16213e]">
                                    <tr className="border-b border-white/10 text-textMuted">
                                        <th className="pb-2 font-medium">Material</th>
                                        <th className="pb-2 font-medium text-center">System Qty</th>
                                        <th className="pb-2 font-medium text-center">Actual Count</th>
                                        <th className="pb-2 font-medium text-right">Variance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {viewCount.items?.map(item => {
                                        const sys = parseFloat(item.system_quantity);
                                        const actual = parseFloat(item.counted_quantity);
                                        const variance = parseFloat(item.variance);
                                        return (
                                            <tr key={item.id}>
                                                <td className="py-3 text-white">{item.raw_material_name}</td>
                                                <td className="py-3 text-center text-textMuted">{sys}</td>
                                                <td className="py-3 text-center font-bold">{actual}</td>
                                                <td className={`py-3 text-right font-bold ${variance < 0 ? 'text-red-400' : variance > 0 ? 'text-green-400' : 'text-textMuted'}`}>
                                                    {variance > 0 ? '+' : ''}{variance}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-white/10">
                            <div>
                                {viewCount.status === 'draft' && (
                                    <button 
                                        onClick={() => setConfirmAction({ open: true, count: viewCount })} 
                                        className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 rounded-lg flex items-center space-x-2 transition-colors font-medium"
                                    >
                                        <FiCheckCircle /> <span>Approve & Apply to Inventory</span>
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setViewCount(null)} className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={confirmAction.open}
                title="Approve Inventory Variances"
                message="Are you sure you want to APPLY these changes? Your system stock will be immediately adjusted up or down to match your physical count. This cannot be undone."
                onConfirm={handleComplete}
                onCancel={() => setConfirmAction({ open: false, count: null })}
                confirmText="Apply Changes"
            />
        </div>
    );
};

export default PhysicalCounts;
