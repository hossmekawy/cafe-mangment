import React, { useState, useEffect } from 'react';
import { posApi } from '../../api/posApi';
import toast from 'react-hot-toast';
import { FiClock, FiCheck, FiFilter, FiAlertCircle } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import useSettingsStore from '../../store/settingsStore';

const KDS = () => {
    const [items, setItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stationFilter, setStationFilter] = useState(''); // '' means all
    const [statusFilter, setStatusFilter] = useState('pending,preparing'); // active items only by default
    
    // Auto-refresh interval
    const REFRESH_INTERVAL = 10000; // 10 seconds

    useEffect(() => {
        fetchKDSItems();
        const interval = setInterval(fetchKDSItems, REFRESH_INTERVAL);
        return () => clearInterval(interval);
    }, [stationFilter, statusFilter]);

    const fetchKDSItems = async () => {
        try {
            const response = await posApi.getKDSItems(stationFilter, statusFilter);
            setItems(response.data);
            setIsLoading(false);
        } catch (error) {
            console.error("Failed to load KDS items", error);
            // Don't toast error on auto-refresh to avoid spam
            if (isLoading) toast.error("Failed to connect to KDS");
        }
    };

    const handleBumpStatus = async (itemId, currentStatus) => {
        const nextStatusMap = {
            'pending': 'preparing',
            'preparing': 'ready',
            'ready': 'delivered' // or hidden
        };
        
        const newStatus = nextStatusMap[currentStatus];
        if (!newStatus) return;

        // Optimistic update
        setItems(prev => prev.map(item => 
            item.id === itemId 
                ? { ...item, status: newStatus } 
                : item
        ));

        try {
            await posApi.bumpItemStatus(itemId, newStatus);
            // Re-fetch to ensure sync
            fetchKDSItems();
        } catch (error) {
            toast.error("Failed to bump ticket state");
            fetchKDSItems(); // Revert on failure
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
            case 'preparing': return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
            case 'ready': return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
            default: return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
        }
    };
    
    // Group items by Order for better ticket visualization
    // We get a flat list of items, so let's group them by order
    const groupedOrders = items.reduce((acc, item) => {
        if (!acc[item.order]) {
            acc[item.order] = {
                order_id: item.order,
                order_name: item.order_number || `Order #${item.order}`,
                table: item.table_number ? `Table ${item.table_number}` : 'Takeaway/Delivery',
                order_type: item.order_type || 'Unknown',
                created_at: item.created_at, // Use the oldest item's created_at for the whole ticket
                items: []
            };
        }
        acc[item.order].items.push(item);
        
        // Update ticket creation time if we find an older item
        if (new Date(item.created_at) < new Date(acc[item.order].created_at)) {
            acc[item.order].created_at = item.created_at;
        }
        
        return acc;
    }, {});
    
    const tickets = Object.values(groupedOrders).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    // Calculate urgency
    const getUrgencyColor = (createdAt) => {
        const minutesOld = (new Date() - new Date(createdAt)) / 60000;
        if (minutesOld > 15) return 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] animate-pulse';
        if (minutesOld > 10) return 'border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]';
        return 'border-white/10 shadow-lg';
    };

    const formatTime = (isoString) => {
        try {
            return formatDistanceToNow(new Date(isoString), { addSuffix: true }).replace('about ', '');
        } catch (e) {
            return 'Just now';
        }
    };

    return (
        <div className="h-screen flex flex-col bg-[#0B1121] overflow-hidden">
            
            {/* Header / Navbar */}
            <div className="h-16 bg-[#0f172a] border-b border-white/10 flex items-center justify-between px-6 shrink-0 z-10 shadow-xl">
                <div className="flex items-center space-x-4">
                    <h1 className="text-2xl font-black text-white px-2 py-1 bg-gradient-to-r from-red-500 to-orange-500 rounded-md">KDS</h1>
                    <span className="text-textMuted font-bold text-sm hidden md:inline-block">Kitchen Display System</span>
                </div>
                
                <div className="flex items-center space-x-4">
                    {/* Station Filter */}
                    <div className="flex items-center space-x-2 bg-white/5 rounded-lg border border-white/10 p-1">
                        <FiFilter className="text-textMuted ml-2" />
                        <select 
                            value={stationFilter}
                            onChange={(e) => setStationFilter(e.target.value)}
                            className="bg-transparent text-white font-bold text-sm focus:outline-none p-2 w-32"
                        >
                            <option value="" className="text-black">All Stations</option>
                            <option value="hot" className="text-black">Hot Kitchen</option>
                            <option value="cold" className="text-black">Cold / Drinks</option>
                            <option value="dessert" className="text-black">Dessert</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Board Canvas */}
            <div className="flex-1 p-6 overflow-x-auto overflow-y-hidden flex space-x-6 custom-scrollbar h-full">
                
                {isLoading ? (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    </div>
                ) : tickets.length === 0 ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white/30 space-y-4">
                        <FiCheck className="w-24 h-24 opacity-20" />
                        <h2 className="text-2xl font-black">All Caught Up!</h2>
                        <p className="font-bold">No active tickets for this station.</p>
                    </div>
                ) : (
                    tickets.map(ticket => (
                        <div 
                            key={ticket.order_id} 
                            className={`w-80 shrink-0 h-full flex flex-col bg-[#1e293b] rounded-2xl border-2 transition-all duration-500 ${getUrgencyColor(ticket.created_at)}`}
                        >
                            {/* Ticket Header */}
                            <div className="p-4 border-b border-white/10 bg-[#0f172a] rounded-t-xl shrink-0">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="text-xl font-black text-white">{ticket.order_name}</h3>
                                    <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${
                                        ticket.order_type === 'dine_in' ? 'bg-blue-500/20 text-blue-400' : 
                                        ticket.order_type === 'takeaway' ? 'bg-yellow-500/20 text-yellow-400' : 
                                        'bg-purple-500/20 text-purple-400'
                                    }`}>
                                        {ticket.order_type.replace('_', ' ').toUpperCase()}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center text-sm font-bold mt-2">
                                    <span className="text-white/80">{ticket.table}</span>
                                    <span className="text-red-400 flex items-center font-mono bg-red-500/10 px-2 py-0.5 rounded">
                                        <FiClock className="mr-1" /> {formatTime(ticket.created_at)}
                                    </span>
                                </div>
                            </div>
                            
                            {/* Ticket Items List */}
                            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                                {ticket.items.map((item, idx) => (
                                    <div 
                                        key={item.id} 
                                        onClick={() => handleBumpStatus(item.id, item.status)}
                                        className={`group relative overflow-hidden p-3 rounded-xl border border-white/10 cursor-pointer transition-all ${
                                            item.status === 'ready' ? 'opacity-50 grayscale hover:grayscale-0' : 'hover:border-primary/50 hover:bg-white/5'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-start space-x-3 flex-1">
                                                <div className="text-lg font-black text-white bg-white/10 w-8 h-8 flex items-center justify-center rounded-lg mt-0.5">
                                                    {item.quantity}
                                                </div>
                                                <div className="flex-1 pr-2">
                                                    <h4 className={`text-base font-bold text-white leading-tight ${item.status === 'ready' ? 'line-through' : ''}`}>
                                                        {item.product_name}
                                                    </h4>
                                                    
                                                    {/* Modifiers parsing if injected */}
                                                    {item.modifiers && item.modifiers.length > 0 && (
                                                        <ul className="mt-1 space-y-0.5">
                                                            {item.modifiers.map((mod, i) => (
                                                                <li key={i} className="text-xs text-yellow-500/80 font-bold block">+ {mod.name || mod}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    
                                                    {item.notes && (
                                                        <p className="text-xs text-red-300 font-bold italic mt-1.5 p-1.5 bg-red-900/30 rounded border border-red-900/50">
                                                            "{item.notes}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {/* Status Tag Overlay Hook */}
                                        <div className="absolute bottom-2 right-2">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${getStatusColor(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                        
                                        {/* Bump Action Hover Overlay */}
                                        {item.status !== 'ready' && (
                                            <div className="absolute inset-y-0 right-0 w-12 bg-primary flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 group-hover:translate-x-0">
                                                <FiCheck className="w-5 h-5 mb-1" />
                                                <span className="text-[10px] font-black uppercase">BUMP</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                            
                            {/* Ticket Footer Action */}
                            <div className="p-3 border-t border-white/10 bg-[#0f172a] rounded-b-xl shrink-0">
                                <button 
                                    className="w-full py-2.5 rounded-lg border border-white/10 text-white/70 font-bold text-sm hover:bg-white/5 transition-colors"
                                    onClick={() => {
                                        // Complete all items in ticket
                                        ticket.items.forEach(item => {
                                            if (item.status !== 'ready') handleBumpStatus(item.id, item.status);
                                        });
                                    }}
                                >
                                    Bump Entire Ticket
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
        </div>
    );
};

export default KDS;
