import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrendingDown, FiAlertCircle, FiDollarSign, FiBox, FiPlus } from 'react-icons/fi';
import { inventoryApi } from '../../api/inventoryApi';
import { purchasingApi } from '../../api/purchasingApi';
import useSettingsStore from '../../store/settingsStore';

const InventoryDashboard = () => {
    const [metrics, setMetrics] = useState({
        totalMaterials: 0,
        lowStockItems: 0,
        pendingPOs: 0,
        recentMovements: []
    });
    const [isLoading, setIsLoading] = useState(true);
    const navigate = useNavigate();

    const { settings } = useSettingsStore();

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                const [matsRes, lowStockRes, poRes, movesRes] = await Promise.all([
                    inventoryApi.getMaterials(),
                    inventoryApi.getLowStock(),
                    purchasingApi.getOrders(),
                    inventoryApi.getMovements({ limit: 5 }) // Assuming backend supports pagination limits
                ]);

                // Calculate some frontend metrics
                const pendingOrders = poRes.data.filter(po => ['draft', 'confirmed', 'partially_received'].includes(po.status));

                setMetrics({
                    totalMaterials: matsRes.data.length,
                    lowStockItems: lowStockRes.data.data.length, // Nested because of custom action format
                    pendingPOs: pendingOrders.length,
                    recentMovements: movesRes.data.results || movesRes.data.slice(0, 5) // Fallback if no pagination wrapper
                });
            } catch (error) {
                console.error("Dashboard feed error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    const StatCard = ({ title, value, icon: Icon, colorClass }) => (
        <div className="glass-panel p-6 flex items-center space-x-4">
            <div className={`p-4 rounded-xl ${colorClass}`}>
                <Icon className="w-8 h-8" />
            </div>
            <div>
                <p className="text-sm font-medium text-textMuted uppercase tracking-wider">{title}</p>
                <div className="flex items-baseline space-x-2">
                    <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
                </div>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="p-6">
                <div className="h-8 w-64 bg-white/5 rounded animate-pulse mb-8"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white/5 rounded-xl animate-pulse"></div>)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">
                    Inventory Overview
                </h1>
                <p className="text-textMuted mt-1">Real-time metrics and alerts for your stock.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                    title="Tracked Items" 
                    value={metrics.totalMaterials} 
                    icon={FiBox} 
                    colorClass="bg-blue-500/20 text-blue-400" 
                />
                <StatCard 
                    title="Low Stock Alerts" 
                    value={metrics.lowStockItems} 
                    icon={FiAlertCircle} 
                    colorClass="bg-red-500/20 text-red-400" 
                />
                <StatCard 
                    title="Active Orders" 
                    value={metrics.pendingPOs} 
                    icon={FiTrendingDown} 
                    colorClass="bg-yellow-500/20 text-yellow-400" 
                />
                <StatCard 
                    title="Total Value" 
                    value="---" // Would require a specific backend endpoint to calculate precisely
                    icon={FiDollarSign} 
                    colorClass="bg-green-500/20 text-green-400" 
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activity Log */}
                <div className="lg:col-span-2 glass-panel p-6">
                    <h2 className="text-xl font-bold text-white mb-6">Recent Stock Movements</h2>
                    <div className="space-y-4">
                        {metrics.recentMovements.length === 0 ? (
                            <p className="text-textMuted text-center py-8">No recent activity detected.</p>
                        ) : metrics.recentMovements.map(movement => (
                            <div key={movement.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                                <div className="flex items-center space-x-4">
                                    <div className={`p-2 rounded-full ${
                                        movement.movement_type === 'purchase' || movement.movement_type === 'manual_adjustment' && parseFloat(movement.quantity) > 0
                                            ? 'bg-green-500/20 text-green-400' 
                                            : 'bg-red-500/20 text-red-400'
                                    }`}>
                                        <FiTrendingDown className={`w-5 h-5 ${
                                            movement.movement_type === 'purchase' || movement.movement_type === 'manual_adjustment' && parseFloat(movement.quantity) > 0 
                                                ? 'rotate-180' 
                                                : ''
                                            }`} 
                                        />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{movement.raw_material_name}</p>
                                        <p className="text-xs text-textMuted flex items-center space-x-2">
                                            <span className="uppercase tracking-wider">{movement.movement_type.replace('_', ' ')}</span>
                                            <span>•</span>
                                            <span>{new Date(movement.created_at).toLocaleString()}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold font-mono ${
                                        movement.movement_type === 'purchase' || movement.movement_type === 'manual_adjustment' && parseFloat(movement.quantity) > 0
                                            ? 'text-green-400' 
                                            : 'text-red-400'
                                    }`}>
                                        {parseFloat(movement.quantity) > 0 ? '+' : ''}{parseFloat(movement.quantity)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="space-y-6">
                    <div className="glass-panel p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Quick Actions</h2>
                        <div className="space-y-3">
                            <button 
                                onClick={() => navigate('/inventory/waste')}
                                className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between group"
                            >
                                <span className="font-medium text-white">Log Waste</span>
                                <FiPlus className="text-textMuted group-hover:text-primary transition-colors" />
                            </button>
                            <button 
                                onClick={() => navigate('/inventory/counts')}
                                className="w-full text-left px-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between group"
                            >
                                <span className="font-medium text-white">Start Physical Count</span>
                                <FiPlus className="text-textMuted group-hover:text-primary transition-colors" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryDashboard;
