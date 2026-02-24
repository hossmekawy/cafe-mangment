import React, { useState, useEffect } from 'react';
import { financeApi } from '../../api/financeApi';
import { toast } from 'react-hot-toast';
import PageHeader from '../../components/PageHeader';
import DataTable from '../../components/DataTable';
import { FiClock, FiActivity, FiPrinter, FiEye, FiArrowLeft, FiDollarSign, FiUsers } from 'react-icons/fi';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import useAuthStore from '../../store/authStore';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function ShiftManagement() {
    const { user } = useAuthStore();
    const [shifts, setShifts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');

    // Detail View
    const [selectedShift, setSelectedShift] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [transactions, setTransactions] = useState([]);
    const [movements, setMovements] = useState([]);
    const [expenses, setExpenses] = useState([]);

    useEffect(() => {
        if (!selectedShift) {
            fetchShifts();
        }
    }, [statusFilter, dateFilter, selectedShift]);

    const fetchShifts = async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;
            if (dateFilter) params.date = dateFilter;
            const res = await financeApi.getShifts(params);
            setShifts(res.data);
        } catch (error) {
            toast.error("Failed to load shifts");
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = async (shift) => {
        setSelectedShift(shift);
        try {
            const [analyticsRes, txRes, moveRes, expRes] = await Promise.all([
                financeApi.getShiftAnalytics(shift.id),
                financeApi.getTransactions({ shift: shift.id }),
                financeApi.getCashMovements({ shift: shift.id }),
                financeApi.getExpenses({ shift: shift.id })
            ]);
            setAnalytics(analyticsRes.data);
            setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data?.results || []);
            setMovements(moveRes.data);
            setExpenses(Array.isArray(expRes.data) ? expRes.data : expRes.data?.results || []);
        } catch (error) {
            toast.error("Failed to load shift details");
        }
    };

    const handlePrintZReport = () => {
        const printWindow = window.open('', '_blank');
        const content = document.getElementById('z-report-print-area').innerHTML;
        printWindow.document.write(`
            <html>
                <head>
                    <title>Z-Report - Shift #${selectedShift.shift_number}</title>
                    <style>
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { font-family: 'Courier New', monospace; padding: 10px; max-width: 400px; margin: 0 auto; font-size: 12px; color: #000; }
                        h2 { text-align: center; font-size: 16px; margin-bottom: 4px; }
                        h3 { text-align: center; font-size: 13px; margin-bottom: 8px; }
                        .section-title { font-weight: bold; font-size: 13px; margin: 12px 0 6px; border-bottom: 1px solid #000; padding-bottom: 3px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 3px; }
                        .row.bold { font-weight: bold; }
                        hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
                        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 11px; }
                        th, td { text-align: left; padding: 2px 4px; border-bottom: 1px dotted #ccc; }
                        th { font-weight: bold; border-bottom: 1px solid #000; }
                        td.num { text-align: right; }
                        th.num { text-align: right; }
                        .sig-block { margin-top: 30px; text-align: center; }
                        .sig-line { margin-top: 25px; border-bottom: 1px solid #000; width: 200px; display: inline-block; }
                        .no-data { text-align: center; color: #888; padding: 6px; font-style: italic; }
                        @media print { body { width: 100%; } }
                    </style>
                </head>
                <body>${content}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    };

    if (selectedShift) {
        return (
            <div className="p-6 space-y-6 animate-fade-in relative">
                <button onClick={() => setSelectedShift(null)} className="btn bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 px-4 py-2 border border-white/10 rounded-lg">
                    <FiArrowLeft /> Back to Shifts
                </button>

                <div className="flex justify-between items-center">
                    <PageHeader title={`Shift Details: #${selectedShift.shift_number}`} subtitle={new Date(selectedShift.opened_at).toLocaleString()} icon={FiActivity} />
                    <button onClick={handlePrintZReport} className="btn bg-primary hover:bg-primary/90 text-white flex items-center gap-2">
                        <FiPrinter /> Print Z-Report
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass-panel p-5 border-l-4 border-primary">
                        <p className="text-textMuted text-sm font-medium">Cashier(s)</p>
                        <p className="text-lg font-bold text-white mt-1 truncate">
                            {selectedShift.cashier_name}
                            {selectedShift.assigned_users && selectedShift.assigned_users.length > 0 && ` + ${selectedShift.assigned_users.length}`}
                        </p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-green-500">
                        <p className="text-textMuted text-sm font-medium">Status</p>
                        <p className={`text-xl font-bold mt-1 ${selectedShift.status === 'open' ? 'text-green-400' : 'text-textMuted'}`}>
                            {selectedShift.status.toUpperCase()}
                        </p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-orange-500">
                        <p className="text-textMuted text-sm font-medium">Expected Closing</p>
                        <p className="text-xl font-bold text-white mt-1">{parseFloat(selectedShift.expected_closing_cash || 0).toFixed(2)} EGP</p>
                    </div>
                    <div className="glass-panel p-5 border-l-4 border-red-500">
                        <p className="text-textMuted text-sm font-medium">Discrepancy</p>
                        <p className={`text-xl font-bold mt-1 ${parseFloat(selectedShift.discrepancy || 0) < 0 ? 'text-red-400' : parseFloat(selectedShift.discrepancy || 0) > 0 ? 'text-green-400' : 'text-white'}`}>
                            {parseFloat(selectedShift.discrepancy || 0).toFixed(2)} EGP
                        </p>
                    </div>
                </div>

                {/* Analytics */}
                {analytics && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="glass-panel p-6 min-h-[300px]">
                            <h3 className="text-lg font-bold text-white mb-4">Peak Time Analysis</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={analytics.peak_time.map(pt => ({ hour: `${new Date(pt.hour).getHours()}:00`, volume: parseFloat(pt.volume) }))}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis dataKey="hour" stroke="#888" />
                                    <YAxis stroke="#888" />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                    <Line type="monotone" dataKey="volume" stroke="#3b82f6" strokeWidth={3} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="glass-panel p-6 min-h-[300px]">
                            <h3 className="text-lg font-bold text-white mb-4">User Contribution</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={analytics.user_contribution} dataKey="contribution" nameKey="cashier__name" cx="50%" cy="50%" outerRadius={80} label>
                                        {analytics.user_contribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="glass-panel p-6 min-h-[300px]">
                            <h3 className="text-lg font-bold text-white mb-4">Best Selling Products</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <BarChart data={analytics.best_sellers} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                    <XAxis type="number" stroke="#888" />
                                    <YAxis dataKey="product__name" type="category" width={100} stroke="#888" />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                    <Bar dataKey="quantity_sold" fill="#10b981" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="glass-panel p-6 min-h-[300px]">
                            <h3 className="text-lg font-bold text-white mb-4">Category Breakdown</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <PieChart>
                                    <Pie data={analytics.category_breakdown} dataKey="total_sales" nameKey="product__category__name" cx="50%" cy="50%" outerRadius={80} innerRadius={50}>
                                        {analytics.category_breakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155' }} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-panel p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Shift Audit Log</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-textMuted uppercase bg-white/5">
                                    <tr>
                                        <th className="px-4 py-2">Time</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Amount</th>
                                        <th className="px-4 py-2">User</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movements.map(m => (
                                        <tr key={m.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="px-4 py-2 text-textMuted">{new Date(m.created_at).toLocaleTimeString()}</td>
                                            <td className="px-4 py-2">{m.movement_type.toUpperCase()}</td>
                                            <td className="px-4 py-2 font-mono">{parseFloat(m.amount).toFixed(2)}</td>
                                            <td className="px-4 py-2">{m.performed_by_name}</td>
                                        </tr>
                                    ))}
                                    {movements.length === 0 && <tr><td colSpan="4" className="px-4 py-4 text-center text-textMuted">No movements recorded.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="glass-panel p-6">
                        <h3 className="text-lg font-bold text-white mb-4">Sales Transactions</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-textMuted uppercase bg-white/5">
                                    <tr>
                                        <th className="px-4 py-2">Txn #</th>
                                        <th className="px-4 py-2">Type</th>
                                        <th className="px-4 py-2">Net Amount</th>
                                        <th className="px-4 py-2">Cashier</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {transactions.map(t => (
                                        <tr key={t.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="px-4 py-2">{t.transaction_number}</td>
                                            <td className="px-4 py-2">
                                                <span className={`text-xs ${t.transaction_type === 'sale' ? 'text-green-400' : 'text-red-400'}`}>{t.transaction_type.toUpperCase()}</span>
                                            </td>
                                            <td className="px-4 py-2 font-mono">{parseFloat(t.net_amount).toFixed(2)}</td>
                                            <td className="px-4 py-2">{t.cashier_name}</td>
                                        </tr>
                                    ))}
                                    {transactions.length === 0 && <tr><td colSpan="4" className="px-4 py-4 text-center text-textMuted">No transactions recorded.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Hidden container for Z-Report Print */}
                <div id="z-report-print-area" className="hidden">
                    <h2>Daily Shift Summary</h2>
                    <h3>Shift #: {selectedShift.shift_number}</h3>
                    <hr />
                    <div className="row"><span>Employee:</span> <span>{selectedShift.cashier_name}</span></div>
                    <div className="row"><span>Date:</span> <span>{new Date(selectedShift.opened_at).toLocaleDateString()}</span></div>
                    <div className="row"><span>From:</span> <span>{new Date(selectedShift.opened_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>
                    <div className="row"><span>To:</span> <span>{selectedShift.closed_at ? new Date(selectedShift.closed_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'In Progress'}</span></div>
                    <hr />

                    <div className="section-title">1. Sales Summary (Invoices)</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Invoice #</th>
                                <th className="num">Total</th>
                                <th className="num">Paid</th>
                                <th className="num">Remaining</th>
                            </tr>
                        </thead>
                        <tbody>
                            {transactions.length > 0 ? transactions.map(t => {
                                const total = parseFloat(t.net_amount || 0);
                                const paid = parseFloat(t.amount_collected || t.net_amount || 0);
                                const remaining = Math.max(0, total - paid);
                                return (
                                    <tr key={t.id}>
                                        <td>#{t.order_number || t.transaction_number}</td>
                                        <td className="num">{total.toFixed(2)}</td>
                                        <td className="num">{paid.toFixed(2)}</td>
                                        <td className="num">{remaining.toFixed(2)}</td>
                                    </tr>
                                );
                            }) : <tr><td colSpan="4" className="no-data">No invoices in this shift</td></tr>}
                        </tbody>
                    </table>
                    {(() => {
                        const totalSales = transactions.reduce((s, t) => s + parseFloat(t.net_amount || 0), 0);
                        const totalCollected = transactions.reduce((s, t) => s + parseFloat(t.amount_collected || t.net_amount || 0), 0);
                        const uncollected = Math.max(0, totalSales - totalCollected);
                        return (
                            <>
                                <div className="row bold"><span>Total Sales:</span> <span>{totalSales.toFixed(2)}</span></div>
                                <div className="row bold"><span>Total Collected:</span> <span>{totalCollected.toFixed(2)}</span></div>
                                <div className="row bold"><span>Uncollected (Credit):</span> <span>{uncollected.toFixed(2)}</span></div>
                            </>
                        );
                    })()}
                    <hr />

                    <div className="section-title">2. Expense Details</div>
                    <table>
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th className="num">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {expenses.length > 0 ? expenses.map(e => (
                                <tr key={e.id}>
                                    <td>{e.description || e.category_name || 'Expense'}</td>
                                    <td className="num">{parseFloat(e.amount).toFixed(2)}</td>
                                </tr>
                            )) : <tr><td colSpan="2" className="no-data">No expenses recorded in this shift</td></tr>}
                        </tbody>
                    </table>
                    <div className="row bold"><span>Total Expenses:</span> <span>{expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0).toFixed(2)}</span></div>
                    <hr />

                    <div className="section-title">3. Cash Drawer Settlement</div>
                    {(() => {
                        const opening = parseFloat(selectedShift.opening_cash || 0);
                        const cashCollected = transactions.reduce((s, t) => s + parseFloat(t.amount_collected || t.net_amount || 0), 0);
                        const totalExp = expenses.reduce((s, e) => s + parseFloat(e.amount || 0), 0);
                        const expected = parseFloat(selectedShift.expected_closing_cash || (opening + cashCollected - totalExp));
                        const actual = parseFloat(selectedShift.actual_closing_cash || 0);
                        const diff = actual - expected;
                        return (
                            <>
                                <div className="row"><span>Opening Balance:</span> <span>{opening.toFixed(2)} EGP</span></div>
                                <div className="row"><span>(+) Cash Collected:</span> <span>{cashCollected.toFixed(2)} EGP</span></div>
                                <div className="row"><span>(-) Total Expenses:</span> <span>{totalExp.toFixed(2)} EGP</span></div>
                                <hr />
                                <div className="row bold"><span>Expected Drawer Balance:</span> <span>{expected.toFixed(2)} EGP</span></div>
                                <div className="row bold"><span>Actual Count (at Close):</span> <span>{actual.toFixed(2)} EGP</span></div>
                                <div className="row bold"><span>Difference (Short/Over):</span> <span>{diff.toFixed(2)} EGP</span></div>
                            </>
                        );
                    })()}
                    {selectedShift.discrepancy_reason && <div className="row"><span>Note:</span> <span>{selectedShift.discrepancy_reason}</span></div>}
                    <hr />

                    <div className="sig-block">
                        <p>Cashier Signature</p>
                        <div className="sig-line"></div>
                    </div>
                    <div className="sig-block">
                        <p>Manager / Accountant Signature</p>
                        <div className="sig-line"></div>
                    </div>
                </div>
            </div>
        );
    }

    const columns = [
        { header: "Shift #", accessorKey: "shift_number" },
        { 
            header: "Date", 
            accessorFn: row => new Date(row.opened_at).toLocaleDateString(),
            id: 'date'
        },
        { header: "Host Cashier", accessorKey: "cashier_name" },
        { 
            header: "Status", 
            accessorKey: "status",
            cell: ({ getValue }) => {
                const val = getValue();
                return (
                    <span className={`px-2 py-1 rounded text-xs font-bold ${val === 'open' ? 'bg-green-500/20 text-green-400' : 'bg-white/10 text-white'}`}>
                        {val.toUpperCase()}
                    </span>
                );
            }
        },
        { 
            header: "Expected", 
            accessorKey: "expected_closing_cash",
            cell: ({ getValue }) => `${parseFloat(getValue() || 0).toFixed(2)} L.E`
        },
        { 
            header: "Actions", 
            id: 'actions',
            cell: ({ row }) => (
                <button onClick={(e) => { e.stopPropagation(); handleViewDetails(row.original); }} className="text-primary hover:text-white transition-colors p-2 text-lg">
                    <FiEye />
                </button>
            )
        }
    ];

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader title="Shift Management" subtitle="View and manage historical shifts and shift analytics." icon={FiClock} />
            
            <div className="glass-panel p-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Status</label>
                    <select className="input min-w-[150px]" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                        <option value="">All Shifts</option>
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Date</label>
                    <input type="date" className="input" value={dateFilter} onChange={e => setDateFilter(e.target.value)} />
                </div>
                <button onClick={() => { setStatusFilter(''); setDateFilter(''); }} className="btn bg-white/5 hover:bg-white/10 text-white">
                    Clear Filters
                </button>
            </div>

            <div className="glass-panel p-6">
                <DataTable columns={columns} data={shifts} isLoading={isLoading} emptyMessage="No shifts found." />
            </div>
        </div>
    );
}
