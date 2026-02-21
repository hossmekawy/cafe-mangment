import React, { useState, useEffect, useCallback, useRef } from 'react';
import { posApi } from '../../api/posApi';
import { settingsApi } from '../../api/settingsApi';
import useSettingsStore from '../../store/settingsStore';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
    AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    FiSearch, FiFilter, FiX, FiEye, FiTrash2, FiEdit2, FiPrinter,
    FiCheckCircle, FiClock, FiXCircle, FiPlus, FiRefreshCw,
    FiShoppingBag, FiDollarSign, FiTrendingUp, FiAlertTriangle
} from 'react-icons/fi';
import { printReceipt } from '../pos/ReceiptPrinter';

// ---------- Helper Components ----------

const StatusBadge = ({ status }) => {
    const config = {
        completed: { color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <FiCheckCircle className="w-3 h-3" />, label: 'Completed' },
        pending:   { color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   icon: <FiClock className="w-3 h-3" />,       label: 'Pending'   },
        cancelled: { color: 'bg-red-500/15 text-red-400 border-red-500/30',         icon: <FiXCircle className="w-3 h-3" />,     label: 'Cancelled' },
    };
    const { color, icon, label } = config[status] || config.pending;
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${color}`}>
            {icon}{label}
        </span>
    );
};

const TypeBadge = ({ type }) => {
    const config = {
        dine_in:  { color: 'bg-blue-500/15 text-blue-400',   label: 'Dine-In'  },
        takeaway: { color: 'bg-purple-500/15 text-purple-400', label: 'Takeaway' },
        delivery: { color: 'bg-orange-500/15 text-orange-400', label: 'Delivery' },
    };
    const { color, label } = config[type] || { color: 'bg-slate-500/15 text-slate-400', label: type };
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${color}`}>
            {label}
        </span>
    );
};

// ---------- Main Page Component ----------

