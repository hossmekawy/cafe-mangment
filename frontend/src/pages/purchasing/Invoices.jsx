import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiDollarSign, FiEye } from 'react-icons/fi';
import ConfirmModal from '../../components/ConfirmModal';
import DataTable from '../../components/DataTable';
import { purchasingApi } from '../../api/purchasingApi';
import useSettingsStore from '../../store/settingsStore';

const paymentSchema = yup.object().shape({
    amount_paid: yup.number().min(0.01, 'Must be > 0').required('Required'),
    payment_method: yup.string().required('Required'),
    reference: yup.string(),
    notes: yup.string()
});

const Invoices = () => {
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modals
    const [viewInvoice, setViewInvoice] = useState(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [invoiceToPay, setInvoiceToPay] = useState(null);

    const { settings } = useSettingsStore();

    const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm({
        resolver: yupResolver(paymentSchema)
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const res = await purchasingApi.getInvoices();
            setInvoices(res.data);
        } catch (error) {
            toast.error('Failed to load invoices');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openPaymentModal = (invoice) => {
        setInvoiceToPay(invoice);
        // Pre-fill with remaining amount
        const remaining = parseFloat(invoice.total_amount) - parseFloat(invoice.amount_paid);
        reset({
            amount_paid: remaining,
            payment_method: 'bank_transfer',
            reference: '',
            notes: ''
        });
        setIsPaymentModalOpen(true);
    };

    const onPaymentSubmit = async (data) => {
        try {
            await purchasingApi.payInvoice(invoiceToPay.id, data);
            toast.success('Payment recorded successfully!');
            setIsPaymentModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error(error.response?.data?.error || 'Failed to record payment');
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Invoice #',
            accessorKey: 'invoice_number',
            cell: info => <span className="font-semibold text-primary">{info.getValue()}</span>
        },
        {
            header: 'Supplier',
            accessorKey: 'supplier_name',
        },
        {
            header: 'Generated Date',
            accessorFn: row => new Date(row.invoice_date).toLocaleDateString(),
        },
        {
            header: 'Total Amount',
            accessorFn: row => `${settings?.currency || '$'}${parseFloat(row.total_amount).toFixed(2)}`,
            cell: info => <span className="font-mono">{info.getValue()}</span>
        },
        {
            header: 'Balance Due',
            accessorFn: row => `${settings?.currency || '$'}${(parseFloat(row.total_amount) - parseFloat(row.amount_paid)).toFixed(2)}`,
            cell: info => {
                // Must extract just the number to evaluate if balance is zero
                const balanceStr = info.getValue().replace(settings?.currency || '$', '');
                const balance = parseFloat(balanceStr);
                return <span className={`font-mono font-bold ${balance <= 0 ? 'text-green-400' : 'text-red-400'}`}>{info.getValue()}</span>
            }
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: info => {
                const status = info.getValue();
                const colors = {
                    'pending': 'bg-red-500/20 text-red-400',
                    'partially_paid': 'bg-yellow-500/20 text-yellow-400',
                    'paid': 'bg-green-500/20 text-green-400'
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
                <div className="flex space-x-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setViewInvoice(info.row.original); }}
                        className="p-1.5 bg-white/5 text-white rounded hover:bg-white/10 transition-colors"
                        title="View Details"
                    >
                        <FiEye className="w-4 h-4" />
                    </button>
                    {info.row.original.status !== 'paid' && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); openPaymentModal(info.row.original); }}
                            className="p-1.5 bg-green-500/20 text-green-400 rounded hover:bg-green-500/30 transition-colors"
                            title="Record Payment"
                        >
                            <FiDollarSign className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )
        }
    ], [settings]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Supplier Invoices</h1>
                    <p className="text-textMuted text-sm">Automatically generated from completed GRNs</p>
                </div>
            </div>

            <DataTable 
                columns={columns} 
                data={invoices} 
                isLoading={isLoading}
                searchPlaceholder="Search invoices..."
            />

            {/* Pay Invoice Modal */}
            {isPaymentModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-white mb-2">Record Payment</h2>
                        <p className="text-textMuted text-sm mb-6">Paying Invoice: <span className="text-primary font-mono">{invoiceToPay?.invoice_number}</span></p>
                        
                        <form onSubmit={handleSubmit(onPaymentSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Amount to Pay ({settings?.currency || '$'}) *</label>
                                <input type="number" step="0.01" {...register('amount_paid')} className="form-input text-2xl font-mono text-green-400 font-bold" />
                                {errors.amount_paid && <span className="text-red-400 text-xs">{errors.amount_paid.message}</span>}
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Payment Method</label>
                                <select {...register('payment_method')} className="form-input">
                                    <option value="cash">Cash</option>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="credit_card">Credit Card</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Transaction Ref / Cheque #</label>
                                <input {...register('reference')} className="form-input" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Internal Notes</label>
                                <textarea {...register('notes')} className="form-input" rows="2"></textarea>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10 mt-6">
                                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-green-500/20 text-green-500 hover:bg-green-500/30 border border-green-500/30 px-6 py-2 rounded-lg transition-colors font-medium">
                                    Submit Payment
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* View Invoice Modal */}
            {viewInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewInvoice(null)}></div>
                    <div className="relative glass-panel w-full max-w-3xl p-6">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">{viewInvoice.invoice_number}</h2>
                                <p className="text-textMuted mt-1">Supplier: <span className="text-white font-medium">{viewInvoice.supplier_name}</span></p>
                            </div>
                            <span className={`px-3 py-1 rounded-full uppercase tracking-wider text-xs font-bold ${viewInvoice.status === 'paid' ? 'bg-green-500/20 text-green-400' : viewInvoice.status === 'partially_paid' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                {viewInvoice.status.replace('_', ' ')}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="glass-panel p-4">
                                <p className="text-sm text-textMuted mb-1">Total Billed</p>
                                <p className="text-2xl font-mono text-white">{settings?.currency || '$'}{parseFloat(viewInvoice.total_amount).toFixed(2)}</p>
                            </div>
                            <div className="glass-panel p-4 border border-red-500/20">
                                <p className="text-sm text-red-400 mb-1">Balance Remaining</p>
                                <p className="text-2xl font-mono text-red-400 font-bold">{settings?.currency || '$'}{(parseFloat(viewInvoice.total_amount) - parseFloat(viewInvoice.amount_paid)).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="border border-white/10 rounded-lg overflow-hidden mb-6">
                            <div className="bg-white/5 px-4 py-2 border-b border-white/10">
                                <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Payment History</h3>
                            </div>
                            {viewInvoice.payments?.length > 0 ? (
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#16213e]">
                                        <tr className="border-b border-white/10 text-textMuted font-medium">
                                            <th className="px-4 py-2">Date</th>
                                            <th className="px-4 py-2">Method</th>
                                            <th className="px-4 py-2">Reference</th>
                                            <th className="px-4 py-2 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {viewInvoice.payments.map(payment => (
                                            <tr key={payment.id} className="hover:bg-white/5">
                                                <td className="px-4 py-3 text-textMuted">{new Date(payment.payment_date).toLocaleDateString()}</td>
                                                <td className="px-4 py-3 uppercase text-xs tracking-wider">{payment.payment_method.replace('_', ' ')}</td>
                                                <td className="px-4 py-3 text-textMuted">{payment.reference || '-'}</td>
                                                <td className="px-4 py-3 text-right font-mono text-green-400">{settings?.currency || '$'}{parseFloat(payment.amount_paid).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="p-4 text-center text-textMuted text-sm">No payments recorded yet.</div>
                            )}
                        </div>

                        <div className="flex justify-end pt-4 border-t border-white/10">
                            <button onClick={() => setViewInvoice(null)} className="px-5 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
