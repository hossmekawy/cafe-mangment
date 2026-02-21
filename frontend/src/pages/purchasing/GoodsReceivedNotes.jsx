import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEye, FiCheckCircle, FiTruck } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { purchasingApi } from '../../api/purchasingApi';
import useSettingsStore from '../../store/settingsStore';

const grnSchema = yup.object().shape({
  purchase_order: yup.string().nullable(),
  supplier: yup.string().required('Supplier is required'),
  notes: yup.string(),
  items: yup.array().of(
    yup.object().shape({
      raw_material: yup.string().required('Material is required'),
      quantity_ordered: yup.number().min(0, 'Must be >= 0'),
      quantity_received: yup.number().min(0.01, 'Quantity must be > 0').required('Required'),
      unit_price: yup.number().min(0, 'Price must be >= 0').required('Required'),
      expiry_date: yup.string().nullable()
    })
  ).min(1, 'At least one item is required')
});

const GoodsReceivedNotes = () => {
    const [grns, setGrns] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewGrn, setViewGrn] = useState(null);
    const [confirmAction, setConfirmAction] = useState({ open: false, grn: null, type: null });

    const { settings } = useSettingsStore();

    const { register, control, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({
        resolver: yupResolver(grnSchema),
        defaultValues: {
            items: [{ raw_material: '', quantity_ordered: 0, quantity_received: 1, unit_price: 0, expiry_date: '' }]
        }
    });

    const { fields, append, remove, replace } = useFieldArray({
        control,
        name: "items"
    });

    const watchedItems = watch("items") || [];
    const watchedSupplier = watch("supplier");
    const watchedPO = watch("purchase_order");

    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Lazy loading related items, but for now fetch all necessary dropdowns
            // In a real huge app, we'd paginate the dropdowns or use async selects
            const [grnRes, supRes, poRes, matRes] = await Promise.all([
                purchasingApi.getGRNs(),
                purchasingApi.getSuppliers(),
                purchasingApi.getOrders(),
                purchasingApi.getGRNs().then(() => {
                    // Dirty hack since inventoryApi is in another file, let's just fetch it here via full path
                    return import('../../api/inventoryApi').then(({ inventoryApi }) => inventoryApi.getMaterials());
                })
            ]);
            setGrns(grnRes.data);
            setSuppliers(supRes.data);
            
            // Only confirmed or partially received POs can be received
            const receivablePOs = poRes.data.filter(po => ['confirmed', 'partially_received'].includes(po.status));
            setPurchaseOrders(receivablePOs);
            setMaterials(matRes.data);
            
        } catch (error) {
            toast.error('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Effect to auto-populate items when a PO is selected
    useEffect(() => {
        if (watchedPO) {
            const po = purchaseOrders.find(p => p.id === watchedPO);
            if (po) {
                setValue('supplier', po.supplier);
                // Pre-fill items with remaining quantities
                const grnItems = po.items.map(item => ({
                    raw_material: item.raw_material,
                    quantity_ordered: item.quantity_ordered,
                    quantity_received: Math.max(0, item.quantity_ordered - item.quantity_received), // Suggest remaining
                    unit_price: item.unit_price,
                    expiry_date: ''
                })).filter(item => item.quantity_received > 0);
                
                if (grnItems.length > 0) {
                    replace(grnItems);
                } else {
                    replace([{ raw_material: '', quantity_ordered: 0, quantity_received: 1, unit_price: 0, expiry_date: '' }]);
                    toast('This PO has already been fully received.', { icon: 'ℹ️' });
                }
            }
        }
    }, [watchedPO]);

    const onSubmit = async (data) => {
        try {
            // Data formatting
            const formattedData = {
                ...data,
                purchase_order: data.purchase_order || null,
                items: data.items.map(item => ({
                    ...item,
                    expiry_date: item.expiry_date || null
                }))
            };
            
            await purchasingApi.createGRN(formattedData);
            toast.success('Goods Received Note recorded successfully');
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
             toast.error(error.response?.data?.error || 'Failed to create GRN');
        }
    };

    const handleConfirmAction = async () => {
        try {
            if (confirmAction.type === 'complete') {
                 await purchasingApi.completeGRN(confirmAction.grn.id);
                 toast.success('GRN Completed! Stock has been updated and Invoice generated.');
            }
            setConfirmAction({ open: false, grn: null, type: null });
            setViewGrn(null);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.error || `Failed to complete GRN`);
            setConfirmAction({ open: false, grn: null, type: null });
        }
    };

    const columns = useMemo(() => [
        {
            header: 'GRN Number',
            accessorKey: 'grn_number',
            cell: info => <span className="font-semibold text-primary">{info.getValue()}</span>
        },
        {
            header: 'Supplier',
            accessorKey: 'supplier_name',
        },
        {
            header: 'PO Ref',
            accessorFn: row => {
                 if (row.purchase_order && purchaseOrders.length > 0) {
                     const po = purchaseOrders.find(p => p.id === row.purchase_order) || { po_number: 'Unknown' };
                     // Handle lazy load or missing PO in list (if it was fully received previously)
                     return po.po_number || 'Linked';
                 }
                 return 'Direct (No PO)';
            },
        },
        {
            header: 'Date',
            accessorFn: row => new Date(row.received_date).toLocaleDateString(),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: info => {
                const status = info.getValue();
                const colors = {
                    'pending': 'bg-yellow-500/20 text-yellow-400',
                    'completed': 'bg-green-500/20 text-green-400',
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${colors[status] || colors.pending}`}>
                        {status.replace('_', ' ')}
                    </span>
                )
            }
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <button 
                    onClick={(e) => { e.stopPropagation(); setViewGrn(info.row.original); }}
                    className="p-1.5 bg-white/5 text-white rounded hover:bg-white/10 transition-colors"
                >
                    <FiEye className="w-4 h-4" />
                </button>
            )
        }
    ], [purchaseOrders, settings]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Goods Received Notes (GRN)</h1>
                <button 
                    onClick={() => {
                        reset({ items: [{ raw_material: '', quantity_ordered: 0, quantity_received: 1, unit_price: 0, expiry_date: '' }] });
                        setIsCreateModalOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Receive Goods</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={grns} 
                isLoading={isLoading}
                searchPlaceholder="Search GRNs..."
            />

            {/* Create GRN Modal - Redesigned */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-5xl h-[85vh] flex overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
                        {/* Sidebar */}
                        <div className="w-1/3 bg-[#0f172a] p-6 border-r border-white/5 flex flex-col relative z-10">
                            <h2 className="text-xl font-bold text-white mb-6">Record Received Goods</h2>
                            
                            <form id="grn-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                {/* Type Selector visually acting as Tabs */}
                                <div className="bg-background/50 p-1.5 rounded-lg flex space-x-1 mb-6 border border-white/5">
                                    <button 
                                        type="button"
                                        onClick={() => { setValue('purchase_order', ''); replace([{ raw_material: '', quantity_ordered: 0, quantity_received: 1, unit_price: 0, expiry_date: '' }]); }}
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${!watchedPO ? 'bg-primary text-white shadow' : 'text-textMuted hover:text-white'}`}
                                    >
                                        Direct Receipt
                                    </button>
                                    <button 
                                        type="button"
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${watchedPO ? 'bg-primary text-white shadow' : 'text-textMuted hover:text-white'}`}
                                        // This button just acts as a visual prompt; actual selection is below
                                    >
                                        From P.O.
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-2">Purchase Order (Optional)</label>
                                    <select {...register('purchase_order')} className="form-input bg-background/50 border-white/5 shadow-inner">
                                        <option value="">-- No PO (Direct Receipt) --</option>
                                        {purchaseOrders.map(po => (
                                            <option key={po.id} value={po.id}>{po.po_number} - {po.supplier_name}</option>
                                        ))}
                                    </select>
                                    {watchedPO && <p className="text-xs text-primary mt-2 flex items-center"><FiCheckCircle className="mr-1" /> Items auto-filled from PO</p>}
                                </div>

                                <div className={`transition-all duration-300 ${watchedPO ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                                    <label className="block text-sm font-medium text-textMuted mb-2">Supplier *</label>
                                    <select {...register('supplier')} className="form-input bg-background/50 border-white/5 shadow-inner" disabled={!!watchedPO}>
                                        <option value="">-- Choose Supplier --</option>
                                        {suppliers.filter(s => s.is_active).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    {errors.supplier && <span className="text-red-400 text-xs mt-1 block">{errors.supplier.message}</span>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-2">Delivery Notes / Remarks</label>
                                    <textarea {...register('notes')} className="form-input bg-background/50 border-white/5 shadow-inner" rows="3" placeholder="Driver name, conditions, etc."></textarea>
                                </div>
                            </form>
                            
                            <div className="pt-6 border-t border-white/10 mt-auto">
                                <div className="flex space-x-3">
                                    <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-3 rounded-xl font-medium text-white bg-white/5 hover:bg-white/10 transition-colors w-1/3">
                                        Cancel
                                    </button>
                                    <button form="grn-form" type="submit" className="px-4 py-3 rounded-xl font-bold tracking-wide text-white bg-yellow-500 hover:bg-yellow-400 shadow-lg shadow-yellow-500/25 transition-all w-2/3 flex justify-center items-center text-gray-900">
                                        Record GRN
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Main Content */}
                        <div className="w-2/3 bg-[#16213e] flex flex-col relative z-0">
                            <div className="absolute top-0 right-0 w-96 h-96 bg-yellow-500/10 rounded-full blur-[100px] pointer-events-none"></div>

                            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#1e293b]/50 backdrop-blur-md sticky top-0 z-10">
                                <h3 className="text-lg font-bold text-white flex items-center">
                                    <FiTruck className="mr-2 text-yellow-400" /> Received Inventory
                                </h3>
                                {!watchedPO && (
                                    <button 
                                        type="button" 
                                        onClick={() => append({ raw_material: '', quantity_ordered: 0, quantity_received: 1, unit_price: 0, expiry_date: '' })}
                                        className="text-sm px-4 py-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20 rounded-lg flex items-center space-x-2 transition-all font-medium"
                                    >
                                        <FiPlus /> <span>Add Item</span>
                                    </button>
                                )}
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6 space-y-3 custom-scrollbar relative z-10">
                                <div className="grid grid-cols-12 gap-2 text-[11px] font-bold text-textMuted uppercase tracking-wider px-2 mb-2 items-center">
                                    <div className={`col-span-${watchedPO ? '3' : '4'}`}>Material</div>
                                    <div className="col-span-2 text-center">Cost</div>
                                    {watchedPO && <div className="col-span-2 text-center">Ordered</div>}
                                    <div className={`col-span-${watchedPO ? '2' : '3'} text-center`}>Received *</div>
                                    <div className="col-span-2 text-center">Expiry</div>
                                    <div className="col-span-1 text-center">Del</div>
                                </div>
                                
                                {fields.length === 0 && (
                                    <div className="text-center py-12 opacity-50">
                                        <p className="text-white border border-dashed border-white/20 p-8 rounded-xl bg-white/5 inline-block">No items to receive.</p>
                                    </div>
                                )}

                                {fields.map((field, index) => {
                                    const qtyOrdered = parseFloat(watchedItems[index]?.quantity_ordered) || 0;
                                    const qtyReceived = parseFloat(watchedItems[index]?.quantity_received) || 0;
                                    
                                    // Highlight if they receive more or less than ordered (only relevant for POs)
                                    const isDiscrepancy = watchedPO && qtyReceived !== qtyOrdered;

                                    return (
                                        <div key={field.id} className={`grid grid-cols-12 gap-2 items-center bg-white/5 hover:bg-white/10 border ${isDiscrepancy ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-white/5'} p-2 rounded-xl transition-colors relative`}>
                                            <div className={`col-span-${watchedPO ? '3' : '4'}`}>
                                                <select {...register(`items.${index}.raw_material`)} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors appearance-none scrollbar-thin" disabled={!!watchedPO}>
                                                    <option value="" className="bg-[#0f172a]">Material...</option>
                                                    {materials.filter(m => m.is_active || m.id === watchedItems[index]?.raw_material).map(m => (
                                                        <option key={m.id} value={m.id} className="bg-[#0f172a]">{m.name}</option>
                                                    ))}
                                                </select>
                                                {isDiscrepancy && <span className="absolute -top-2 left-4 text-[9px] bg-yellow-500 text-gray-900 font-bold px-1.5 py-0.5 rounded shadow z-10">Discrepancy</span>}
                                            </div>
                                            
                                            <div className="col-span-2 relative flex items-center">
                                                <span className="absolute left-2 text-textMuted text-xs font-medium">{settings?.currency || '$'}</span>
                                                <input type="number" step="0.01" {...register(`items.${index}.unit_price`)} className="w-full bg-black/20 border border-white/10 rounded-lg pl-6 pr-2 py-2 text-sm text-right text-white focus:outline-none focus:border-primary transition-colors font-mono" readOnly={!!watchedPO} />
                                            </div>

                                            {watchedPO && (
                                                <div className="col-span-2">
                                                    <input type="number" readOnly={!!watchedPO} {...register(`items.${index}.quantity_ordered`)} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-center text-textMuted focus:outline-none focus:border-primary transition-colors font-mono" />
                                                </div>
                                            )}

                                            <div className={`col-span-${watchedPO ? '2' : '3'}`}>
                                                <input type="number" step="0.001" placeholder="0" {...register(`items.${index}.quantity_received`)} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-sm text-center text-white focus:outline-none focus:border-primary transition-colors font-mono font-bold" />
                                            </div>
                                            
                                            <div className="col-span-2">
                                                <input type="date" {...register(`items.${index}.expiry_date`)} className="w-full bg-black/20 border border-white/10 rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-primary transition-colors" />
                                            </div>

                                            <div className="col-span-1 flex justify-center">
                                                <button type="button" onClick={() => remove(index)} className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors">
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                                {errors.items?.root && <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">{errors.items.root.message}</div>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* View GRN Modal */}
            {viewGrn && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewGrn(null)}></div>
                    <div className="relative glass-panel w-full max-w-3xl p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{viewGrn.grn_number}</h2>
                                <p className="text-textMuted mt-1">Supplier: <span className="text-white font-medium">{viewGrn.supplier_name}</span></p>
                                <p className="text-textMuted text-sm mt-1">Received By: {viewGrn.received_by_name} on {new Date(viewGrn.received_date).toLocaleDateString()}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full uppercase tracking-wider text-xs font-bold border ${
                                viewGrn.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                            }`}>
                                {viewGrn.status.replace('_', ' ')}
                            </span>
                        </div>
                        
                        <div className="glass-panel p-4 mb-6">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-textMuted">
                                        <th className="pb-2 font-medium">Material</th>
                                        <th className="pb-2 font-medium text-center">Received Qty</th>
                                        <th className="pb-2 font-medium text-right">Unit Price</th>
                                        <th className="pb-2 font-medium text-center">Expiry</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {viewGrn.items?.map(item => (
                                        <tr key={item.id}>
                                            <td className="py-3 text-white">{item.raw_material_name}</td>
                                            <td className="py-3 text-center font-bold text-primary">{parseFloat(item.quantity_received)}</td>
                                            <td className="py-3 text-right text-textMuted">{settings?.currency || '$'}{parseFloat(item.unit_price).toFixed(2)}</td>
                                            <td className="py-3 text-center text-textMuted">{item.expiry_date || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-white/10">
                            <div className="flex space-x-3">
                                {viewGrn.status === 'pending' && (
                                    <button 
                                        onClick={() => setConfirmAction({ open: true, grn: viewGrn, type: 'complete' })} 
                                        className="px-4 py-2 bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 rounded-lg flex items-center space-x-2 transition-colors font-medium"
                                    >
                                        <FiCheckCircle /> <span>Confirm & Add To Stock</span>
                                    </button>
                                )}
                            </div>
                            <button onClick={() => setViewGrn(null)} className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmModal 
                isOpen={confirmAction.open}
                title="Complete Goods Received Note"
                message="Are you sure you want to COMPLETE this GRN? This will permanently add the items to your Inventory Stock, update unit costs, and generate an Accounting Invoice. This action cannot be undone."
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmAction({ open: false, grn: null, type: null })}
                confirmText="Verify and Complete"
            />
        </div>
    );
};

export default GoodsReceivedNotes;
