import React, { useState, useEffect } from 'react';
import { 
    FiX, FiTrendingUp, FiActivity, FiDollarSign, FiShoppingBag, FiCalendar 
} from 'react-icons/fi';
import { 
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
    BarChart, Bar, Cell
} from 'recharts';
import { inventoryApi } from '../../api/inventoryApi';
import useSettingsStore from '../../store/settingsStore';
import { format, subDays } from 'date-fns';

export default function ProductAnalyticsModal({ product, onClose }) {
    const { settings } = useSettingsStore();
    const currency = settings?.currency || '$';
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState('30days'); // 7days, 30days, all

    useEffect(() => {
        if (product) fetchAnalytics();
    }, [product, dateRange]);

    const fetchAnalytics = async () => {
        setIsLoading(true);
        try {
            const params = {};
            if (dateRange !== 'all') {
                const days = dateRange === '7days' ? 7 : 30;
                params.start_date = format(subDays(new Date(), days), 'yyyy-MM-dd');
            }
            
            const res = await inventoryApi.getProductAnalytics(product.id, params);
            setData(res.data);
        } catch (error) {
            console.error("Failed to load analytics", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!product) return null;

    const COLORS = {
        'dine_in': '#3b82f6',
        'takeaway': '#10b981',
        'delivery': '#f59e0b'
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
            <div className="glass-panel w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
                
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                            <FiActivity className="text-primary" />
                            <span>Analytics: {product.name}</span>
                        </h2>
                        <p className="text-sm text-textMuted mt-1">Performance and sales metrics</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors">
                        <FiX className="w-5 h-5 text-textMuted hover:text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-gradient-to-b from-transparent to-black/20">
                    
                    {/* Filters */}
                    <div className="flex justify-end mb-6">
                        <div className="flex bg-black/20 rounded-lg p-1 border border-white/5">
                            <button 
                                onClick={() => setDateRange('7days')}
                                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${dateRange === '7days' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}
                            >
                                Last 7 Days
                            </button>
                            <button 
                                onClick={() => setDateRange('30days')}
                                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${dateRange === '30days' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}
                            >
                                Last 30 Days
                            </button>
                            <button 
                                onClick={() => setDateRange('all')}
                                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${dateRange === 'all' ? 'bg-primary text-white shadow-lg' : 'text-textMuted hover:text-white'}`}
                            >
                                All Time
                            </button>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                            <p className="text-textMuted">Crunching numbers...</p>
                        </div>
                    ) : !data ? (
                        <div className="text-center py-20 text-textMuted">No data available</div>
                    ) : (
                        <div className="space-y-6 animate-fade-in">
                            
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-black/20 border border-white/10 p-5 rounded-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <FiShoppingBag className="w-16 h-16 text-primary" />
                                    </div>
                                    <p className="text-sm font-medium text-textMuted mb-1">Total Quantity Sold</p>
                                    <h3 className="text-3xl font-bold text-white relative z-10">{data.total_quantity} <span className="text-base font-normal text-textMuted">units</span></h3>
                                </div>
                                <div className="bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20 p-5 rounded-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <FiDollarSign className="w-16 h-16 text-green-500" />
                                    </div>
                                    <p className="text-sm font-medium text-green-400 mb-1">Total Gross Revenue</p>
                                    <h3 className="text-3xl font-bold text-white relative z-10">{currency}{(data.total_revenue || 0).toFixed(2)}</h3>
                                </div>
                                <div className="bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20 p-5 rounded-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                        <FiTrendingUp className="w-16 h-16 text-blue-500" />
                                    </div>
                                    <p className="text-sm font-medium text-blue-400 mb-1">Estimated Net Profit</p>
                                    <h3 className="text-3xl font-bold text-white relative z-10">{currency}{(data.net_profit || 0).toFixed(2)}</h3>
                                    {product.cost_price === 0 && (
                                        <p className="text-xs text-yellow-500 mt-1 mt-2">Cost price is currently set to 0</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Sales Trend Chart */}
                                <div className="lg:col-span-2 glass-panel p-5 rounded-2xl border-white/5">
                                    <h3 className="text-white font-bold mb-6 flex items-center"><FiCalendar className="mr-2 text-textMuted"/> Sales Trend</h3>
                                    <div className="h-64">
                                        {data.sales_trend?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={100}>
                                                <LineChart data={data.sales_trend} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        stroke="#64748b" 
                                                        fontSize={12} 
                                                        tickMargin={10} 
                                                        axisLine={false} 
                                                        tickLine={false}
                                                    />
                                                    <YAxis 
                                                        yAxisId="left"
                                                        stroke="#64748b" 
                                                        fontSize={12} 
                                                        tickMargin={10}
                                                        axisLine={false}
                                                        tickLine={false}
                                                    />
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem', color: '#fff' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                    <Line 
                                                        yAxisId="left" 
                                                        type="monotone" 
                                                        dataKey="quantity" 
                                                        name="Qty Sold" 
                                                        stroke="#3b82f6" 
                                                        strokeWidth={3}
                                                        dot={{ r: 4, strokeWidth: 2, fill: '#1e293b' }} 
                                                        activeDot={{ r: 6, strokeWidth: 0 }} 
                                                    />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-textMuted border border-dashed border-white/5 rounded-xl bg-white/5">
                                                No timeline data for this period
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Order Types Breakdown */}
                                <div className="glass-panel p-5 rounded-2xl border-white/5">
                                    <h3 className="text-white font-bold mb-6">Channel Breakdown</h3>
                                    <div className="h-64">
                                        {data.type_breakdown?.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%" minHeight={200} minWidth={100}>
                                                <BarChart data={data.type_breakdown} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                                    <XAxis type="number" hide />
                                                    <YAxis 
                                                        dataKey="order__order_type" 
                                                        type="category" 
                                                        axisLine={false} 
                                                        tickLine={false} 
                                                        tick={{fill: '#e2e8f0', fontSize: 12}}
                                                        width={70}
                                                        tickFormatter={(val) => val.charAt(0).toUpperCase() + val.slice(1).replace('_', '-')}
                                                    />
                                                    <Tooltip 
                                                        cursor={{fill: 'rgba(255,255,255,0.05)'}}
                                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem' }}
                                                    />
                                                    <Bar dataKey="count" name="Orders" radius={[0, 4, 4, 0]} barSize={20}>
                                                        {data.type_breakdown.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={COLORS[entry.order__order_type] || '#8b5cf6'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-textMuted border border-dashed border-white/5 rounded-xl bg-white/5 text-center px-4">
                                                No channel data available
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
