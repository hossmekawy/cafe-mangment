import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { FiPieChart, FiBarChart2, FiTrendingUp, FiBriefcase, FiDollarSign } from 'react-icons/fi';
import { 
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { financeApi } from '../../api/financeApi';
import PageHeader from '../../components/PageHeader';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function FinancialReports() {
    const [activeTab, setActiveTab] = useState('pnl');
    const [dateRange, setDateRange] = useState({ date_from: '', date_to: '' });
    const [reportData, setReportData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const TABS = [
        { id: 'pnl', label: 'Profit & Loss (P&L)', icon: <FiDollarSign /> },
        { id: 'cashflow', label: 'Cash Flow', icon: <FiTrendingUp /> },
        { id: 'tax', label: 'Tax Summary', icon: <FiBriefcase /> },
        { id: 'sales_analysis', label: 'Sales Analysis', icon: <FiPieChart /> },
        { id: 'expense_analysis', label: 'Expense Analysis', icon: <FiBarChart2 /> },
    ];

    useEffect(() => {
        fetchReport();
    }, [activeTab, dateRange]);

    const fetchReport = async () => {
        setIsLoading(true);
        try {
            const res = await financeApi.getFinancialReport({ type: activeTab, ...dateRange });
            setReportData(res.data);
        } catch (error) {
            toast.error("Failed to load report data");
            setReportData(null);
        } finally {
            setIsLoading(false);
        }
    };

    const formatMoney = (val) => `${parseFloat(val || 0).toFixed(2)} EGP`;

    // ──────────────────────────────────────────────
    // 1) PROFIT & LOSS (PNL)
    // ──────────────────────────────────────────────
    const renderPnL = () => {
        if (!reportData) return null;
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-panel p-6 border-l-4 border-green-500">
                        <p className="text-textMuted uppercase tracking-wider text-sm">Gross Sales</p>
                        <p className="text-3xl font-black text-white mt-2">{formatMoney(reportData.gross_sales)}</p>
                    </div>
                    <div className="glass-panel p-6 border-l-4 border-red-500">
                        <p className="text-textMuted uppercase tracking-wider text-sm">Discounts & Refunds</p>
                        <p className="text-3xl font-black text-red-400 mt-2">-{formatMoney(reportData.discounts + reportData.refunds)}</p>
                    </div>
                    <div className="glass-panel p-6 border-l-4 border-primary bg-primary/5 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
                        <p className="text-primary font-bold uppercase tracking-wider text-sm">Net Revenue</p>
                        <p className="text-4xl font-black text-white mt-2">{formatMoney(reportData.net_revenue)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-panel p-6">
                        <h3 className="font-bold text-lg mb-4 text-white">Operating Expenses</h3>
                        <div className="space-y-4">
                            {reportData.expenses_by_category.map((exp, idx) => (
                                <div key={idx} className="flex justify-between items-center border-b border-white/5 pb-2">
                                    <span className="text-textMuted">{exp.category__name}</span>
                                    <span className="font-mono font-bold text-white">{formatMoney(exp.total)}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center pt-2 mt-4 border-t border-white/10">
                                <span className="text-red-400 font-bold uppercase">Total Expenses</span>
                                <span className="font-mono font-black text-red-400 text-xl">{formatMoney(reportData.total_expenses)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="glass-panel p-6 flex flex-col justify-center items-center text-center">
                        <h3 className="text-textMuted uppercase tracking-widest font-bold mb-4">Operating Profit</h3>
                        <div className={`text-6xl font-black font-mono drop-shadow-2xl ${reportData.operating_profit >= 0 ? 'text-green-400' : 'text-red-500'}`}>
                            {reportData.operating_profit > 0 ? '+' : ''}{formatMoney(reportData.operating_profit)}
                        </div>
                        <p className="text-sm text-textMuted mt-6 w-3/4 mx-auto">Net Revenue minus Operating Expenses before taxes or interest.</p>
                    </div>
                </div>
            </div>
        );
    };

    // ──────────────────────────────────────────────
    // 2) CASH FLOW
    // ──────────────────────────────────────────────
    const renderCashFlow = () => {
        if (!reportData) return null;
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="glass-panel p-6">
                        <p className="text-textMuted">Total Cash In</p>
                        <p className="text-2xl font-bold text-green-400 mt-1">{formatMoney(reportData.total_cash_in)}</p>
                    </div>
                    <div className="glass-panel p-6">
                        <p className="text-textMuted">Total Cash Out</p>
                        <p className="text-2xl font-bold text-red-400 mt-1">{formatMoney(reportData.total_cash_out)}</p>
                    </div>
                    <div className="glass-panel p-6 bg-white/5">
                        <p className="text-textMuted">Net Cash Flow</p>
                        <p className={`text-3xl font-bold mt-1 ${reportData.net_cash >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {formatMoney(reportData.net_cash)}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 h-[400px]">
                        <h3 className="font-bold text-white mb-6">Cash In by Method</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={reportData.cash_in_by_method || []} cx="50%" cy="45%" innerRadius={80} outerRadius={110}
                                    paddingAngle={5} dataKey="total" nameKey="payment_method"
                                >
                                    {(reportData.cash_in_by_method || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip formatter={(value) => `${parseFloat(value).toFixed(2)} EGP`} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} itemStyle={{ color: '#fff' }} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="glass-panel p-6 h-[400px]">
                        <h3 className="font-bold text-white mb-6">Daily In/Out Trend</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} allowDuplicatedCategory={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
                                <RechartsTooltip formatter={(value) => `${parseFloat(value).toFixed(2)} EGP`} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                <Legend />
                                <Line data={reportData.daily_in || []} type="monotone" dataKey="total" name="Cash In" stroke="#10b981" strokeWidth={3} dot={false} />
                                <Line data={reportData.daily_out || []} type="monotone" dataKey="total" name="Cash Out" stroke="#ef4444" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        );
    };

    // ──────────────────────────────────────────────
    // 3) TAX SUMMARY
    // ──────────────────────────────────────────────
    const renderTax = () => {
        if (!reportData) return null;
        return (
            <div className="animate-fade-in max-w-2xl mx-auto">
                <div className="glass-panel p-8 text-center bg-blue-500/5 border-blue-500/20">
                    <FiBriefcase className="w-16 h-16 text-blue-500 mx-auto mb-6 opacity-80" />
                    <h2 className="text-2xl font-bold text-white mb-2">Total Liability Collected</h2>
                    <p className="text-6xl font-black font-mono text-white tracking-tighter drop-shadow-lg my-6">
                        {formatMoney(reportData.total_tax_liability)}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-8 pt-8 border-t border-white/10">
                        <div>
                            <p className="text-textMuted uppercase text-xs font-bold tracking-widest">VAT (Value Added Tax)</p>
                            <p className="text-2xl font-bold text-blue-400 mt-2">{formatMoney(reportData.vat_collected)}</p>
                        </div>
                        <div>
                            <p className="text-textMuted uppercase text-xs font-bold tracking-widest">Service Charge</p>
                            <p className="text-2xl font-bold text-indigo-400 mt-2">{formatMoney(reportData.service_charge_collected)}</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ──────────────────────────────────────────────
    // 4) SALES ANALYSIS
    // ──────────────────────────────────────────────
    const renderSales = () => {
        if (!reportData) return null;
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-panel p-6 h-[400px]">
                        <h3 className="font-bold text-white mb-6">Revenue by Category</h3>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={reportData.by_category} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                                <YAxis dataKey="product__category__name" type="category" stroke="#94a3b8" fontSize={12} width={100} />
                                <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} formatter={(value) => `${parseFloat(value).toFixed(2)} EGP`} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="glass-panel p-6">
                        <h3 className="font-bold text-white mb-4">Top 10 Selling Items</h3>
                        <div className="space-y-3">
                            {reportData.top_items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-black/20 p-3 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center font-bold text-xs text-textMuted">{idx+1}</div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{item.product__name}</p>
                                            <p className="text-xs text-textMuted">{item.qty} units sold</p>
                                        </div>
                                    </div>
                                    <span className="font-mono font-bold text-green-400">{formatMoney(item.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="glass-panel p-6 flex justify-around">
                    <div className="text-center">
                        <p className="text-textMuted uppercase text-xs tracking-widest mb-1">Total Orders</p>
                        <p className="text-3xl font-black text-white">{reportData.total_orders}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-textMuted uppercase text-xs tracking-widest mb-1">Average Ticket Size</p>
                        <p className="text-3xl font-black text-primary">{formatMoney(reportData.average_ticket)}</p>
                    </div>
                </div>
            </div>
        );
    };

    // ──────────────────────────────────────────────
    // 5) EXPENSE ANALYSIS
    // ──────────────────────────────────────────────
    const renderExpenses = () => {
        if (!reportData) return null;
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="glass-panel p-6">
                    <h3 className="font-bold text-white mb-6">Current Month: Budget vs Actual</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                        {reportData.budget_vs_actual.map((cat, idx) => {
                            const pct = cat.budget > 0 ? (cat.actual / cat.budget) * 100 : 0;
                            const isOver = cat.budget > 0 && cat.actual > cat.budget;
                            return (
                                <div key={idx} className="bg-black/20 p-4 rounded-xl border border-white/5">
                                    <div className="flex justify-between items-end mb-2">
                                        <p className="font-bold text-white">{cat.category}</p>
                                        <p className="font-mono text-sm text-textMuted">
                                            <span className={isOver ? 'text-red-400 font-bold' : 'text-white'}>{cat.actual.toFixed(2)}</span> / {cat.budget > 0 ? cat.budget.toFixed(2) : '-'}
                                        </p>
                                    </div>
                                    {cat.budget > 0 && (
                                        <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                                            <div 
                                                className={`h-1.5 rounded-full ${isOver ? 'bg-red-500' : 'bg-primary'}`}
                                                style={{ width: `${Math.min(100, pct)}%` }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="glass-panel p-6 h-[400px]">
                    <h3 className="font-bold text-white mb-6">Expense Trend (Monthly)</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={reportData.monthly_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                            <XAxis dataKey="month" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => new Date(val).toLocaleDateString([], {month:'short', year:'numeric'})} />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${v/1000}k`} />
                            <RechartsTooltip formatter={(value) => `${parseFloat(value).toFixed(2)} EGP`} labelFormatter={(val) => new Date(val).toLocaleDateString([], {month:'long', year:'numeric'})} contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }} />
                            <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 space-y-6 min-h-screen flex flex-col">
            <PageHeader 
                title="Financial Reports" 
                subtitle="High-level aggregations and analytics for Cafe performance."
                icon={FiPieChart}
                action={
                    <div className="flex gap-3 bg-black/40 p-1.5 rounded-lg border border-white/5">
                        <input 
                            type="date" className="input text-sm bg-transparent border-none w-36 outline-none text-textMuted" 
                            title="Date From"
                            value={dateRange.date_from} onChange={e => setDateRange({...dateRange, date_from: e.target.value})}
                        />
                        <span className="text-textMuted self-center">to</span>
                        <input 
                            type="date" className="input text-sm bg-transparent border-none w-36 outline-none text-textMuted" 
                            title="Date To"
                            value={dateRange.date_to} onChange={e => setDateRange({...dateRange, date_to: e.target.value})}
                        />
                    </div>
                }
            />

            {/* Tab Navigation */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-5 py-3 rounded-xl whitespace-nowrap transition-all duration-300 font-medium ${
                            activeTab === tab.id 
                            ? 'bg-primary text-white shadow-lg shadow-primary/20 border border-primary/50' 
                            : 'bg-black/20 text-textMuted hover:bg-white/5 border border-transparent'
                        }`}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex-1">
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'pnl' && renderPnL()}
                        {activeTab === 'cashflow' && renderCashFlow()}
                        {activeTab === 'tax' && renderTax()}
                        {activeTab === 'sales_analysis' && renderSales()}
                        {activeTab === 'expense_analysis' && renderExpenses()}
                    </>
                )}
            </div>
        </div>
    );
}
