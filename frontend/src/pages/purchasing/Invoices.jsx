import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiDollarSign, FiEye, FiCheckCircle, FiX } from 'react-icons/fi';
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

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm({
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
        const remaining = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || 0);
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
            accessorFn: row => `${settings?.currency || '$'}${(parseFloat(row.total_amount) - parseFloat(row.paid_amount || 0)).toFixed(2)}`,
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
            {isPaymentModalOpen && invoiceToPay && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={() => setIsPaymentModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-lg overflow-hidden transform transition-all shadow-2xl shadow-green-500/10">
                        {/* Decorative Header Background */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/20 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
                        
                        <div className="p-8 relative z-10">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <h2 className="text-2xl font-black text-white tracking-tight flex items-center">
                                        <FiDollarSign className="text-green-400 mr-2" /> Record Payment
                                    </h2>
                                    <p className="text-textMuted mt-1">
                                        Paying Invoice: <span className="text-white font-mono bg-white/5 py-0.5 px-2 rounded ml-1">{invoiceToPay.invoice_number}</span>
                                    </p>
                                </div>
                                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 text-textMuted hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="bg-[#0f172a]/80 border border-white/5 rounded-2xl p-4 mb-6 flex justify-between items-center shadow-inner">
                                <div>
                                    <p className="text-textMuted text-xs font-medium uppercase tracking-wider mb-1">Current Balance Due</p>
                                    <p className="text-2xl font-mono font-bold text-red-400">
                                        {settings?.currency || '$'}{(parseFloat(invoiceToPay.total_amount) - parseFloat(invoiceToPay.paid_amount || 0)).toFixed(2)}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-textMuted text-xs font-medium uppercase tracking-wider mb-1">Total Invoice</p>
                                    <p className="text-white font-mono">{settings?.currency || '$'}{parseFloat(invoiceToPay.total_amount).toFixed(2)}</p>
                                </div>
                            </div>
                            
                            <form onSubmit={handleSubmit(onPaymentSubmit)} className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-2">Payment Amount ({settings?.currency || '$'}) *</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 font-bold">{settings?.currency || '$'}</span>
                                        <input type="number" step="0.01" {...register('amount_paid')} className="w-full bg-[#0f172a] border-2 border-green-500/30 text-white rounded-xl py-3 pl-16 pr-4 focus:ring-2 focus:ring-green-500/50 focus:border-green-500 text-xl font-mono font-bold transition-all shadow-inner" />
                                    </div>
                                    {errors.amount_paid && <span className="text-red-400 text-xs mt-1 block">{errors.amount_paid.message}</span>}
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold text-white/90 mb-2">Payment Method</label>
                                        <select {...register('payment_method')} className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all">
                                            <option value="cash">Cash</option>
                                            <option value="bank_transfer">Bank Transfer</option>
                                            <option value="instapay">InstaPay</option>
                                            <option value="check">Check</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-white/90 mb-2">Transaction Ref</label>
                                        <input {...register('reference')} placeholder="e.g. TR-99381" className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all placeholder:text-gray-600" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-white/90 mb-2">Internal Notes</label>
                                    <textarea {...register('notes')} placeholder="Optional notes about this payment..." className="w-full bg-[#0f172a] border border-white/10 text-white rounded-xl py-3 px-4 focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none placeholder:text-gray-600" rows="2"></textarea>
                                </div>

                                <div className="flex justify-end space-x-3 pt-6 mt-4">
                                    <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="px-5 py-3 rounded-xl font-medium text-white bg-white/5 hover:bg-white/10 transition-colors w-1/3">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isSubmitting} className="w-2/3 px-5 py-3 rounded-xl font-bold tracking-wide text-gray-900 bg-green-500 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all flex justify-center items-center disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* View Invoice Modal - Redesigned */}
            {viewInvoice && (
                <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewInvoice(null)}></div>
                    <div className="relative glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50">
                        
                        {/* Header */}
                        <div className="p-6 border-b border-white/10 bg-[#0f172a] relative overflow-hidden">
                            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${viewInvoice.status === 'paid' ? 'bg-green-500' : viewInvoice.status === 'partially_paid' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                            
                            <div className="relative z-10 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center space-x-3 mb-2">
                                        <h2 className="text-3xl font-black text-white tracking-tight">{viewInvoice.invoice_number}</h2>
                                        <span className={`px-3 py-1 rounded-md text-xs font-black uppercase tracking-widest ${
                                            viewInvoice.status === 'paid' ? 'bg-green-500 text-gray-900 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 
                                            viewInvoice.status === 'partially_paid' ? 'bg-yellow-500 text-gray-900 shadow-[0_0_15px_rgba(234,179,8,0.3)]' : 
                                            'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                                        }`}>
                                            {viewInvoice.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="text-textMuted flex items-center">
                                        Supplier: <span className="text-white font-bold ml-2">{viewInvoice.supplier_name}</span>
                                    </p>
                                </div>
                                <button onClick={() => setViewInvoice(null)} className="text-textMuted hover:text-white transition-colors bg-white/5 p-2 rounded-lg">
                                    <FiX className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Body */}
                        <div className="p-6 flex-1 overflow-y-auto bg-[#16213e] custom-scrollbar">
                            
                            {/* Financial Summary */}
                            <div className="grid grid-cols-3 gap-4 mb-8">
                                <div className="bg-[#1e293b]/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-center">
                                    <p className="text-sm text-textMuted font-medium mb-1">Total Billed</p>
                                    <p className="text-3xl font-mono text-white tracking-tight">{settings?.currency || '$'}{parseFloat(viewInvoice.total_amount).toFixed(2)}</p>
                                </div>
                                <div className="bg-[#1e293b]/80 p-5 rounded-2xl border border-white/5 flex flex-col justify-center">
                                    <p className="text-sm text-textMuted font-medium mb-1">Amount Paid</p>
                                    <p className="text-3xl font-mono text-green-400 tracking-tight">{settings?.currency || '$'}{parseFloat(viewInvoice.paid_amount || 0).toFixed(2)}</p>
                                </div>
                                <div className={`p-5 rounded-2xl border flex flex-col justify-center ${viewInvoice.status === 'paid' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/30 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]'}`}>
                                    <p className={`text-sm font-medium mb-1 ${viewInvoice.status === 'paid' ? 'text-green-400' : 'text-red-400'}`}>Balance Remaining</p>
                                    <p className={`text-3xl font-mono font-black tracking-tight ${viewInvoice.status === 'paid' ? 'text-green-400' : 'text-red-400'}`}>
                                        {settings?.currency || '$'}{(parseFloat(viewInvoice.total_amount) - parseFloat(viewInvoice.paid_amount || 0)).toFixed(2)}
                                    </p>
                                </div>
                            </div>
                            
                            {/* Action Row */}
                            {viewInvoice.status !== 'paid' && (
                                <div className="mb-8 flex justify-end">
                                    <button 
                                        onClick={() => {
                                            setViewInvoice(null);
                                            setInvoiceToPay(viewInvoice);
                                            setIsPaymentModalOpen(true);
                                        }}
                                        className="bg-green-500 hover:bg-green-400 text-gray-900 px-6 py-3 rounded-xl font-bold transition-all shadow-lg shadow-green-500/25 flex items-center space-x-2"
                                    >
                                        <FiDollarSign className="w-5 h-5" />
                                        <span>Record New Payment</span>
                                    </button>
                                </div>
                            )}

                            {/* Payment Timeline */}
                            <div>
                                <h3 className="text-lg font-bold text-white mb-4 flex items-center">
                                    <FiCheckCircle className="mr-2 text-primary" /> Payment History Timeline
                                </h3>
                                
                                {viewInvoice.payments?.length > 0 ? (
                                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
                                        {viewInvoice.payments.map((payment, idx) => (
                                            <div key={payment.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                                {/* Timeline dot */}
                                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/20 bg-[#1e293b] text-primary shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                                    <FiDollarSign className="w-4 h-4" />
                                                </div>
                                                
                                                {/* Card */}
                                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] glass-panel p-4 rounded-xl border border-white/5 hover:border-primary/30 transition-colors">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <span className="text-white font-bold text-lg font-mono tracking-tight">+{settings?.currency || '$'}{parseFloat(payment.amount).toFixed(2)}</span>
                                                        <span className="text-[10px] font-bold text-textMuted bg-white/5 px-2 py-1 rounded uppercase tracking-wider border border-white/5">{payment.payment_method.replace('_', ' ')}</span>
                                                    </div>
                                                    <p className="text-xs text-textMuted mb-2">{new Date(payment.payment_date).toLocaleString()}</p>
                                                    
                                                    {(payment.reference || payment.notes) && (
                                                        <div className="text-xs border-t border-white/5 pt-2 mt-2">
                                                            {payment.reference && <p><span className="text-textMuted">Ref:</span> <span className="text-white font-mono">{payment.reference}</span></p>}
                                                            {payment.notes && <p className="text-textMuted italic mt-1">{payment.notes}</p>}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 bg-white/5 border border-dashed border-white/10 rounded-xl">
                                        <p className="text-textMuted">No payments recorded yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};

export default Invoices;
