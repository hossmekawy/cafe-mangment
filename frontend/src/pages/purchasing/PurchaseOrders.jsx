import React, { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEye, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { purchasingApi } from '../../api/purchasingApi';
import { inventoryApi } from '../../api/inventoryApi';

const orderSchema = yup.object().shape({
  supplier: yup.string().required('Supplier is required'),
  expected_delivery_date: yup.string().nullable(),
  is_recurring: yup.boolean(),
  recurrence_interval: yup.string().nullable(),
  notes: yup.string(),
  items: yup.array().of(
    yup.object().shape({
      raw_material: yup.string().required('Material is required'),
      quantity_ordered: yup.number().min(0.01, 'Quantity must be > 0').required('Required'),
      unit_price: yup.number().min(0, 'Price must be >= 0').required('Required'),
    })
  ).min(1, 'At least one item is required')
});

const PurchaseOrders = () => {
    const [orders, setOrders] = useState([]);
    const [suppliers, setSuppliers] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [viewOrder, setViewOrder] = useState(null);
    const [confirmAction, setConfirmAction] = useState({ open: false, order: null, type: null });

    const { register, control, handleSubmit, reset, watch, formState: { errors } } = useForm({
        resolver: yupResolver(orderSchema),
        defaultValues: {
            items: [{ raw_material: '', quantity_ordered: 1, unit_price: 0 }]
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: "items"
    });

    const watchedItems = watch("items");
    const totalAmount = watchedItems.reduce((acc, item) => acc + ((parseFloat(item.quantity_ordered) || 0) * (parseFloat(item.unit_price) || 0)), 0);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [ordersRes, supRes, matRes] = await Promise.all([
                purchasingApi.getOrders(),
                purchasingApi.getSuppliers(),
                inventoryApi.getMaterials()
            ]);
            setOrders(ordersRes.data);
            setSuppliers(supRes.data);
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

    const onSubmit = async (data) => {
        try {
            // Need to manually calculate item total prices
            const formattedData = {
                ...data,
                total_amount: totalAmount,
                items: data.items.map(item => ({
                    ...item,
                    total_price: (parseFloat(item.quantity_ordered) * parseFloat(item.unit_price)).toFixed(2)
                }))
            };
            
            await purchasingApi.createOrder(formattedData);
            toast.success('Purchase Order drafted successfully');
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
             toast.error(error.response?.data?.error || 'Failed to create PO');
        }
    };

    const handleConfirmAction = async () => {
        try {
            if (confirmAction.type === 'confirm') {
                 await purchasingApi.confirmOrder(confirmAction.order.id);
                 toast.success('Order confirmed and dispatched!');
            } else if (confirmAction.type === 'cancel') {
                 await purchasingApi.cancelOrder(confirmAction.order.id);
                 toast.success('Order cancelled.');
            }
            setConfirmAction({ open: false, order: null, type: null });
            setViewOrder(null);
            fetchData();
        } catch (e) {
            toast.error(e.response?.data?.error || `Failed to ${confirmAction.type} order`);
            setConfirmAction({ open: false, order: null, type: null });
        }
    };

    const columns = useMemo(() => [
        {
            header: 'PO Number',
            accessorKey: 'po_number',
            cell: info => <span className="font-semibold text-primary">{info.getValue()}</span>
        },
        {
            header: 'Supplier',
            accessorKey: 'supplier_name',
        },
        {
            header: 'Total Value',
            accessorFn: row => `$${parseFloat(row.total_amount).toFixed(2)}`,
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: info => {
                const status = info.getValue();
                const colors = {
                    'draft': 'bg-gray-500/20 text-gray-400',
                    'confirmed': 'bg-blue-500/20 text-blue-400',
                    'partially_received': 'bg-yellow-500/20 text-yellow-400',
                    'received': 'bg-green-500/20 text-green-400',
                    'cancelled': 'bg-red-500/20 text-red-400'
                };
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase tracking-wider ${colors[status] || colors.draft}`}>
                        {status.replace('_', ' ')}
                    </span>
                )
            }
        },
        {
            header: 'Created By',
            accessorKey: 'created_by_name',
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <button 
                    onClick={(e) => { e.stopPropagation(); setViewOrder(info.row.original); }}
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
                <h1 className="text-2xl font-bold text-white">Purchase Orders</h1>
                <button 
                    onClick={() => {
                        reset({ items: [{ raw_material: '', quantity_ordered: 1, unit_price: 0 }] });
                        setIsCreateModalOpen(true);
                    }}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Create Draft PO</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={orders} 
                isLoading={isLoading}
                searchPlaceholder="Search POs..."
            />

            {/* Create PO Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-4xl p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6">Draft New Purchase Order</h2>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Select Supplier *</label>
                                    <select {...register('supplier')} className="form-input">
                                        <option value="">-- Choose Supplier --</option>
                                        {suppliers.filter(s => s.is_active).map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    {errors.supplier && <span className="text-red-400 text-xs">{errors.supplier.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Expected Delivery Date</label>
                                    <input type="date" {...register('expected_delivery_date')} className="form-input" />
                                </div>
                                
                                <div className="col-span-2 glass-panel p-4 flex items-center space-x-6">
                                    <div className="flex items-center space-x-2">
                                        <input type="checkbox" {...register('is_recurring')} id="is_recurring" className="w-4 h-4 rounded text-primary" />
                                        <label htmlFor="is_recurring" className="text-sm font-medium text-white">Make this a Recurring Order</label>
                                    </div>
                                    <div className="flex-1">
                                        <select {...register('recurrence_interval')} className="form-input text-sm py-1.5" disabled={!watch('is_recurring')}>
                                            <option value="">No Recurrence</option>
                                            <option value="daily">Daily</option>
                                            <option value="weekly">Weekly</option>
                                            <option value="biweekly">Bi-Weekly</option>
                                            <option value="monthly">Monthly</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-white/10 pt-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-semibold text-white">Order Items</h3>
                                    <button 
                                        type="button" 
                                        onClick={() => append({ raw_material: '', quantity_ordered: 1, unit_price: 0 })}
                                        className="text-sm text-primary hover:text-primary/80 flex items-center space-x-1"
                                    >
                                        <FiPlus /> <span>Add Row</span>
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-textMuted uppercase tracking-wider px-2">
                                        <div className="col-span-1">#</div>
                                        <div className="col-span-5">Material</div>
                                        <div className="col-span-2 text-center">Qty</div>
                                        <div className="col-span-2 text-center">Unit Price</div>
                                        <div className="col-span-1 text-right">Total</div>
                                        <div className="col-span-1 text-center">Actions</div>
                                    </div>
                                    {fields.map((field, index) => {
                                        const qty = parseFloat(watchedItems[index]?.quantity_ordered) || 0;
                                        const price = parseFloat(watchedItems[index]?.unit_price) || 0;
                                        const rowTotal = (qty * price).toFixed(2);
                                        
                                        return (
                                            <div key={field.id} className="grid grid-cols-12 gap-2 items-center bg-white/5 p-2 rounded-lg">
                                                <div className="col-span-1 text-textMuted font-mono text-xs">{index + 1}</div>
                                                <div className="col-span-5">
                                                    <select {...register(`items.${index}.raw_material`)} className="form-input text-sm py-1.5">
                                                        <option value="">Select Material...</option>
                                                        {materials.map(m => (
                                                            <option key={m.id} value={m.id}>{m.name} ({m.unit?.abbreviation || 'unit'})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-span-2">
                                                    <input type="number" step="0.001" {...register(`items.${index}.quantity_ordered`)} className="form-input text-sm py-1.5 text-center" />
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="relative">
                                                        <span className="absolute left-2 top-1.5 text-textMuted">$</span>
                                                        <input type="number" step="0.01" {...register(`items.${index}.unit_price`)} className="form-input pl-6 text-sm py-1.5 text-right" />
                                                    </div>
                                                </div>
                                                <div className="col-span-1 text-right text-sm font-mono text-accent">
                                                    ${rowTotal}
                                                </div>
                                                <div className="col-span-1 flex justify-center">
                                                    <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-300 p-1">
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {errors.items?.root && <span className="text-red-400 text-xs">{errors.items.root.message}</span>}
                                </div>
                            </div>
                            
                            <div className="flex justify-end pt-4 border-t border-white/10">
                                <div className="text-right">
                                    <p className="text-textMuted text-sm mb-1">Estimated Total</p>
                                    <p className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                                        ${totalAmount.toFixed(2)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Discard
                                </button>
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg font-medium shadow-lg shadow-primary/20 transition-all">
                                    Create Draft Order
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View PO Modal - Shows actual PO items, read only, with action buttons */}
            {viewOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewOrder(null)}></div>
                    <div className="relative glass-panel w-full max-w-3xl p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{viewOrder.po_number}</h2>
                                <p className="text-textMuted mt-1">Supplier: <span className="text-white font-medium">{viewOrder.supplier_name}</span></p>
                            </div>
                            <span className="px-3 py-1 rounded-full uppercase tracking-wider text-xs font-bold bg-white/10 text-white border border-white/20">
                                {viewOrder.status.replace('_', ' ')}
                            </span>
                        </div>
                        
                        <div className="glass-panel p-4 mb-6">
                            <h3 className="text-sm font-semibold text-textMuted uppercase tracking-wider mb-4">Line Items</h3>
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-white/10 text-textMuted">
                                        <th className="pb-2 font-medium">Material</th>
                                        <th className="pb-2 font-medium text-center">Ordered</th>
                                        <th className="pb-2 font-medium text-center">Received</th>
                                        <th className="pb-2 font-medium text-right">Unit Price</th>
                                        <th className="pb-2 font-medium text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {viewOrder.items?.map(item => (
                                        <tr key={item.id}>
                                            <td className="py-3 text-white">{item.raw_material_name}</td>
                                            <td className="py-3 text-center">{parseFloat(item.quantity_ordered)}</td>
                                            <td className={`py-3 text-center font-bold ${item.quantity_received >= item.quantity_ordered ? 'text-green-400' : 'text-yellow-400'}`}>
                                                {parseFloat(item.quantity_received)}
                                            </td>
                                            <td className="py-3 text-right text-textMuted">${parseFloat(item.unit_price).toFixed(2)}</td>
                                            <td className="py-3 text-right font-mono text-accent">${parseFloat(item.total_price).toFixed(2)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-white/10">
                            <div className="flex space-x-3">
                                {viewOrder.status === 'draft' && (
                                    <>
                                        <button 
                                            onClick={() => setConfirmAction({ open: true, order: viewOrder, type: 'confirm' })} 
                                            className="px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 rounded-lg flex items-center space-x-2 transition-colors"
                                        >
                                            <FiCheckCircle /> <span>Confirm Order</span>
                                        </button>
                                        <button 
                                            onClick={() => setConfirmAction({ open: true, order: viewOrder, type: 'cancel' })} 
                                            className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 rounded-lg flex items-center space-x-2 transition-colors"
                                        >
                                            <FiXCircle /> <span>Cancel Order</span>
                                        </button>
                                    </>
                                )}
                            </div>
                            <button onClick={() => setViewOrder(null)} className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <ConfirmModal 
                isOpen={confirmAction.open}
                title={`${confirmAction.type === 'confirm' ? 'Confirm' : 'Cancel'} Purchase Order`}
                message={`Are you sure you want to ${confirmAction.type} PO: ${confirmAction.order?.po_number}?`}
                onConfirm={handleConfirmAction}
                onCancel={() => setConfirmAction({ open: false, order: null, type: null })}
                confirmText={confirmAction.type === 'confirm' ? 'Yes, Confirm' : 'Yes, Cancel'}
                isDestructive={confirmAction.type === 'cancel'}
            />
        </div>
    );
};

export default PurchaseOrders;
