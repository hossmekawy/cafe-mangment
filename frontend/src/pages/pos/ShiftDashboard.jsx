import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiClock, FiDollarSign, FiShoppingBag, FiRefreshCw, FiCreditCard, FiActivity } from 'react-icons/fi';
import { financeApi } from '../../api/financeApi';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';
import PageHeader from '../../components/PageHeader';

const PAYMENT_ICONS = {
    cash: '💵', card: '💳', fawry: '📱', instapay: '📲',
    vodafone_cash: '🔴', tab: '📋',
};

const PAYMENT_LABELS = {
    cash: 'Cash', card: 'Card', fawry: 'Fawry',
    instapay: 'InstaPay', vodafone_cash: 'Vodafone Cash', tab: 'Tab',
};

const ORDER_TYPE_LABELS = { dine_in: 'Dine-In', takeaway: 'Takeaway', delivery: 'Delivery' };

export default function ShiftDashboard() {
    const navigate = useNavigate();
    const [shift, setShift] = useState(null);
    const [summary, setSummary] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        else setIsRefreshing(true);
        try {
            const shiftRes = await financeApi.getCurrentShift();
            setShift(shiftRes.data);
            const sumRes = await financeApi.getShiftSummary(shiftRes.data.id);
            setSummary(sumRes.data);
        } catch (err) {
            if (err.response?.status === 404) {
                setShift(null);
                setSummary(null);
            } else {
                toast.error('Failed to load shift data');
            }
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-refresh every 60 seconds
    useEffect(() => {
        const timer = setInterval(() => loadData(true), 60000);
        return () => clearInterval(timer);
    }, [loadData]);

    const fmt = (v) => parseFloat(v || 0).toFixed(2);
    const fmtTime = (dt) => dt ? format(new Date(dt), 'hh:mm a') : '—';
    const fmtDate = (dt) => dt ? format(new Date(dt), 'dd/MM/yyyy') : '—';
    const elapsed = shift ? (() => {
        const ms = Date.now() - new Date(shift.opened_at).getTime();
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `${h}h ${m}m`;
    })() : '—';

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-textMuted animate-pulse text-lg">Loading shift...</div>
            </div>
        );
    }

    if (!shift) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30">
                    <FiClock className="w-10 h-10 text-yellow-400" />
                </div>
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-2">No Active Shift</h2>
                    <p className="text-textMuted">You don't have an open shift. Please start a shift to begin selling.</p>
                </div>
                <button
                    onClick={() => navigate('/finance/cash-register')}
                    className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all"
                >
                    Open Cash Register
                </button>
            </div>
        );
    }

    const breakdown = summary?.payment_breakdown || {};
    const orderList = summary?.order_list || [];

    return (
        <div className="p-6 space-y-6 animate-fade-in">
            <PageHeader
                title={`My Shift — #${summary?.shift_number || shift.shift_number}`}
                subtitle={`Started ${fmtDate(shift.opened_at)} at ${fmtTime(shift.opened_at)} · Running for ${elapsed}`}
                icon={FiActivity}
                actions={
                    <button
                        onClick={() => loadData(true)}
                        disabled={isRefreshing}
                        className="btn bg-white/5 hover:bg-white/10 text-white flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                    >
                        <FiRefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                }
            />

            {/* ── KPI Cards ──────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel p-5 border-l-4 border-green-500">
                    <p className="text-textMuted text-xs uppercase tracking-wider font-medium">Total Sales</p>
                    <p className="text-2xl font-black text-white mt-1">
                        {fmt(summary?.total_revenue)} <span className="text-sm font-normal text-textMuted">EGP</span>
                    </p>
                </div>
                <div className="glass-panel p-5 border-l-4 border-primary">
                    <p className="text-textMuted text-xs uppercase tracking-wider font-medium">Orders</p>
                    <p className="text-2xl font-black text-white mt-1">{summary?.order_count ?? '—'}</p>
                </div>
                <div className="glass-panel p-5 border-l-4 border-yellow-500">
                    <p className="text-textMuted text-xs uppercase tracking-wider font-medium">Opening Float</p>
                    <p className="text-2xl font-black text-white mt-1">
                        {fmt(summary?.opening_cash)} <span className="text-sm font-normal text-textMuted">EGP</span>
                    </p>
                </div>
                <div className="glass-panel p-5 border-l-4 border-purple-500">
                    <p className="text-textMuted text-xs uppercase tracking-wider font-medium">Discounts Given</p>
                    <p className="text-2xl font-black text-white mt-1">
                        {fmt(summary?.total_discounts)} <span className="text-sm font-normal text-textMuted">EGP</span>
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* ── Payment Breakdown ──────────────────── */}
                <div className="glass-panel p-6">
                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <FiCreditCard className="text-primary" /> Payment Breakdown
                    </h3>
                    {Object.keys(breakdown).length === 0 ? (
                        <p className="text-textMuted text-sm text-center py-6">No payments yet</p>
                    ) : (
                        <div className="space-y-3">
                            {Object.entries(breakdown).map(([method, amount]) => {
                                const pct = summary?.total_revenue
                                    ? Math.round((amount / summary.total_revenue) * 100)
                                    : 0;
                                return (
                                    <div key={method}>
                                        <div className="flex justify-between text-sm mb-1">
                                            <span className="text-textMuted">
                                                {PAYMENT_ICONS[method] || '💰'} {PAYMENT_LABELS[method] || method}
                                            </span>
                                            <span className="font-bold text-white">{fmt(amount)} EGP</span>
                                        </div>
                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Order List ─────────────────────────── */}
                <div className="lg:col-span-2 glass-panel p-6">
                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                        <FiShoppingBag className="text-primary" />
                        Orders This Shift
                        <span className="ml-auto text-xs text-textMuted font-normal">Last 50 shown</span>
                    </h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-xs text-textMuted uppercase">
                                <tr className="border-b border-white/5">
                                    <th className="py-2 px-3 text-left">Order #</th>
                                    <th className="py-2 px-3 text-left">Type</th>
                                    <th className="py-2 px-3 text-left">Time</th>
                                    <th className="py-2 px-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orderList.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="py-10 text-center text-textMuted">
                                            No completed orders yet in this shift
                                        </td>
                                    </tr>
                                ) : orderList.map((order) => (
                                    <tr key={order.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="py-2.5 px-3 font-mono font-bold text-white">
                                            #{order.order_number}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                                {ORDER_TYPE_LABELS[order.order_type] || order.order_type}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-textMuted text-xs">
                                            {fmtTime(order.created_at)}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-green-400">
                                            {fmt(order.total_amount)} EGP
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ── Quick Actions ──────────────────────────── */}
            <div className="flex justify-center pt-2">
                <button
                    onClick={() => navigate('/pos')}
                    className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all flex items-center gap-2"
                >
                    <FiDollarSign /> Go to POS
                </button>
            </div>
        </div>
    );
}
