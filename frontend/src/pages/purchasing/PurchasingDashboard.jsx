import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiShoppingCart, FiDollarSign, FiClock, FiAlertCircle, 
  FiArrowRight, FiTruck, FiFileText
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import { purchasingApi } from '../../api/purchasingApi';
import useSettingsStore from '../../store/settingsStore';
import toast from 'react-hot-toast';

const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="glass-panel p-6 relative overflow-hidden group">
        <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-10 blur-2xl group-hover:scale-150 transition-transform duration-500`} style={{ backgroundColor: color }}></div>
        <div className="flex items-start justify-between relative z-10">
            <div>
                <p className="text-textMuted text-sm font-medium mb-1">{title}</p>
                <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>
                {subtitle && <p className="text-xs text-textMuted mt-2">{subtitle}</p>}
            </div>
            <div className={`p-3 rounded-xl`} style={{ backgroundColor: `${color}20`, color: color }}>
                <Icon className="w-6 h-6" />
            </div>
        </div>
    </div>
);

const PurchasingDashboard = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState({
        activePOs: 0,
        pendingDeliveries: 0,
        unpaidInvoices: 0,
        totalSpendMTD: 0
    });
    const [recentActivity, setRecentActivity] = useState({
        pos: [],
        grns: []
    });

    const { settings } = useSettingsStore();

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true);
            try {
                // Fetching all necessary data to calculate stats
                const [poRes, grnRes, invRes] = await Promise.all([
                    purchasingApi.getOrders(),
                    purchasingApi.getGRNs(),
                    purchasingApi.getInvoices()
                ]);

                const pos = poRes.data;
                const grns = grnRes.data;
                const invoices = invRes.data;

                // Calculate Metrics
                const activePOs = pos.filter(po => ['confirmed', 'partially_received'].includes(po.status)).length;
                const pendingDeliveries = grns.filter(grn => grn.status === 'pending').length;
                const unpaidInvoices = invoices.filter(inv => ['pending', 'partially_paid'].includes(inv.status)).length;
                
                // Calculate Spend for Current Month
                const currentMonth = new Date().getMonth();
                const currentYear = new Date().getFullYear();
                
                const mtdSpend = invoices
                    .filter(inv => {
                        const invDate = new Date(inv.invoice_date);
                        return invDate.getMonth() === currentMonth && invDate.getFullYear() === currentYear;
                    })
                    .reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0);

                setStats({
                    activePOs,
                    pendingDeliveries,
                    unpaidInvoices,
                    totalSpendMTD: mtdSpend
                });

                // Grab 5 most recent
                setRecentActivity({
                    pos: pos.slice(0, 5),
                    grns: grns.slice(0, 5)
                });

            } catch (error) {
                console.error("Dashboard error:", error);
                toast.error("Failed to load purchasing dashboard data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (isLoading) {
        return (
            <div className="p-6 md:p-8 pt-24 h-full flex flex-col justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mb-4"></div>
                <p className="text-textMuted">Loading Purchasing Metrics...</p>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 pt-24">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Purchasing Command Center</h1>
                <p className="text-textMuted">Monitor your supply chain, orders, and financial commitments.</p>
            </div>

            {/* Top Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard 
                    title="Active Purchase Orders" 
                    value={stats.activePOs} 
                    icon={FiShoppingCart} 
                    color="#3b82f6" // Blue
                    subtitle="Awaiting full delivery"
                />
                <StatCard 
                    title="Pending Deliveries" 
                    value={stats.pendingDeliveries} 
                    icon={FiTruck} 
                    color="#eab308" // Yellow
                    subtitle="GRNs needing confirmation"
                />
                <StatCard 
                    title="Unpaid/Partial Invoices" 
                    value={stats.unpaidInvoices} 
                    icon={FiAlertCircle} 
                    color="#ef4444" // Red
                    subtitle="Action required for suppliers"
                />
                <StatCard 
                    title="Month-to-Date Spend" 
                    value={`${settings?.currency || '$'}${stats.totalSpendMTD.toFixed(2)}`} 
                    icon={FiDollarSign} 
                    color="#22c55e" // Green
                    subtitle="Total invoiced this month"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recent POs */}
                <div className="glass-panel p-6 flex flex-col h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-2">
                            <FiFileText className="text-primary w-5 h-5" />
                            <h3 className="text-lg font-bold text-white">Recent POs</h3>
                        </div>
                        <Link to="/purchasing/orders" className="text-xs font-medium text-primary hover:text-primary/80 flex items-center transition-colors">
                            View All <FiArrowRight className="ml-1" />
                        </Link>
                    </div>
                    
                    <div className="overflow-y-auto pr-2 space-y-3 flex-1 pb-4 custom-scrollbar">
                        {recentActivity.pos.length > 0 ? (
                            recentActivity.pos.map(po => (
                                <Link to="/purchasing/orders" key={po.id} className="block bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/5 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-semibold text-white tracking-wide">{po.po_number}</p>
                                        <span className="text-xs font-mono text-accent">{settings?.currency || '$'}{parseFloat(po.total_amount).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-textMuted">{po.supplier_name}</p>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            po.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                                            po.status === 'received' ? 'bg-green-500/20 text-green-400' :
                                            po.status === 'draft' ? 'bg-gray-500/20 text-gray-400' :
                                            'bg-yellow-500/20 text-yellow-500'
                                        }`}>
                                            {po.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-textMuted opacity-50">
                                <FiFileText className="w-12 h-12 mb-3" />
                                <p>No recent purchase orders</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Recent Goods Received */}
                <div className="glass-panel p-6 flex flex-col h-[400px]">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center space-x-2">
                            <FiTruck className="text-yellow-400 w-5 h-5" />
                            <h3 className="text-lg font-bold text-white">Recent GRNs</h3>
                        </div>
                        <Link to="/purchasing/grn" className="text-xs font-medium text-primary hover:text-primary/80 flex items-center transition-colors">
                            View All <FiArrowRight className="ml-1" />
                        </Link>
                    </div>
                    
                    <div className="overflow-y-auto pr-2 space-y-3 flex-1 pb-4 custom-scrollbar">
                        {recentActivity.grns.length > 0 ? (
                            recentActivity.grns.map(grn => (
                                <Link to="/purchasing/grn" key={grn.id} className="block bg-white/5 hover:bg-white/10 p-4 rounded-xl border border-white/5 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <p className="font-semibold text-white tracking-wide">{grn.grn_number}</p>
                                        <p className="text-xs text-textMuted">{new Date(grn.received_date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <p className="text-sm text-textMuted">{grn.supplier_name}</p>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            grn.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-500'
                                        }`}>
                                            {grn.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-textMuted opacity-50">
                                <FiTruck className="w-12 h-12 mb-3" />
                                <p>No recent goods received</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Quick Actions (Optional Add-on if layout needs balance later) */}
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link to="/purchasing/orders" className="glass-panel p-6 flex items-center space-x-4 hover:border-primary/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FiShoppingCart className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white group-hover:text-primary transition-colors">Draft Purchase Order</h4>
                        <p className="text-sm text-textMuted">Order new stock from suppliers</p>
                    </div>
                </Link>
                <Link to="/purchasing/grn" className="glass-panel p-6 flex items-center space-x-4 hover:border-yellow-500/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500/20 text-yellow-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FiTruck className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white group-hover:text-yellow-400 transition-colors">Receive Goods</h4>
                        <p className="text-sm text-textMuted">Process incoming deliveries</p>
                    </div>
                </Link>
                <Link to="/purchasing/invoices" className="glass-panel p-6 flex items-center space-x-4 hover:border-green-500/50 transition-colors cursor-pointer group">
                    <div className="w-12 h-12 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FiDollarSign className="w-6 h-6" />
                    </div>
                    <div>
                        <h4 className="font-bold text-white group-hover:text-green-400 transition-colors">Pay Invoices</h4>
                        <p className="text-sm text-textMuted">Settle balances with suppliers</p>
                    </div>
                </Link>
            </div>
        </div>
    );
};

export default PurchasingDashboard;