const OrdersPage = () => {
    const { settings } = useSettingsStore();
    const { user } = useAuthStore();
    const currency = settings?.currency || 'EGP';

    // Role-based access — roles from authentication/models.py:
    // super_admin | manager | cashier | waiter | barista | chef | delivery_driver
    const userRole = user?.role || '';
    const canManage = ['super_admin', 'manager'].includes(userRole); // edit + cancel
    // All authenticated staff can reprint receipts

    // Data state
    const [orders, setOrders] = useState([]);
    const [summary, setSummary] = useState(null);
    const [cancelReasons, setCancelReasons] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);

    // Filter state
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterPaid, setFilterPaid] = useState('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Modal state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelTargetId, setCancelTargetId] = useState(null);
    const [selectedCancelReason, setSelectedCancelReason] = useState('');
    const [customCancelReason, setCustomCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    // Edit state
    const [showEditModal, setShowEditModal] = useState(false);
    const [editTarget, setEditTarget] = useState(null);
    const [editNotes, setEditNotes] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    const searchTimeout = useRef(null);

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (search) params.search = search;
            if (filterStatus) params.status = filterStatus;
            if (filterType) params.order_type = filterType;
            if (filterPaid) params.is_paid = filterPaid;
            if (filterDateFrom) params.date_from = filterDateFrom;
            if (filterDateTo) params.date_to = filterDateTo;

            const res = await posApi.getOrders(params);
            const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
            setOrders(data);
            setTotalCount(data.length);
        } catch (err) {
            toast.error('Failed to load orders');
        } finally {
            setIsLoading(false);
        }
    }, [search, filterStatus, filterType, filterPaid, filterDateFrom, filterDateTo]);

    const fetchSummary = async () => {
        try {
            const res = await posApi.getOrdersSummary();
            setSummary(res.data);
        } catch (_) {}
    };

    const fetchCancelReasons = async () => {
        try {
            const res = await settingsApi.getCancelReasons();
            setCancelReasons(res.data.filter(r => r.is_active));
        } catch (_) {}
    };

    useEffect(() => {
        fetchSummary();
        fetchCancelReasons();
    }, []);

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => fetchOrders(), 300);
        return () => clearTimeout(searchTimeout.current);
    }, [fetchOrders]);

    const activeFiltersCount = [filterStatus, filterType, filterPaid, filterDateFrom, filterDateTo].filter(Boolean).length;

    const handleClearFilters = () => {
        setFilterStatus('');
        setFilterType('');
        setFilterPaid('');
        setFilterDateFrom('');
        setFilterDateTo('');
    };

    const openCancelModal = (id) => {
        setCancelTargetId(id);
        setSelectedCancelReason('');
        setCustomCancelReason('');
        setShowCancelModal(true);
    };

    const handleCancelOrder = async () => {
        const reason = selectedCancelReason === '__custom__' ? customCancelReason : selectedCancelReason;
        if (!reason.trim()) {
            toast.error('Please select or type a cancellation reason');
            return;
        }
        setIsCancelling(true);
        try {
            await posApi.cancelOrder(cancelTargetId, reason);
            toast.success('Order cancelled');
            setShowCancelModal(false);
            fetchOrders();
            fetchSummary();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Failed to cancel order');
        } finally {
            setIsCancelling(false);
        }
    };

    const openEditModal = (order) => {
        setEditTarget(order);
        setEditNotes(order.notes || '');
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editTarget) return;
        setIsEditing(true);
        try {
            await posApi.updateOrder(editTarget.id, { notes: editNotes });
            toast.success('Order updated');
            setShowEditModal(false);
            fetchOrders();
        } catch (err) {
            toast.error('Failed to update order');
        } finally {
            setIsEditing(false);
        }
    };

    // Reprint receipt for any historical order — available to ALL roles
    const handlePrint = (order) => {
        printReceipt({
            order,
            cart: [],  // order.items will be used (already has full data from GET /orders/)
            subtotal:      parseFloat(order.subtotal        || 0),
            taxInfo:       parseFloat(order.tax_amount      || 0),
            serviceCharge: parseFloat(order.service_charge  || 0),
            discountInfo:  parseFloat(order.discount_amount || 0),
            total:         parseFloat(order.total_amount    || 0),
            payments:      order.payments || [],
            remainingBalance: 0,
        });
    };

    // ---------- Chart Data Preparation ----------
    const dailyChartData = (summary?.daily || []).map(d => ({
        day: format(new Date(d.day), 'dd MMM'),
        Revenue: parseFloat(d.revenue || 0).toFixed(0),
        Orders: d.count || 0,
    }));

    const typeChartData = summary ? [
        { name: 'Dine-In', value: summary.by_type?.dine_in || 0 },
        { name: 'Takeaway', value: summary.by_type?.takeaway || 0 },
        { name: 'Delivery', value: summary.by_type?.delivery || 0 },
    ] : [];

    return (
        <div className="p-6 space-y-6">

            {/* ---- PAGE HEADER ---- */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black text-textMain">Orders</h1>
                    <p className="text-textMuted mt-1">Manage and review all transactions</p>
                </div>
                <button
                    onClick={() => { fetchOrders(); fetchSummary(); }}
                    className="flex items-center gap-2 px-4 py-2 bg-surface border border-slate-200 dark:border-white/10 rounded-xl text-textMuted hover:text-textMain transition-colors text-sm font-semibold"
                >
                    <FiRefreshCw className="w-4 h-4" /> Refresh
                </button>
            </div>

            {/* ---- STATS CARDS ---- */}
            {summary && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                    <StatCard icon={<FiShoppingBag />} label="Total Orders" value={summary.total_orders} color="blue" />
                    <StatCard icon={<FiDollarSign />} label="Total Revenue" value={`${currency} ${parseFloat(summary.total_revenue || 0).toFixed(2)}`} color="emerald" />
                    <StatCard icon={<FiClock />} label="Pending" value={summary.pending_orders} color="amber" />
                    <StatCard icon={<FiAlertTriangle />} label="Cancelled" value={summary.cancelled_orders} color="red" />
                </div>
            )}

            {/* ---- CHARTS ---- */}
            {dailyChartData.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {/* Revenue Area Chart */}
                    <div className="xl:col-span-2 bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-5">
                        <h3 className="text-textMain font-bold mb-4">Revenue (Last 30 Days)</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <AreaChart data={dailyChartData}>
                                <defs>
                                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '10px', color: '#fff' }} />
                                <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGrad)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Orders by Type Bar Chart */}
                    <div className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-5">
                        <h3 className="text-textMain font-bold mb-4">Order Mix</h3>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={typeChartData} barSize={28}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '10px', color: '#fff' }} />
                                <Bar dataKey="value" name="Orders" fill="#6366f1" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}

            {/* ---- FILTER BAR ---- */}
            <div className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex gap-3">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by order #, customer name or phone..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-background text-textMain border border-slate-200 dark:border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:border-primary text-sm"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-textMuted hover:text-textMain">
                                <FiX className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${showFilters || activeFiltersCount > 0 ? 'bg-primary text-white border-primary' : 'bg-background border-slate-200 dark:border-white/10 text-textMuted hover:text-textMain'}`}
                    >
                        <FiFilter className="w-4 h-4" />
                        Filters {activeFiltersCount > 0 && <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>}
                    </button>
                    {activeFiltersCount > 0 && (
                        <button onClick={handleClearFilters} className="text-sm text-red-400 hover:text-red-300 font-semibold px-3">
                            Clear All
                        </button>
                    )}
                </div>

                {showFilters && (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 pt-3 border-t border-slate-200 dark:border-white/10">
                        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input text-sm">
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm">
                            <option value="">All Types</option>
                            <option value="dine_in">Dine-In</option>
                            <option value="takeaway">Takeaway</option>
                            <option value="delivery">Delivery</option>
                        </select>
                        <select value={filterPaid} onChange={e => setFilterPaid(e.target.value)} className="input text-sm">
                            <option value="">All Payment</option>
                            <option value="true">Paid</option>
                            <option value="false">Unpaid</option>
                        </select>
                        <div>
                            <label className="block text-xs text-textMuted mb-1">Date From</label>
                            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} className="input text-sm w-full" />
                        </div>
                        <div>
                            <label className="block text-xs text-textMuted mb-1">Date To</label>
                            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} className="input text-sm w-full" />
                        </div>
                    </div>
                )}
            </div>

            {/* ---- ORDERS TABLE ---- */}
            <div className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
                    <span className="text-textMain font-bold">
                        {isLoading ? 'Loading...' : `${totalCount} Orders`}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-background text-textMuted text-xs uppercase tracking-wide">
                            <tr>
                                <th className="px-4 py-3 text-left">Order #</th>
                                <th className="px-4 py-3 text-left">Date</th>
                                <th className="px-4 py-3 text-left">Type</th>
                                <th className="px-4 py-3 text-left">Customer</th>
                                <th className="px-4 py-3 text-center">Items</th>
                                <th className="px-4 py-3 text-right">Total</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-center">Paid</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-textMuted">
                                        <div className="animate-pulse">Loading orders...</div>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan={9} className="py-16 text-center text-textMuted">
                                        <FiShoppingBag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                        <p>No orders found matching your filters.</p>
                                    </td>
                                </tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id} className="hover:bg-background/50 transition-colors">
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-primary text-xs font-bold">{order.order_number}</span>
                                        </td>
                                        <td className="px-4 py-3 text-textMuted text-xs">
                                            {format(new Date(order.created_at), 'dd/MM/yy HH:mm')}
                                        </td>
                                        <td className="px-4 py-3">
                                            <TypeBadge type={order.order_type} />
                                        </td>
                                        <td className="px-4 py-3 text-textMain">
                                            {order.customer_name || order.customer_phone || <span className="text-textMuted italic">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center text-textMuted">{order.items?.length || 0}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-textMain">
                                            {parseFloat(order.total_amount).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${order.is_paid ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-500/15 text-slate-400'}`}>
                                                {order.is_paid ? '✓ Paid' : 'Unpaid'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* View — all roles */}
                                                <button
                                                    onClick={() => { setSelectedOrder(order); setShowDetailModal(true); }}
                                                    className="p-1.5 rounded-lg text-textMuted hover:text-primary hover:bg-primary/10 transition-colors"
                                                    title="View Details"
                                                >
                                                    <FiEye className="w-4 h-4" />
                                                </button>

                                                {/* Print — all roles */}
                                                <button
                                                    onClick={() => handlePrint(order)}
                                                    className="p-1.5 rounded-lg text-textMuted hover:text-blue-400 hover:bg-blue-400/10 transition-colors"
                                                    title="Reprint Receipt"
                                                >
                                                    <FiPrinter className="w-4 h-4" />
                                                </button>

                                                {/* Edit + Cancel — manager / super_admin only */}
                                                {canManage && order.status !== 'cancelled' && (
                                                    <>
                                                        <button
                                                            onClick={() => openEditModal(order)}
                                                            className="p-1.5 rounded-lg text-textMuted hover:text-amber-400 hover:bg-amber-400/10 transition-colors"
                                                            title="Edit Order"
                                                        >
                                                            <FiEdit2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => openCancelModal(order.id)}
                                                            className="p-1.5 rounded-lg text-textMuted hover:text-red-400 hover:bg-red-400/10 transition-colors"
                                                            title="Cancel Order"
                                                        >
                                                            <FiTrash2 className="w-4 h-4" />
                                                        </button>
                                                    </>
                                                )}

                                                {order.status === 'cancelled' && order.cancel_reason && (
                                                    <span className="text-[10px] text-red-400 italic max-w-[80px] truncate" title={order.cancel_reason}>
                                                        "{order.cancel_reason}"
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ---- ORDER DETAIL MODAL ---- */}
            {showDetailModal && selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDetailModal(false)} />
                    <div className="relative bg-surface w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
                        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-background rounded-t-2xl shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-textMain">{selectedOrder.order_number}</h3>
                                <p className="text-textMuted text-sm mt-0.5">
                                    {format(new Date(selectedOrder.created_at), 'dd MMMM yyyy — HH:mm')}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <StatusBadge status={selectedOrder.status} />
                                <button
                                    onClick={() => handlePrint(selectedOrder)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg text-xs font-bold transition-colors"
                                    title="Reprint Receipt"
                                >
                                    <FiPrinter className="w-3.5 h-3.5" /> Print
                                </button>
                                <button onClick={() => setShowDetailModal(false)} className="text-textMuted hover:text-textMain bg-slate-200 dark:bg-white/5 p-2 rounded-lg">
                                    <FiX />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-5">
                            {/* Meta */}
                            <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-background rounded-xl p-3">
                                    <p className="text-textMuted text-xs mb-1">Order Type</p>
                                    <TypeBadge type={selectedOrder.order_type} />
                                </div>
                                <div className="bg-background rounded-xl p-3">
                                    <p className="text-textMuted text-xs mb-1">Cashier</p>
                                    <p className="text-textMain font-bold">{selectedOrder.waiter_name || '—'}</p>
                                </div>
                                <div className="bg-background rounded-xl p-3">
                                    <p className="text-textMuted text-xs mb-1">Customer</p>
                                    <p className="text-textMain font-bold">{selectedOrder.customer_name || '—'}</p>
                                    {selectedOrder.customer_phone && <p className="text-textMuted text-xs">{selectedOrder.customer_phone}</p>}
                                </div>
                                <div className="bg-background rounded-xl p-3">
                                    <p className="text-textMuted text-xs mb-1">Table</p>
                                    <p className="text-textMain font-bold">{selectedOrder.table_number || '—'}</p>
                                </div>
                            </div>

                            {selectedOrder.cancel_reason && (
                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                    <p className="text-red-400 font-bold text-xs mb-1">Cancellation Reason</p>
                                    <p className="text-textMain text-sm">{selectedOrder.cancel_reason}</p>
                                </div>
                            )}

                            {/* Items */}
                            <div>
                                <h4 className="text-textMain font-bold mb-3 text-sm">Order Items</h4>
                                <div className="space-y-2">
                                    {selectedOrder.items?.map((item, i) => (
                                        <div key={i} className="flex justify-between items-center bg-background rounded-xl p-3 text-sm">
                                            <div>
                                                <p className="text-textMain font-semibold">{item.product_name}</p>
                                                {item.modifiers_details?.length > 0 && (
                                                    <p className="text-textMuted text-xs mt-0.5">{item.modifiers_details.map(m => m.name).join(', ')}</p>
                                                )}
                                                {item.special_instructions && (
                                                    <p className="text-yellow-400/70 text-xs italic mt-0.5">"{item.special_instructions}"</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-textMuted text-xs">{item.quantity}x</p>
                                                <p className="text-textMain font-mono font-bold">{parseFloat(item.total_price).toFixed(2)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totals */}
                            <div className="bg-background rounded-xl p-4 space-y-2 text-sm font-mono">
                                <div className="flex justify-between text-textMuted">
                                    <span>Subtotal</span><span>{parseFloat(selectedOrder.subtotal).toFixed(2)}</span>
                                </div>
                                {parseFloat(selectedOrder.tax_amount) > 0 && (
                                    <div className="flex justify-between text-textMuted">
                                        <span>Tax</span><span>{parseFloat(selectedOrder.tax_amount).toFixed(2)}</span>
                                    </div>
                                )}
                                {parseFloat(selectedOrder.service_charge) > 0 && (
                                    <div className="flex justify-between text-textMuted">
                                        <span>Service</span><span>{parseFloat(selectedOrder.service_charge).toFixed(2)}</span>
                                    </div>
                                )}
                                {parseFloat(selectedOrder.discount_amount) > 0 && (
                                    <div className="flex justify-between text-emerald-400">
                                        <span>Discount</span><span>-{parseFloat(selectedOrder.discount_amount).toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between text-textMain font-black text-lg pt-2 border-t border-slate-200 dark:border-white/10">
                                    <span>Total</span><span>{currency} {parseFloat(selectedOrder.total_amount).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Payments */}
                            {selectedOrder.payments?.length > 0 && (
                                <div>
                                    <h4 className="text-textMain font-bold mb-3 text-sm">Payments</h4>
                                    <div className="space-y-2">
                                        {selectedOrder.payments.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center bg-background rounded-xl p-3 text-sm">
                                                <span className="text-textMain capitalize">{p.payment_method?.replace('_', ' ')}</span>
                                                <span className="text-emerald-400 font-mono font-bold">{parseFloat(p.amount).toFixed(2)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ---- CANCEL MODAL ---- */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
                    <div className="relative bg-surface w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-fade-in-up">
                        <div className="p-5 border-b border-white/10 flex justify-between items-center bg-background rounded-t-2xl">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
                                    <FiTrash2 className="text-red-400 w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-textMain font-black">Cancel Order</h3>
                                    <p className="text-textMuted text-xs">Select a reason to confirm</p>
                                </div>
                            </div>
                            <button onClick={() => setShowCancelModal(false)} className="text-textMuted hover:text-textMain p-2"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-textMuted text-sm">Why is this order being cancelled?</p>
                            <div className="space-y-2">
                                {cancelReasons.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => setSelectedCancelReason(r.label)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${selectedCancelReason === r.label ? 'bg-red-500/15 border-red-500/40 text-red-400' : 'bg-background border-slate-200 dark:border-white/10 text-textMuted hover:border-red-400/30 hover:text-textMain'}`}
                                    >
                                        {r.label}
                                    </button>
                                ))}
                                <button
                                    onClick={() => setSelectedCancelReason('__custom__')}
                                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${selectedCancelReason === '__custom__' ? 'bg-slate-500/15 border-slate-500/40 text-textMain' : 'bg-background border-slate-200 dark:border-white/10 text-textMuted hover:border-white/20'}`}
                                >
                                    Other (type your reason)
                                </button>
                            </div>
                            {selectedCancelReason === '__custom__' && (
                                <textarea
                                    value={customCancelReason}
                                    onChange={e => setCustomCancelReason(e.target.value)}
                                    placeholder="Describe the reason for cancellation..."
                                    className="w-full bg-background border border-slate-200 dark:border-white/10 text-textMain rounded-xl p-3 text-sm focus:outline-none focus:border-red-400 h-24 resize-none"
                                />
                            )}
                        </div>
                        <div className="p-5 border-t border-white/10 bg-background rounded-b-2xl flex gap-3">
                            <button onClick={() => setShowCancelModal(false)} className="flex-1 py-3 bg-surface border border-slate-200 dark:border-white/10 text-textMuted hover:text-textMain rounded-xl font-bold text-sm transition-colors">
                                Keep Order
                            </button>
                            <button
                                onClick={handleCancelOrder}
                                disabled={isCancelling || (!selectedCancelReason || (selectedCancelReason === '__custom__' && !customCancelReason.trim()))}
                                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-xl font-black text-sm transition-colors"
                            >
                                {isCancelling ? 'Cancelling...' : 'Confirm Cancel'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ---- EDIT MODAL ---- */}
            {showEditModal && editTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)} />
                    <div className="relative bg-surface w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl animate-fade-in-up">
                        <div className="p-5 border-b border-white/10 bg-background rounded-t-2xl flex justify-between items-center">
                            <div>
                                <h3 className="text-textMain font-black">Edit Order</h3>
                                <p className="text-textMuted text-xs">{editTarget.order_number}</p>
                            </div>
                            <button onClick={() => setShowEditModal(false)} className="text-textMuted hover:text-textMain p-2"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-textMuted mb-2">Order Notes</label>
                                <textarea
                                    value={editNotes}
                                    onChange={e => setEditNotes(e.target.value)}
                                    placeholder="Add or update notes for this order..."
                                    className="w-full bg-background border border-slate-200 dark:border-white/10 text-textMain rounded-xl p-3 text-sm focus:outline-none focus:border-primary h-28 resize-none"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-background rounded-b-2xl flex gap-3">
                            <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 bg-surface border border-slate-200 dark:border-white/10 text-textMuted hover:text-textMain rounded-xl font-bold text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEdit}
                                disabled={isEditing}
                                className="flex-1 py-3 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-xl font-black text-sm"
                            >
                                {isEditing ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ---------- Stat Card Sub-Component ----------
const StatCard = ({ icon, label, value, color }) => {
    const colors = {
        blue: 'bg-blue-500/15 text-blue-400',
        emerald: 'bg-emerald-500/15 text-emerald-400',
        amber: 'bg-amber-500/15 text-amber-400',
        red: 'bg-red-500/15 text-red-400',
    };
    return (
        <div className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${colors[color]}`}>
                {icon}
            </div>
            <div>
                <p className="text-textMuted text-xs font-semibold">{label}</p>
                <p className="text-textMain font-black text-xl mt-0.5">{value}</p>
            </div>
        </div>
    );
};

export default OrdersPage;
