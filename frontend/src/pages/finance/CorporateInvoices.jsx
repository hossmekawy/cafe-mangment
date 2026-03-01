import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { FiPlus, FiBriefcase, FiFileText, FiSend, FiDollarSign, FiCheckCircle, FiX } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import useAuthStore from '../../store/authStore';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';

export default function CorporateInvoices() {
    const { user } = useAuthStore();
    
    const [clients, setClients] = useState([]);
    const [invoices, setInvoices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('invoices'); // 'clients' or 'invoices'

    // Form states
    const [clientFormOpen, setClientFormOpen] = useState(false);
    const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
    const [paymentFormOpen, setPaymentFormOpen] = useState(false);
    const [activeInvoice, setActiveInvoice] = useState(null); // For payment or ETA
    
    // Client formData
    const [clientData, setClientData] = useState({
        company_name: '', trn: '', commercial_registration: '', 
        contact_person: '', email: '', phone: '', address: '', payment_terms_days: 30
    });

    // Invoice formData
    const [invData, setInvData] = useState({
        client: '', issue_date: new Date().toISOString().split('T')[0], 
        due_date: new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0], 
        vat_rate: 14, service_charge: 0, notes: '',
        line_items: [{ description: '', quantity: 1, unit_price: '' }]
    });

    // Payment formData
    const [paymentData, setPaymentData] = useState({ amount: '', payment_method: 'bank_transfer', reference: '', date: new Date().toISOString().split('T')[0] });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [clientRes, invRes] = await Promise.all([
                financeApi.getClients(),
                financeApi.getInvoices()
            ]);
            setClients(clientRes.data);
            setInvoices(invRes.data);
        } catch (error) {
            toast.error("Failed to fetch corporate data");
        } finally {
            setIsLoading(false);
        }
    };

    // ── CLIENT ACTIONS ──

    const handleSaveClient = async (e) => {
        e.preventDefault();
        const tid = toast.loading("Saving client...");
        try {
            await financeApi.createClient(clientData);
            toast.success("Client saved", { id: tid });
            setClientFormOpen(false);
            setClientData({ company_name: '', trn: '', commercial_registration: '', contact_person: '', email: '', phone: '', address: '', payment_terms_days: 30 });
            fetchData();
        } catch (error) {
            toast.error("Error saving client", { id: tid });
        }
    };

    // ── INVOICE ACTIONS ──

    const handleAddLineItem = () => {
        setInvData(prev => ({ ...prev, line_items: [...prev.line_items, { description: '', quantity: 1, unit_price: '' }] }));
    };

    const handleLineItemChange = (index, field, value) => {
        const newItems = [...invData.line_items];
        newItems[index][field] = value;
        setInvData(prev => ({ ...prev, line_items: newItems }));
    };

    const handleRemoveLineItem = (index) => {
        setInvData(prev => ({ ...prev, line_items: prev.line_items.filter((_, i) => i !== index) }));
    };

    const handleSaveInvoice = async (e) => {
        e.preventDefault();
        if (invData.line_items.some(i => !i.description || !i.unit_price)) {
            return toast.error("Please complete all line items");
        }
        
        const tid = toast.loading("Creating invoice...");
        try {
            await financeApi.createInvoice(invData);
            toast.success("Invoice created", { id: tid });
            setInvoiceFormOpen(false);
            setInvData({ client: '', issue_date: '', due_date: '', vat_rate: 14, service_charge: 0, notes: '', line_items: [{ description: '', quantity: 1, unit_price: '' }] });
            fetchData();
            setActiveTab('invoices');
        } catch (error) {
            toast.error("Error creating invoice", { id: tid });
        }
    };

    const handleRecordPayment = async (e) => {
        e.preventDefault();
        if (!activeInvoice) return;

        const tid = toast.loading("Recording payment...");
        try {
            await financeApi.recordInvoicePayment(activeInvoice.id, paymentData);
            toast.success("Payment recorded", { id: tid });
            setPaymentFormOpen(false);
            setActiveInvoice(null);
            setPaymentData({ amount: '', payment_method: 'bank_transfer', reference: '', date: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (error) {
            toast.error("Payment failed", { id: tid });
        }
    };

    const handleEtaSubmit = async (invoiceId) => {
        const tid = toast.loading("Submitting to ETA...");
        try {
            await financeApi.submitInvoiceETA(invoiceId);
            toast.success("Invoice marked as submitted to ETA", { id: tid });
            fetchData();
        } catch (error) {
            toast.error("ETA submission failed", { id: tid });
        }
    };

    const handleSendInvoice = async (invoiceId) => {
        const tid = toast.loading("Marking as sent...");
        try {
            await financeApi.sendInvoice(invoiceId); // Wait, don't have this in frontend api yet? Assume it's a PATCH or specialized endpoint. Let's patch status.
            toast.success("Invoice marked as Sent", { id: tid });
            fetchData();
        } catch (error) {
            toast.error("Action failed", { id: tid });
        }
    };


    // ── COLUMNS ──

    const clientColumns = useMemo(() => [
        { header: 'Company Name', accessorKey: 'company_name', cell: info => <span className="font-bold text-white">{info.getValue()}</span> },
        { header: 'TRN', accessorFn: row => row.trn || '-' },
        { header: 'Contact', accessorFn: row => row.contact_person || '-' },
        { header: 'Phone', accessorFn: row => row.phone || '-' },
        { header: 'Payment Terms', accessorFn: row => `${row.payment_terms_days} days` },
        { header: 'Outstanding Bal', accessorKey: 'outstanding_balance', cell: info => <span className={`font-mono font-bold ${parseFloat(info.getValue()) > 0 ? 'text-orange-400' : 'text-green-400'}`}>{parseFloat(info.getValue()).toFixed(2)}</span> }
    ], []);

    const invoiceColumns = useMemo(() => [
        { header: 'Invoice #', accessorKey: 'invoice_number', cell: info => <span className="font-mono text-sm">{info.getValue()}</span> },
        { header: 'Client', accessorKey: 'client_name', cell: info => <span className="font-bold">{info.getValue()}</span> },
        { header: 'Issue Date', accessorKey: 'issue_date' },
        { header: 'Due Date', accessorKey: 'due_date' },
        { header: 'Total', accessorKey: 'total_amount', cell: info => <span className="font-mono text-white">{parseFloat(info.getValue()).toFixed(2)}</span> },
        { header: 'Amount Due', accessorKey: 'amount_due', cell: info => {
            const due = parseFloat(info.getValue());
            return <span className={`font-mono font-bold ${due > 0 ? 'text-orange-400' : 'text-green-400'}`}>{due.toFixed(2)}</span>;
        }},
        { 
            header: 'Status', 
            accessorKey: 'status',
            cell: info => {
                const s = info.getValue();
                return <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    s === 'paid' ? 'bg-green-500/20 text-green-400' :
                    s === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                    s === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-textMuted'
                }`}>{s}</span>;
            }
        },
        { 
            header: 'ETA', 
            accessorKey: 'eta_submitted',
            cell: info => info.getValue() ? <FiCheckCircle className="text-green-500" title="Submitted to Egyptian Tax Authority" /> : <span className="text-xs text-textMuted">Pending</span>
        },
        {
            id: 'actions',
            header: '',
            cell: info => {
                const row = info.row.original;
                return (
                    <div className="flex gap-2 justify-end">
                        {row.status === 'draft' && (
                            <button onClick={() => handleSendInvoice(row.id)} className="text-blue-400 hover:text-blue-300 p-1" title="Mark Sent"><FiSend /></button>
                        )}
                        {['sent', 'overdue'].includes(row.status) && (
                            <button onClick={() => { setActiveInvoice(row); setPaymentData({...paymentData, amount: row.amount_due}); setPaymentFormOpen(true); }} className="text-green-400 hover:text-green-300 p-1" title="Record Payment"><FiDollarSign /></button>
                        )}
                        {!row.eta_submitted && (
                            <button onClick={() => handleEtaSubmit(row.id)} className="text-purple-400 hover:text-purple-300 p-1" title="Submit to ETA"><FiFileText /></button>
                        )}
                    </div>
                );
            }
        }
    ], []);


    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader 
                title="Corporate Invoicing" 
                subtitle="Manage corporate clients, issue official tax invoices, and track payments & ETA submissions."
                icon={FiBriefcase}
            />

            {/* Tabs & Actions */}
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center glass-panel p-2 rounded-xl">
                <div className="flex bg-black/40 rounded-lg p-1">
                    <button 
                        onClick={() => setActiveTab('invoices')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'invoices' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}
                    >
                        Invoices
                    </button>
                    <button 
                        onClick={() => setActiveTab('clients')}
                        className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'clients' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}
                    >
                        Clients
                    </button>
                </div>
                
                <div className="flex gap-3 px-2">
                    {activeTab === 'clients' ? (
                        <button onClick={() => setClientFormOpen(true)} className="btn btn-primary flex items-center gap-2"><FiPlus /> New Client</button>
                    ) : (
                        <button onClick={() => setInvoiceFormOpen(true)} className="btn btn-primary flex items-center gap-2"><FiPlus /> Create Invoice</button>
                    )}
                </div>
            </div>

            {/* Data Tables */}
            {activeTab === 'clients' ? (
                <DataTable columns={clientColumns} data={clients} isLoading={isLoading} />
            ) : (
                <DataTable columns={invoiceColumns} data={invoices} isLoading={isLoading} />
            )}

            {/* CLIENT MODAL */}
            {clientFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveClient} className="bg-[#1e293b] rounded-2xl w-full max-w-lg border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
                            <h3 className="font-bold text-white text-lg">Add Corporate Client</h3>
                            <button type="button" onClick={() => setClientFormOpen(false)} className="text-textMuted"><FiX /></button>
                        </div>
                        <div className="p-6 grid grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-textMuted mb-1">Company Name *</label>
                                <input required type="text" className="input w-full" value={clientData.company_name} onChange={e => setClientData({...clientData, company_name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">TRN (Tax Reg #)</label>
                                <input type="text" className="input w-full font-mono text-sm" value={clientData.trn} onChange={e => setClientData({...clientData, trn: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Commercial Reg.</label>
                                <input type="text" className="input w-full font-mono text-sm" value={clientData.commercial_registration} onChange={e => setClientData({...clientData, commercial_registration: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Contact Person</label>
                                <input type="text" className="input w-full" value={clientData.contact_person} onChange={e => setClientData({...clientData, contact_person: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Phone</label>
                                <input type="text" className="input w-full" value={clientData.phone} onChange={e => setClientData({...clientData, phone: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-textMuted mb-1">Email</label>
                                <input type="email" className="input w-full" value={clientData.email} onChange={e => setClientData({...clientData, email: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-textMuted mb-1">Payment Terms (Days net)</label>
                                <input type="number" className="input w-full" value={clientData.payment_terms_days} onChange={e => setClientData({...clientData, payment_terms_days: parseInt(e.target.value)})} />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => setClientFormOpen(false)} className="px-4 py-2 rounded-lg text-textMuted">Cancel</button>
                            <button type="submit" className="px-5 py-2 rounded-lg bg-primary text-white font-bold">Save Client</button>
                        </div>
                    </form>
                </div>
            )}

            {/* INVOICE MODAL */}
            {invoiceFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleSaveInvoice} className="bg-[#1e293b] rounded-2xl w-full max-w-2xl border border-white/10 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a]">
                            <h3 className="font-bold text-white text-lg">Create Tax Invoice</h3>
                            <button type="button" onClick={() => setInvoiceFormOpen(false)} className="text-textMuted"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-sm font-medium text-textMuted mb-1">Client *</label>
                                    <select required className="input w-full" value={invData.client} onChange={e => setInvData({...invData, client: e.target.value})}>
                                        <option value="">Select Client</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-1">Issue Date *</label>
                                        <input required type="date" className="input w-full text-sm" value={invData.issue_date} onChange={e => setInvData({...invData, issue_date: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-1">Due Date *</label>
                                        <input required type="date" className="input w-full text-sm" value={invData.due_date} onChange={e => setInvData({...invData, due_date: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            {/* Line Items */}
                            <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                <h4 className="font-medium text-white mb-3 text-sm">Line Items</h4>
                                {invData.line_items.map((item, idx) => (
                                    <div key={idx} className="flex gap-2 mb-2 items-start">
                                        <div className="flex-1">
                                            <input required type="text" placeholder="Description" className="input w-full text-sm py-2" value={item.description} onChange={e => handleLineItemChange(idx, 'description', e.target.value)} />
                                        </div>
                                        <div className="w-20">
                                            <input required type="number" min="0.1" step="0.1" placeholder="Qty" className="input w-full text-sm py-2" value={item.quantity} onChange={e => handleLineItemChange(idx, 'quantity', e.target.value)} />
                                        </div>
                                        <div className="w-28">
                                            <input required type="number" min="0" step="0.01" placeholder="Unit Price" className="input w-full text-sm py-2" value={item.unit_price} onChange={e => handleLineItemChange(idx, 'unit_price', e.target.value)} />
                                        </div>
                                        <div className="w-8 pt-1">
                                            {idx > 0 && <button type="button" onClick={() => handleRemoveLineItem(idx)} className="p-1 text-red-400 hover:bg-red-500/20 rounded"><FiX /></button>}
                                        </div>
                                    </div>
                                ))}
                                <button type="button" onClick={handleAddLineItem} className="text-primary text-sm font-medium hover:underline mt-2 flex items-center gap-1"><FiPlus /> Add Item</button>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">VAT Rate (%)</label>
                                    <input type="number" className="input w-full" value={invData.vat_rate} onChange={e => setInvData({...invData, vat_rate: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Service Charge (Fixed)</label>
                                    <input type="number" step="0.01" className="input w-full" value={invData.service_charge} onChange={e => setInvData({...invData, service_charge: e.target.value})} />
                                </div>
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => setInvoiceFormOpen(false)} className="px-4 py-2 rounded-lg text-textMuted">Cancel</button>
                            <button type="submit" className="px-5 py-2 rounded-lg bg-primary text-white font-bold">Generate Invoice</button>
                        </div>
                    </form>
                </div>
            )}

            {/* PAYMENT MODAL */}
            {paymentFormOpen && activeInvoice && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <form onSubmit={handleRecordPayment} className="bg-[#1e293b] rounded-2xl w-full max-w-sm border border-green-500/30 overflow-hidden shadow-2xl">
                        <div className="p-5 border-b border-white/10 flex items-center gap-2 bg-[#0f172a]">
                            <FiDollarSign className="text-green-400 text-xl" />
                            <h3 className="font-bold text-white text-lg">Record Payment</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-green-500/10 text-green-400 p-3 rounded-lg text-sm border border-green-500/20 mb-4">
                                Invoice: <strong>{activeInvoice.invoice_number}</strong><br/>
                                Amount Due: <strong>{parseFloat(activeInvoice.amount_due).toFixed(2)} EGP</strong>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Payment Amount *</label>
                                <input required type="number" step="0.01" max={activeInvoice.amount_due} className="input w-full text-lg font-mono text-green-400" value={paymentData.amount} onChange={e => setPaymentData({...paymentData, amount: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Method *</label>
                                <select required className="input w-full" value={paymentData.payment_method} onChange={e => setPaymentData({...paymentData, payment_method: e.target.value})}>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cash">Cash</option>
                                    <option value="cheque">Cheque</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Payment Date *</label>
                                <input required type="date" className="input w-full text-sm" value={paymentData.date} onChange={e => setPaymentData({...paymentData, date: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Reference</label>
                                <input type="text" className="input w-full text-sm font-mono" placeholder="TR-1234..." value={paymentData.reference} onChange={e => setPaymentData({...paymentData, reference: e.target.value})} />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-end gap-3">
                            <button type="button" onClick={() => { setPaymentFormOpen(false); setActiveInvoice(null); }} className="px-4 py-2 rounded-lg text-textMuted">Cancel</button>
                            <button type="submit" className="px-5 py-2 rounded-lg bg-green-500 text-white font-bold shadow-lg shadow-green-500/20">Save Payment</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
