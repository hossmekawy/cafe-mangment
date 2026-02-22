import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import { dashboardApi } from '../api/dashboardApi';
import {
    FiDollarSign, FiShoppingCart, FiTrendingUp, FiTrendingDown,
    FiUsers, FiPackage, FiAlertTriangle, FiClock, FiRefreshCw,
    FiPlusCircle, FiGrid, FiCreditCard, FiFileText, FiSettings,
    FiBarChart2, FiArrowUpRight, FiArrowDownRight, FiActivity,
    FiStar, FiPercent, FiCalendar, FiChevronRight, FiZap,
    FiShield, FiTag, FiCoffee, FiUserCheck
} from 'react-icons/fi';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const REFRESH_INTERVAL = 60000; // 60 seconds

export default function Dashboard() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [refreshing, setRefreshing] = useState(false);

    const isAdmin = ['manager', 'super_admin'].includes(user?.role);

    const fetchDashboard = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await dashboardApi.getDashboard();
            setData(res.data);
            setLastUpdated(new Date());
        } catch (err) {
            console.error('Dashboard fetch failed:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboard();
        const interval = setInterval(() => fetchDashboard(true), REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [fetchDashboard]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return '☀️ Good Morning';
        if (hour < 17) return '🌤️ Good Afternoon';
        return '🌙 Good Evening';
    };

    const fmt = (val) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
        return parseFloat(val || 0).toFixed(2);
    };
    const fmtMoney = (val) => `${fmt(val)} EGP`;

    if (loading) {
        return (
            <div className="space-y-6 pb-8 animate-pulse">
                {/* Skeleton Header */}
                <div className="flex justify-between items-center">
                    <div className="space-y-3">
                        <div className="h-8 w-72 bg-white/10 rounded-xl" />
                        <div className="h-4 w-56 bg-white/5 rounded-lg" />
                    </div>
                    <div className="h-10 w-10 bg-white/10 rounded-xl" />
                </div>
                {/* Skeleton Quick Actions */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-12 bg-white/10 rounded-xl" />)}
                </div>
                {/* Skeleton KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                    {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-white/10 rounded-xl" />)}
                </div>
                {/* Skeleton Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 h-80 bg-white/10 rounded-xl" />
                    <div className="h-80 bg-white/10 rounded-xl" />
                </div>
                {/* Skeleton Tables */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-64 bg-white/10 rounded-xl" />
                    <div className="h-64 bg-white/10 rounded-xl" />
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <FiAlertTriangle className="w-12 h-12 text-danger mx-auto" />
                    <p className="text-textMuted">Failed to load dashboard data.</p>
                    <button onClick={() => fetchDashboard()} className="btn-primary px-6 py-2">Retry</button>
                </div>
            </div>
        );
    }

    const { sales_summary, revenue_chart, recent_orders, top_products, payment_breakdown,
        inventory_alerts, customer_debts, expenses, profit_loss, pending_invoices,
        staff_overview, active_promotions, hourly_sales, order_types, order_status_counts } = data;

    const trendUp = sales_summary.trend_pct >= 0;

    return (
        <div className="space-y-6 animate-fade-in pb-8">
            {/* ═══════ HEADER ═══════ */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-textMain tracking-tight">
                        {getGreeting()}, <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">{user?.name || user?.username}</span>
                    </h1>
                    <p className="text-textMuted mt-1 flex items-center gap-2">
                        <FiCalendar className="w-3.5 h-3.5" />
                        {new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        <span className="text-white/20">·</span>
                        Here's your business snapshot
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastUpdated && (
                        <span className="text-xs text-textMuted">
                            Updated {lastUpdated.toLocaleTimeString()}
                        </span>
                    )}
                    <button
                        onClick={() => fetchDashboard(true)}
                        className={`p-2.5 rounded-xl bg-surface border border-slate-200 dark:border-white/10 hover:border-primary/50 transition-all ${refreshing ? 'animate-spin' : ''}`}
                        title="Refresh"
                    >
                        <FiRefreshCw className="w-4 h-4 text-textMuted" />
                    </button>
                </div>
            </div>

            {/* ═══════ QUICK ACTION BUTTONS ═══════ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { label: 'New Order', icon: FiPlusCircle, path: '/pos', color: 'bg-blue-500', shadow: 'shadow-blue-500/25' },
                    { label: 'Cash Register', icon: FiDollarSign, path: '/finance/cash-register', color: 'bg-emerald-500', shadow: 'shadow-emerald-500/25' },
                    { label: 'Products', icon: FiCoffee, path: '/inventory/products', color: 'bg-violet-500', shadow: 'shadow-violet-500/25' },
                    { label: 'Customers', icon: FiUsers, path: '/customers', color: 'bg-amber-500', shadow: 'shadow-amber-500/25' },
                    { label: 'Reports', icon: FiBarChart2, path: '/finance/reports', color: 'bg-rose-500', shadow: 'shadow-rose-500/25' },
                    { label: 'Orders', icon: FiShoppingCart, path: '/orders', color: 'bg-cyan-500', shadow: 'shadow-cyan-500/25' },
                ].map(({ label, icon: Icon, path, color, shadow }) => (
                    <button
                        key={path}
                        onClick={() => navigate(path)}
                        className={`${color} ${shadow} text-white rounded-xl p-3 flex items-center gap-2.5 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all font-medium text-sm`}
                    >
                        <Icon className="w-4.5 h-4.5 shrink-0" />
                        <span className="truncate">{label}</span>
                    </button>
                ))}
            </div>

            {/* ═══════ ROW 1: KPI CARDS ═══════ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <KPICard
                    title="Today's Revenue"
                    value={fmtMoney(sales_summary.today.revenue)}
                    icon={FiDollarSign}
                    trend={sales_summary.trend_pct}
                    trendLabel="vs yesterday"
                    color="blue"
                />
                <KPICard
                    title="Today's Orders"
                    value={sales_summary.today.count}
                    icon={FiShoppingCart}
                    subtitle={`${order_status_counts?.pending || 0} pending`}
                    color="emerald"
                />
                <KPICard
                    title="Avg Order Value"
                    value={fmtMoney(sales_summary.today.avg_order)}
                    icon={FiActivity}
                    color="violet"
                />
                <KPICard
                    title="Monthly Revenue"
                    value={fmtMoney(sales_summary.month.revenue)}
                    icon={FiCalendar}
                    subtitle={`${sales_summary.month.count} orders`}
                    color="amber"
                />
                <KPICard
                    title="Today's Profit"
                    value={fmtMoney(profit_loss.today.profit)}
                    icon={profit_loss.today.profit >= 0 ? FiTrendingUp : FiTrendingDown}
                    color={profit_loss.today.profit >= 0 ? 'emerald' : 'rose'}
                    subtitle={`Expenses: ${fmtMoney(profit_loss.today.expenses)}`}
                />
                <KPICard
                    title="Monthly Profit"
                    value={fmtMoney(profit_loss.month.profit)}
                    icon={profit_loss.month.profit >= 0 ? FiTrendingUp : FiTrendingDown}
                    color={profit_loss.month.profit >= 0 ? 'emerald' : 'rose'}
                    subtitle={`Expenses: ${fmtMoney(profit_loss.month.expenses)}`}
                />
            </div>

            {/* ═══════ ROW 2: MINI STAT PILLS ═══════ */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <StatPill icon={FiAlertTriangle} label="Low Stock" value={inventory_alerts.low_stock_count} color="text-amber-400" bg="bg-amber-500/10" />
                <StatPill icon={FiPackage} label="Out of Stock" value={inventory_alerts.out_of_stock_count} color="text-red-400" bg="bg-red-500/10" />
                <StatPill icon={FiCreditCard} label="Customer Debts" value={fmtMoney(customer_debts.total_debt)} color="text-orange-400" bg="bg-orange-500/10" />
                <StatPill icon={FiFileText} label="Unpaid Invoices" value={pending_invoices.count} color="text-violet-400" bg="bg-violet-500/10" />
                <StatPill icon={FiTag} label="Active Promos" value={active_promotions.campaigns + active_promotions.coupons} color="text-pink-400" bg="bg-pink-500/10" />
                <StatPill icon={FiUserCheck} label="Active Staff" value={staff_overview.total} color="text-cyan-400" bg="bg-cyan-500/10" />
            </div>

            {/* ═══════ ROW 3: REVENUE TREND + HOURLY SALES ═══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                            <FiTrendingUp className="text-primary" /> Revenue Trend (30 Days)
                        </h3>
                    </div>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
                            <AreaChart data={revenue_chart}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: '#94A3B8', fontSize: 11 }}
                                    tickFormatter={(d) => new Date(d).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
                                    interval="preserveStartEnd"
                                />
                                <YAxis tick={{ fill: '#94A3B8', fontSize: 11 }} tickFormatter={(v) => fmt(v)} />
                                <Tooltip
                                    contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                                    formatter={(val) => [fmtMoney(val), 'Revenue']}
                                    labelFormatter={(l) => new Date(l).toLocaleDateString('en', { weekday: 'short', day: 'numeric', month: 'short' })}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2.5} fill="url(#revenueGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Hourly Sales Today */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2 mb-4">
                        <FiClock className="text-emerald-400" /> Hourly Sales Today
                    </h3>
                    <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%" minHeight={300} minWidth={100}>
                            <BarChart data={hourly_sales.filter(h => h.hour >= 6 && h.hour <= 23)}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                                <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} interval={1} />
                                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} tickFormatter={(v) => fmt(v)} />
                                <Tooltip
                                    contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                                    formatter={(val, name) => [name === 'revenue' ? fmtMoney(val) : val, name === 'revenue' ? 'Revenue' : 'Orders']}
                                />
                                <Bar dataKey="revenue" fill="#10B981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ═══════ ROW 4: PAYMENT BREAKDOWN + TOP PRODUCTS + ORDER TYPES ═══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Payment Methods */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2 mb-4">
                        <FiCreditCard className="text-violet-400" /> Payment Methods
                    </h3>
                    {payment_breakdown.length > 0 ? (
                        <div className="h-56 flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={100}>
                                <PieChart>
                                    <Pie
                                        data={payment_breakdown}
                                        dataKey="total"
                                        nameKey="method"
                                        cx="50%" cy="50%"
                                        outerRadius={85}
                                        innerRadius={50}
                                        label={({ method, percent }) => `${method} (${(percent * 100).toFixed(0)}%)`}
                                        labelLine={false}
                                    >
                                        {payment_breakdown.map((_, i) => (
                                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, color: '#fff' }}
                                        formatter={(val) => fmtMoney(val)}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <EmptyState text="No payments today yet" />
                    )}
                    {payment_breakdown.length > 0 && (
                        <div className="space-y-2 mt-4">
                            {payment_breakdown.map((p, i) => (
                                <div key={p.method} className="flex items-center justify-between text-sm">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                                        <span className="text-textMuted capitalize">{p.method.replace('_', ' ')}</span>
                                    </div>
                                    <span className="font-mono font-semibold text-textMain">{fmtMoney(p.total)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Selling Products */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2 mb-4">
                        <FiStar className="text-amber-400" /> Top Products (30d)
                    </h3>
                    {top_products.length > 0 ? (
                        <div className="space-y-3">
                            {top_products.slice(0, 8).map((p, i) => (
                                <div key={p.name} className="flex items-center gap-3">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-textMuted'}`}>
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-textMain truncate">{p.name}</p>
                                        <p className="text-xs text-textMuted">{p.quantity} sold</p>
                                    </div>
                                    <span className="text-sm font-mono font-semibold text-emerald-400">{fmtMoney(p.revenue)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState text="No sales data yet" />
                    )}
                </div>

                {/* Order Types + Status */}
                <div className="glass-panel p-6 space-y-6">
                    <div>
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2 mb-4">
                            <FiGrid className="text-cyan-400" /> Order Types Today
                        </h3>
                        {order_types.length > 0 ? (
                            <div className="space-y-3">
                                {order_types.map(t => (
                                    <div key={t.type} className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                                                t.type === 'dine_in' ? 'bg-blue-500/20 text-blue-400' :
                                                t.type === 'takeaway' ? 'bg-amber-500/20 text-amber-400' :
                                                'bg-violet-500/20 text-violet-400'
                                            }`}>
                                                {t.type.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-sm font-bold text-textMain">{t.count} orders</span>
                                            <span className="text-xs text-textMuted ml-2">{fmtMoney(t.total)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState text="No orders today" />
                        )}
                    </div>
                    <div className="border-t border-slate-200 dark:border-white/10 pt-4">
                        <h4 className="text-sm font-bold text-textMain mb-3">Order Status</h4>
                        <div className="grid grid-cols-3 gap-2">
                            <MiniStat label="Pending" value={order_status_counts?.pending || 0} color="text-amber-400" />
                            <MiniStat label="Done" value={order_status_counts?.completed || 0} color="text-emerald-400" />
                            <MiniStat label="Cancelled" value={order_status_counts?.cancelled || 0} color="text-red-400" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══════ ROW 5: INVENTORY ALERTS + RECENT ORDERS ═══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Inventory Alerts */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                            <FiAlertTriangle className="text-amber-400" /> Inventory Alerts
                        </h3>
                        <button onClick={() => navigate('/inventory/materials')} className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                            View All <FiChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    {(inventory_alerts.out_of_stock.length + inventory_alerts.low_stock.length) > 0 ? (
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                            {inventory_alerts.out_of_stock.map((item, i) => (
                                <div key={`oos-${i}`} className="flex items-center justify-between p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                        <span className="text-sm font-medium text-textMain">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-bold text-red-400 px-2 py-1 bg-red-500/20 rounded-lg">OUT OF STOCK</span>
                                </div>
                            ))}
                            {inventory_alerts.low_stock.map((item, i) => (
                                <div key={`low-${i}`} className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                        <div>
                                            <span className="text-sm font-medium text-textMain">{item.name}</span>
                                            <p className="text-xs text-textMuted">{item.current_stock} / {item.minimum_stock} {item.unit__name}</p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-bold text-amber-400 px-2 py-1 bg-amber-500/20 rounded-lg">LOW</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-3">
                                <FiShield className="w-6 h-6" />
                            </div>
                            <p className="text-sm text-textMuted">All stock levels are healthy!</p>
                        </div>
                    )}
                </div>

                {/* Recent Orders */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                            <FiClock className="text-primary" /> Recent Orders
                        </h3>
                        <button onClick={() => navigate('/orders')} className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                            View All <FiChevronRight className="w-3 h-3" />
                        </button>
                    </div>
                    {recent_orders.length > 0 ? (
                        <div className="overflow-x-auto max-h-80 overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-textMuted uppercase bg-white/5 sticky top-0">
                                    <tr>
                                        <th className="px-3 py-2.5 rounded-tl-lg">Order #</th>
                                        <th className="px-3 py-2.5">Type</th>
                                        <th className="px-3 py-2.5">Status</th>
                                        <th className="px-3 py-2.5">Amount</th>
                                        <th className="px-3 py-2.5 rounded-tr-lg">Time</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recent_orders.slice(0, 10).map(order => (
                                        <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="px-3 py-2.5 font-mono font-medium text-textMain">{order.order_number}</td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                                                    order.order_type === 'dine_in' ? 'bg-blue-500/20 text-blue-400' :
                                                    order.order_type === 'takeaway' ? 'bg-amber-500/20 text-amber-400' :
                                                    'bg-violet-500/20 text-violet-400'
                                                }`}>
                                                    {order.order_type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5">
                                                <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${
                                                    order.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    order.status === 'cancelled' ? 'bg-red-500/20 text-red-400' :
                                                    'bg-amber-500/20 text-amber-400'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="px-3 py-2.5 font-mono font-semibold text-textMain">{fmtMoney(order.total_amount)}</td>
                                            <td className="px-3 py-2.5 text-textMuted text-xs">
                                                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState text="No orders yet today" />
                    )}
                </div>
            </div>

            {/* ═══════ ROW 6: CUSTOMER DEBTS + PENDING INVOICES + EXPENSES ═══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Customer Debts */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                            <FiUsers className="text-orange-400" /> Customer Debts
                        </h3>
                        <div className="text-right">
                            <p className="text-lg font-black text-orange-400 font-mono">{fmtMoney(customer_debts.total_debt)}</p>
                            <p className="text-xs text-textMuted">{customer_debts.count} customers</p>
                        </div>
                    </div>
                    {customer_debts.top_debtors.length > 0 ? (
                        <div className="space-y-2.5">
                            {customer_debts.top_debtors.slice(0, 6).map((d, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                                    <div>
                                        <p className="text-sm font-medium text-textMain">{d.customer_name}</p>
                                        <p className="text-xs text-textMuted">{d.phone}</p>
                                    </div>
                                    <span className="font-mono font-bold text-orange-400 text-sm">{fmtMoney(d.balance)}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState text="No outstanding debts" icon={FiShield} color="text-emerald-400" />
                    )}
                </div>

                {/* Pending Supplier Invoices */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                            <FiFileText className="text-violet-400" /> Supplier Invoices
                        </h3>
                        <div className="text-right">
                            <p className="text-lg font-black text-violet-400 font-mono">{fmtMoney(pending_invoices.total_amount)}</p>
                            <p className="text-xs text-textMuted">{pending_invoices.overdue_count} overdue</p>
                        </div>
                    </div>
                    {pending_invoices.invoices.length > 0 ? (
                        <div className="space-y-2.5">
                            {pending_invoices.invoices.slice(0, 6).map((inv, i) => (
                                <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-white/5 border border-white/5">
                                    <div>
                                        <p className="text-sm font-medium text-textMain">{inv.supplier__name}</p>
                                        <p className="text-xs text-textMuted">{inv.invoice_number} · Due {inv.due_date}</p>
                                    </div>
                                    <span className={`font-mono font-bold text-sm ${inv.status === 'overdue' ? 'text-red-400' : 'text-violet-400'}`}>
                                        {fmtMoney(inv.total_amount - inv.paid_amount)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <EmptyState text="All invoices are paid" icon={FiShield} color="text-emerald-400" />
                    )}
                </div>

                {/* Monthly Expenses by Category */}
                <div className="glass-panel p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-textMain flex items-center gap-2">
                            <FiPercent className="text-rose-400" /> Monthly Expenses
                        </h3>
                        <div className="text-right">
                            <p className="text-lg font-black text-rose-400 font-mono">{fmtMoney(expenses.month)}</p>
                            <p className="text-xs text-textMuted">Today: {fmtMoney(expenses.today)}</p>
                        </div>
                    </div>
                    {expenses.by_category.length > 0 ? (
                        <div className="space-y-3">
                            {expenses.by_category.map((cat, i) => {
                                const pct = expenses.month > 0 ? (cat.total / expenses.month) * 100 : 0;
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="text-textMuted capitalize">{(cat.category || 'Other').replace('_', ' ')}</span>
                                            <span className="font-mono font-semibold text-textMain">{fmtMoney(cat.total)}</span>
                                        </div>
                                        <div className="w-full bg-white/5 rounded-full h-1.5">
                                            <div
                                                className="h-1.5 rounded-full transition-all"
                                                style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <EmptyState text="No expenses recorded this month" />
                    )}
                </div>
            </div>

            {/* ═══════ ROW 7: PROFIT/LOSS BREAKDOWN + STAFF ═══════ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* P&L Breakdown */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2 mb-4">
                        <FiBarChart2 className="text-primary" /> Profit & Loss Breakdown
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <PLCard
                            title="Today"
                            revenue={profit_loss.today.revenue}
                            expenses={profit_loss.today.expenses}
                            waste={profit_loss.today.waste}
                            profit={profit_loss.today.profit}
                            fmtMoney={fmtMoney}
                        />
                        <PLCard
                            title="This Month"
                            revenue={profit_loss.month.revenue}
                            expenses={profit_loss.month.expenses}
                            waste={profit_loss.month.waste}
                            profit={profit_loss.month.profit}
                            fmtMoney={fmtMoney}
                        />
                    </div>
                </div>

                {/* Staff & Summary */}
                <div className="glass-panel p-6">
                    <h3 className="text-lg font-bold text-textMain flex items-center gap-2 mb-4">
                        <FiUsers className="text-cyan-400" /> Staff Overview
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {staff_overview.by_role.map(r => (
                            <div key={r.role} className="bg-white/5 rounded-xl p-3 text-center border border-white/5">
                                <p className="text-2xl font-black text-textMain">{r.count}</p>
                                <p className="text-xs text-textMuted capitalize mt-1">{r.role.replace('_', ' ')}</p>
                            </div>
                        ))}
                    </div>
                    {isAdmin && (
                        <button
                            onClick={() => navigate('/settings/users')}
                            className="mt-4 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-sm font-medium text-textMuted hover:text-textMain transition-all flex items-center justify-center gap-2"
                        >
                            <FiSettings className="w-4 h-4" /> Manage Staff
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function KPICard({ title, value, icon: Icon, trend, trendLabel, subtitle, color = 'blue' }) {
    const colorMap = {
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
        violet: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/20' },
        amber: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
        rose: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/20' },
        cyan: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', border: 'border-cyan-500/20' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className={`glass-panel p-5 border-l-4 ${c.border} hover:scale-[1.01] transition-transform`}>
            <div className="flex items-start justify-between">
                <div className={`p-2 rounded-lg ${c.bg}`}>
                    <Icon className={`w-5 h-5 ${c.text}`} />
                </div>
                {trend !== undefined && (
                    <span className={`text-xs font-bold flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend >= 0 ? <FiArrowUpRight className="w-3 h-3" /> : <FiArrowDownRight className="w-3 h-3" />}
                        {Math.abs(trend)}%
                    </span>
                )}
            </div>
            <p className="text-xl font-black text-textMain mt-3 font-mono">{value}</p>
            <p className="text-xs text-textMuted mt-1">{subtitle || trendLabel || title}</p>
        </div>
    );
}

function StatPill({ icon: Icon, label, value, color, bg }) {
    return (
        <div className={`${bg} rounded-xl px-3 py-3 flex items-center gap-2.5`}>
            <Icon className={`w-4 h-4 ${color} shrink-0`} />
            <div className="min-w-0">
                <p className={`text-sm font-bold ${color} truncate`}>{value}</p>
                <p className="text-[10px] text-textMuted truncate">{label}</p>
            </div>
        </div>
    );
}

function MiniStat({ label, value, color }) {
    return (
        <div className="text-center bg-white/5 rounded-lg py-2 px-1">
            <p className={`text-lg font-black ${color}`}>{value}</p>
            <p className="text-[10px] text-textMuted">{label}</p>
        </div>
    );
}

function PLCard({ title, revenue, expenses, waste, profit, fmtMoney }) {
    const isProfit = profit >= 0;
    return (
        <div className={`rounded-xl p-4 border ${isProfit ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'}`}>
            <p className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3">{title}</p>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-textMuted">Revenue</span>
                    <span className="font-mono font-semibold text-emerald-400">{fmtMoney(revenue)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-textMuted">Expenses</span>
                    <span className="font-mono font-semibold text-red-400">-{fmtMoney(expenses)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-textMuted">Waste</span>
                    <span className="font-mono font-semibold text-amber-400">-{fmtMoney(waste)}</span>
                </div>
                <div className="border-t border-white/10 pt-2 flex justify-between">
                    <span className="font-bold text-textMain">Net</span>
                    <span className={`font-mono font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {fmtMoney(profit)}
                    </span>
                </div>
            </div>
        </div>
    );
}

function EmptyState({ text, icon: Icon = FiPackage, color = 'text-textMuted' }) {
    return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
            <Icon className={`w-8 h-8 ${color} mb-2 opacity-50`} />
            <p className="text-sm text-textMuted">{text}</p>
        </div>
    );
}
