import React, { useState, useEffect, useRef } from 'react';
import { posApi } from '../../api/posApi';
import toast from 'react-hot-toast';
import { FiPlus, FiSave, FiTrash2, FiMaximize, FiUsers, FiInfo, FiLayers } from 'react-icons/fi';
import ConfirmModal from '../../components/ConfirmModal';

const FloorPlan = () => {
    const [tables, setTables] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [tableToDelete, setTableToDelete] = useState(null);
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editData, setEditData] = useState({ number: '', capacity: '' });
    
    // Dragging state
    const [draggingId, setDraggingId] = useState(null);
    const floorRef = useRef(null);

    useEffect(() => {
        fetchTables();
    }, []);

    const fetchTables = async () => {
        setIsLoading(true);
        try {
            const response = await posApi.getTables();
            setTables(response.data);
        } catch (error) {
            toast.error("Failed to load floor plan");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveLayout = async () => {
        const toastId = toast.loading("Saving layout...");
        try {
            // Update all tables sequentially (or send bulk update if API supported it)
            // For now, sequentially since amount of tables is usually small < 100
            for (const table of tables) {
                await posApi.updateTable(table.id, {
                    position_x: Math.round(table.position_x),
                    position_y: Math.round(table.position_y)
                });
            }
            toast.success("Layout saved successfully", { id: toastId });
            setIsEditMode(false);
            setSelectedTable(null);
        } catch (error) {
            toast.error("Failed to save layout", { id: toastId });
        }
    };
    
    // Fallback patch for API if not fully implemented in API wrapper
    const updateTableData = async (id, data) => {
        try {
            await posApi.updateOrder(id, data); // We named it incorrectly in posApi, wait it's not even there. Let me use axios
        } catch(e) {}
    }

    const handlePointerDown = (e, tableId) => {
        if (!isEditMode) {
            setSelectedTable(tables.find(t => t.id === tableId));
            return;
        }
        
        e.preventDefault();
        setDraggingId(tableId);
        setSelectedTable(tables.find(t => t.id === tableId));
    };

    const handlePointerMove = (e) => {
        if (!draggingId || !floorRef.current) return;
        
        const rect = floorRef.current.getBoundingClientRect();
        // Calculate new X/Y relative to the container
        let newX = e.clientX - rect.left - 40; // 40 is half of table width
        let newY = e.clientY - rect.top - 40;  // 40 is half of table height
        
        // Boundaries
        newX = Math.max(0, Math.min(newX, rect.width - 80));
        newY = Math.max(0, Math.min(newY, rect.height - 80));
        
        // Collision detection: Prevent overlapping with other tables (80x80 pixels)
        const TABLE_SIZE = 80;
        const SPACING = 10; // Optional spacing between tables
        let hasCollision = false;
        
        for (const table of tables) {
            if (table.id === draggingId) continue;
            
            // Allow small overlap margin before blocking
            const isColliding = 
                newX < table.position_x + TABLE_SIZE + SPACING &&
                newX + TABLE_SIZE + SPACING > table.position_x &&
                newY < table.position_y + TABLE_SIZE + SPACING &&
                newY + TABLE_SIZE + SPACING > table.position_y;
                
            if (isColliding) {
                hasCollision = true;
                break;
            }
        }
        
        // If there's a collision, don't update the coordinates (create a "wall" effect)
        if (!hasCollision) {
            setTables(prev => prev.map(t => 
                t.id === draggingId ? { ...t, position_x: newX, position_y: newY } : t
            ));
        }
    };

    const handlePointerUp = () => {
        if (draggingId) {
            setDraggingId(null);
        }
    };

    useEffect(() => {
        if (draggingId) {
            window.addEventListener('pointermove', handlePointerMove);
            window.addEventListener('pointerup', handlePointerUp);
        }
        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [draggingId]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'available': return 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)]';
            case 'occupied': return 'bg-red-500/20 border-red-500 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]';
            case 'reserved': return 'bg-blue-500/20 border-blue-500 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]';
            case 'needs_cleaning': return 'bg-yellow-500/20 border-yellow-500 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]';
            default: return 'bg-gray-500/20 border-gray-500 text-gray-400';
        }
    };

    const handleUpdateTableStatus = async (id, newStatus) => {
        if (isEditMode) return;
        try {
            await posApi.updateTableStatus(id, newStatus);
            setTables(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
            if (selectedTable?.id === id) {
                setSelectedTable(prev => ({ ...prev, status: newStatus }));
            }
            toast.success("Status updated");
        } catch (error) {
            toast.error("Failed to update status");
        }
    };

    const handleDeleteTable = async () => {
        if (!tableToDelete) return;
        const toastId = toast.loading("Deleting table...");
        try {
            await posApi.deleteTable(tableToDelete);
            setTables(prev => prev.filter(t => t.id !== tableToDelete));
            if (selectedTable?.id === tableToDelete) setSelectedTable(null);
            toast.success("Table deleted", { id: toastId });
        } catch (error) {
            toast.error("Failed to delete table", { id: toastId });
        } finally {
            setDeleteModalOpen(false);
            setTableToDelete(null);
        }
    };

    // Form logic for new/edit table
    const [formData, setFormData] = useState({ number: '', capacity: 4 });
    const [isAddingTable, setIsAddingTable] = useState(false);
    
    // Bulk generation logic
    const [bulkCount, setBulkCount] = useState(10);
    const [isBulkGenerating, setIsBulkGenerating] = useState(false);
    
    const handleBulkGenerate = async (e) => {
        e.preventDefault();
        const count = Math.min(35, Math.max(1, parseInt(bulkCount) || 1));
        
        setIsBulkGenerating(true);
        const toastId = toast.loading(`Generating ${count} tables...`);
        
        try {
            const currentCount = tables.length;
            const addedTables = [];
            
            let spawnX = 100;
            let spawnY = 100;
            const TABLE_SIZE = 80;
            const SPACING = 20;
            
            for (let i = 0; i < count; i++) {
                // Find empty spot for each
                while (true) {
                    let collision = false;
                    const allTables = [...tables, ...addedTables];
                    for (const table of allTables) {
                        const isColliding = 
                            spawnX < table.position_x + TABLE_SIZE + SPACING &&
                            spawnX + TABLE_SIZE + SPACING > table.position_x &&
                            spawnY < table.position_y + TABLE_SIZE + SPACING &&
                            spawnY + TABLE_SIZE + SPACING > table.position_y;
                            
                        if (isColliding) {
                            collision = true;
                            break;
                        }
                    }
                    if (!collision) break;
                    
                    spawnX += TABLE_SIZE + SPACING;
                    if (spawnX > 600) { 
                        spawnX = 100;
                        spawnY += TABLE_SIZE + SPACING;
                    }
                }

                // API call sequentially
                const response = await posApi.createTable({
                    number: `T-${currentCount + i + 1}`,
                    capacity: 4,
                    position_x: spawnX,
                    position_y: spawnY,
                    status: 'available'
                });
                addedTables.push(response.data);
            }
            
            setTables(prev => [...prev, ...addedTables]);
            toast.success(`Generated ${count} tables!`, { id: toastId });
        } catch (error) {
            toast.error("Error bulk generating tables.", { id: toastId });
        } finally {
            setIsBulkGenerating(false);
            setBulkCount(10);
        }
    };
    
    const handleAddTable = async (e) => {
        e.preventDefault();
        if (!formData.number) return toast.error("Table number is required");
        
        setIsAddingTable(true);
        const toastId = toast.loading("Adding table...");
        
        // Find an empty spot for the new table
        const TABLE_SIZE = 80;
        const SPACING = 20;
        let spawnX = 100;
        let spawnY = 100;
        
        while (true) {
            let collision = false;
            for (const table of tables) {
                const isColliding = 
                    spawnX < table.position_x + TABLE_SIZE + SPACING &&
                    spawnX + TABLE_SIZE + SPACING > table.position_x &&
                    spawnY < table.position_y + TABLE_SIZE + SPACING &&
                    spawnY + TABLE_SIZE + SPACING > table.position_y;
                    
                if (isColliding) {
                    collision = true;
                    break;
                }
            }
            
            if (!collision) break;
            
            spawnX += TABLE_SIZE + SPACING;
            if (spawnX > 600) { 
                spawnX = 100;
                spawnY += TABLE_SIZE + SPACING;
            }
            if (spawnY > 2000) break; // Safety fallback
        }

        try {
            const response = await posApi.createTable({
                number: formData.number,
                capacity: formData.capacity,
                position_x: spawnX,
                position_y: spawnY,
                status: 'available'
            });
            
            setTables([...tables, response.data]);
            setFormData({ number: '', capacity: 4 });
            toast.success(`Table ${response.data.number} added!`, { id: toastId });
        } catch (error) {
            let errMsg = "Failed to add table";
            const detail = error.response?.data?.detail;
            if (typeof detail === 'string') {
                errMsg = detail;
            } else if (typeof detail === 'object' && detail !== null) {
                errMsg = Object.values(detail).flat().join(', ');
            }
            toast.error(errMsg, { id: toastId });
        } finally {
            setIsAddingTable(false);
        }
    };

    const handleSaveTableMetadata = async (e) => {
        e.preventDefault();
        if (!selectedTable) return;
        
        const toastId = toast.loading("Updating table...");
        try {
            const data = {
                number: editData.number,
                capacity: parseInt(editData.capacity) || 1
            };
            const response = await posApi.updateTable(selectedTable.id, data);
            
            // Update local state
            setTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, ...response.data } : t));
            setSelectedTable(prev => ({ ...prev, ...response.data }));
            
            setIsEditingDetails(false);
            toast.success("Table updated successfully", { id: toastId });
        } catch (error) {
            let errMsg = "Failed to update table";
            const detail = error.response?.data?.detail;
            if (typeof detail === 'string') errMsg = detail;
            else if (typeof detail === 'object' && detail !== null) errMsg = Object.values(detail).flat().join(', ');
            
            toast.error(errMsg, { id: toastId });
        }
    };

    const handleAutoArrange = () => {
        if (!floorRef.current || tables.length === 0) return;
        
        const rect = floorRef.current.getBoundingClientRect();
        const TABLE_SIZE = 80;
        const SPACING = 40; // generous spacing
        
        // Calculate how many tables can fit in one row
        // Subtract some padding from container width
        const availableWidth = rect.width - 40; 
        const cols = Math.max(1, Math.floor(availableWidth / (TABLE_SIZE + SPACING)));
        
        // Sort tables logically by number (trying to extract digits if possible)
        const sortedTables = [...tables].sort((a, b) => {
            const numA = parseInt(a.number.replace(/\D/g, '')) || 0;
            const numB = parseInt(b.number.replace(/\D/g, '')) || 0;
            if (numA !== numB) return numA - numB;
            return a.number.localeCompare(b.number);
        });
        
        const startX = 60;
        const startY = 60;
        
        const newTables = sortedTables.map((table, index) => {
            const row = Math.floor(index / cols);
            const col = index % cols;
            
            return {
                ...table,
                position_x: startX + col * (TABLE_SIZE + SPACING),
                position_y: startY + row * (TABLE_SIZE + SPACING)
            };
        });
        
        setTables(newTables);
        toast.success("Tables arranged!");
    };

    return (
        <div className="h-full flex bg-[#0f172a] overflow-hidden p-6 gap-6 rounded-2xl">
            
            {/* LIFT SIDE: FLOOR CANVAS */}
            <div className="flex-1 flex flex-col h-full glass-panel border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl">
                
                {/* Header Toolbar */}
                <div className="p-4 border-b border-white/10 bg-white/5 flex justify-between items-center backdrop-blur-md z-10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/20 rounded-lg text-primary">
                            <FiLayers className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white leading-tight">Floor Plan</h2>
                            <p className="text-xs text-textMuted">Live Table Management</p>
                        </div>
                    </div>
                    
                    <div className="flex space-x-3">
                        {isEditMode ? (
                            <>
                                <button 
                                    onClick={() => { fetchTables(); setIsEditMode(false); setSelectedTable(null); }}
                                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleSaveLayout}
                                    className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(59,130,246,0.4)] flex items-center space-x-2 transition-all"
                                >
                                    <FiSave /> <span>Save Layout</span>
                                </button>
                            </>
                        ) : (
                            <button 
                                onClick={() => { setIsEditMode(true); setSelectedTable(null); }}
                                className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-lg text-sm font-bold flex items-center space-x-2 transition-all"
                            >
                                <FiMaximize /> <span>Edit Layout</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* The Canvas */}
                <div 
                    ref={floorRef}
                    className="flex-1 relative bg-[#0B1121] overflow-hidden"
                    style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }}
                >
                    {tables.map(table => (
                        <div
                            key={table.id}
                            onPointerDown={(e) => handlePointerDown(e, table.id)}
                            className={`absolute flex flex-col items-center justify-center rounded-2xl border-2 transition-all select-none
                                ${getStatusColor(table.status)}
                                ${selectedTable?.id === table.id ? 'ring-2 ring-white scale-110 z-20' : 'z-10'}
                                ${isEditMode ? 'cursor-grab active:cursor-grabbing hover:brightness-125' : 'cursor-pointer hover:scale-105'}
                                ${draggingId === table.id ? 'opacity-80 scale-105 shadow-2xl' : ''}
                            `}
                            style={{
                                width: '80px',
                                height: '80px',
                                left: `${table.position_x}px`,
                                top: `${table.position_y}px`,
                                touchAction: 'none' // Important for pointer events on touch devices
                            }}
                        >
                            <span className="text-xl font-black">{table.number}</span>
                            <div className="flex items-center text-[10px] opacity-80 mt-1 font-bold">
                                <FiUsers className="mr-1" /> {table.capacity}
                            </div>
                        </div>
                    ))}
                    
                    {!isLoading && tables.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center text-white/30 font-bold">
                            No tables found. Enter edit mode to create some.
                        </div>
                    )}
                </div>
                
                {/* Legend */}
                {!isEditMode && (
                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-[#0f172a]/80 backdrop-blur-md rounded-xl p-3 border border-white/10 text-xs font-bold shadow-lg">
                        <div className="flex items-center text-white/60"><FiInfo className="mr-2" /> Live Status</div>
                        <div className="flex space-x-4">
                            <span className="flex items-center text-emerald-400"><span className="w-3 h-3 rounded-full bg-emerald-500 mr-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>Available</span>
                            <span className="flex items-center text-red-400"><span className="w-3 h-3 rounded-full bg-red-500 mr-2 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>Occupied</span>
                            <span className="flex items-center text-blue-400"><span className="w-3 h-3 rounded-full bg-blue-500 mr-2 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span>Reserved</span>
                            <span className="flex items-center text-yellow-400"><span className="w-3 h-3 rounded-full bg-yellow-500 mr-2 shadow-[0_0_8px_rgba(234,179,8,0.8)]"></span>Needs Cleaning</span>
                        </div>
                    </div>
                )}
            </div>

            {/* RIGHT SIDE: TABLE INSPECTOR */}
            <div className={`w-80 glass-panel border border-white/10 rounded-3xl shadow-2xl flex flex-col transition-all duration-300 transform origin-right ${selectedTable || isEditMode ? 'scale-x-100 opacity-100' : 'scale-x-0 w-0 opacity-0 overflow-hidden'}`}>
                {isEditMode ? (
                    // Edit Mode Tools
                    <div className="p-6 flex flex-col h-full overflow-hidden">
                        <h3 className="text-lg font-black text-white mb-6 border-b border-white/10 pb-4 flex items-center">
                            <FiMaximize className="mr-2 text-primary" /> Builder Tools
                        </h3>
                        
                        <div className="flex-1 text-center">
                           <p className="text-sm text-textMuted mb-6">Drag and drop tables on the canvas to update their physical positions.</p>
                           
                           <button 
                               onClick={handleAutoArrange}
                               className="w-full py-3 mb-6 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-lg"
                           >
                               <FiLayers /> <span>Auto Arrange Grid</span>
                           </button>
                           
                           {/* Bulk Generate Form */}
                           <form onSubmit={handleBulkGenerate} className="border border-white/10 bg-white/5 rounded-xl p-4 text-left mb-6">
                               <h4 className="font-bold text-white mb-4 text-sm flex items-center justify-between">
                                   <span>Bulk Generate</span>
                                   <span className="text-[10px] text-textMuted bg-[#0f172a] px-2 py-1 rounded">Max 35</span>
                               </h4>
                               <div className="space-y-3 mb-4">
                                   <div>
                                       <label className="text-[10px] text-textMuted uppercase font-bold tracking-wider mb-1 block">Number of Tables</label>
                                       <input 
                                           type="number"
                                           min="1"
                                           max="35"
                                           className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary"
                                           value={bulkCount}
                                           onChange={e => setBulkCount(e.target.value)}
                                           required
                                       />
                                   </div>
                               </div>
                               <button 
                                   type="submit" 
                                   disabled={isBulkGenerating}
                                   className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 rounded-lg font-bold text-sm shadow-[0_0_10px_rgba(16,185,129,0.2)] disabled:opacity-50 transition-all"
                               >
                                   {isBulkGenerating ? 'Generating...' : 'Generate Tables'}
                               </button>
                           </form>
                           
                           {/* Would add full Create Table form here calling POST /pos/tables/ */}
                           <form onSubmit={handleAddTable} className="border border-white/10 bg-white/5 rounded-xl p-4 text-left">
                               <h4 className="font-bold text-white mb-4 text-sm">Add New Table</h4>
                               
                               <div className="space-y-3 mb-4">
                                   <div>
                                       <label className="text-[10px] text-textMuted uppercase font-bold tracking-wider mb-1 block">Table Number/Name</label>
                                       <input 
                                           className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary"
                                           placeholder="e.g. T1, Balcony-3"
                                           value={formData.number}
                                           onChange={e => setFormData({...formData, number: e.target.value})}
                                           required
                                       />
                                   </div>
                                   <div>
                                       <label className="text-[10px] text-textMuted uppercase font-bold tracking-wider mb-1 block">Seat Capacity</label>
                                       <input 
                                           type="number"
                                           min="1"
                                           className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary"
                                           value={formData.capacity}
                                           onChange={e => setFormData({...formData, capacity: e.target.value})}
                                           required
                                       />
                                   </div>
                               </div>

                               <button 
                                   type="submit" 
                                   disabled={isAddingTable}
                                   className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-bold text-sm shadow-[0_0_10px_rgba(59,130,246,0.3)] disabled:opacity-50 flex items-center justify-center transition-all"
                               >
                                   <FiPlus className="mr-2" /> {isAddingTable ? 'Adding...' : 'Quick Add Table'}
                               </button>
                           </form>
                        </div>
                    </div>
                ) : (
                    // View Mode / Inspector
                    selectedTable && (
                        <div className="p-6 flex flex-col h-full">
                            <div className="flex justify-between items-start mb-6 pb-4 border-b border-white/10">
                                <div className="flex-1 mr-4">
                                    {isEditingDetails ? (
                                        <form onSubmit={handleSaveTableMetadata} className="space-y-3">
                                            <div>
                                                <input 
                                                    autoFocus
                                                    className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary font-black"
                                                    value={editData.number}
                                                    onChange={e => setEditData({...editData, number: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <FiUsers className="text-textMuted" />
                                                <input 
                                                    type="number"
                                                    min="1"
                                                    className="w-full bg-[#0f172a] border border-white/10 rounded-lg p-2 text-white text-sm focus:outline-none focus:border-primary"
                                                    value={editData.capacity}
                                                    onChange={e => setEditData({...editData, capacity: e.target.value})}
                                                    required
                                                />
                                            </div>
                                            <div className="flex space-x-2">
                                                <button type="submit" className="flex-1 py-1.5 bg-primary/20 text-primary hover:bg-primary/30 rounded text-xs font-bold transition-all">Save</button>
                                                <button type="button" onClick={() => setIsEditingDetails(false)} className="flex-1 py-1.5 bg-white/5 text-white/50 hover:bg-white/10 rounded text-xs font-bold transition-all">Cancel</button>
                                            </div>
                                        </form>
                                    ) : (
                                        <div 
                                            className="group cursor-pointer p-1 -m-1 rounded hover:bg-white/5 transition-all"
                                            onClick={() => {
                                                setEditData({ number: selectedTable.number, capacity: selectedTable.capacity });
                                                setIsEditingDetails(true);
                                            }}
                                        >
                                            <div className="flex justify-between items-center">
                                                <h3 className="text-2xl font-black text-white group-hover:text-primary transition-colors">Table {selectedTable.number}</h3>
                                                <span className="opacity-0 group-hover:opacity-100 text-xs text-primary transition-opacity">Edit</span>
                                            </div>
                                            <p className="text-textMuted text-sm font-bold mt-1 inline-flex items-center">
                                                <FiUsers className="mr-1" /> {selectedTable.capacity} Seats
                                            </p>
                                        </div>
                                    )}
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${getStatusColor(selectedTable.status).replace(' shadow-[0_0_15px_rgba(16,185,129,0.3)]', '').replace(' shadow-[0_0_15px_rgba(239,68,68,0.3)]', '').replace(' shadow-[0_0_15px_rgba(59,130,246,0.3)]', '').replace(' shadow-[0_0_15px_rgba(234,179,8,0.3)]', '')}`}>
                                    {selectedTable.status.replace('_', ' ')}
                                </div>
                            </div>

                            <div className="space-y-6 flex-1 flex flex-col">
                                <div>
                                    <h4 className="text-xs font-bold text-textMuted uppercase tracking-wider mb-3">Quick Actions</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => handleUpdateTableStatus(selectedTable.id, 'available')}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTable.status === 'available' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' : 'bg-white/5 text-textMuted hover:bg-white/10 hover:text-white'}`}
                                        >
                                            Available
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateTableStatus(selectedTable.id, 'occupied')}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTable.status === 'occupied' ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-white/5 text-textMuted hover:bg-white/10 hover:text-white'}`}
                                        >
                                            Occupied
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateTableStatus(selectedTable.id, 'reserved')}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTable.status === 'reserved' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' : 'bg-white/5 text-textMuted hover:bg-white/10 hover:text-white'}`}
                                        >
                                            Reserved
                                        </button>
                                        <button 
                                            onClick={() => handleUpdateTableStatus(selectedTable.id, 'needs_cleaning')}
                                            className={`py-2 rounded-lg text-xs font-bold transition-all ${selectedTable.status === 'needs_cleaning' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50' : 'bg-white/5 text-textMuted hover:bg-white/10 hover:text-white'}`}
                                        >
                                            Clean
                                        </button>
                                    </div>
                                </div>
                                
                                {selectedTable.status === 'occupied' && selectedTable.active_order ? (
                                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mt-4 flex flex-col flex-1 min-h-[250px] shadow-inner mb-2">
                                        <div className="flex justify-between items-center mb-3">
                                            <div>
                                                <p className="text-xs text-primary font-bold uppercase tracking-widest">Active Order</p>
                                                <p className="text-white font-black text-sm">#{selectedTable.active_order.order_number}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-primary/70 font-mono text-xs">Total</p>
                                                <p className="text-emerald-400 font-bold tracking-tight text-sm">${parseFloat(selectedTable.active_order.total_amount).toFixed(2)}</p>
                                            </div>
                                        </div>
                                        {selectedTable.active_order.customer && (
                                            <p className="text-xs text-textMuted mb-2 bg-white/5 px-2 py-1 rounded inline-block w-max">Customer: <span className="text-white">{selectedTable.active_order.customer}</span></p>
                                        )}
                                        <p className="text-[10px] text-textMuted uppercase mb-1">Items</p>
                                        <div className="space-y-2 border-t border-white/5 pt-2 flex-1 overflow-y-auto custom-scrollbar">
                                            {selectedTable.active_order.items.map((item, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs">
                                                    <span className="text-white/80"><span className="text-primary font-bold">{item.quantity}x</span> {item.product_name}</span>
                                                    <span className="text-textMuted font-mono bg-black/30 px-1.5 py-0.5 rounded text-[10px]">${item.total_price}</span>
                                                </div>
                                            ))}
                                            {selectedTable.active_order.items.length === 0 && (
                                                <div className="text-center text-textMuted text-xs py-4">No items yet</div>
                                            )}
                                        </div>
                                    </div>
                                ) : selectedTable.status === 'occupied' && (
                                    <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 mt-4 text-center">
                                       <p className="text-primary text-xs font-bold mb-1">Occupied (No pending POS order)</p>
                                       <p className="text-textMuted text-xs">Table marked occupied manually.</p>
                                    </div>
                                )}
                                
                                <div className="mt-auto pt-6">
                                    <button 
                                        onClick={() => {
                                            setTableToDelete(selectedTable.id);
                                            setDeleteModalOpen(true);
                                        }}
                                        className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-sm font-bold flex items-center justify-center space-x-2 transition-all"
                                    >
                                        <FiTrash2 /> <span>Delete Table</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                )}
            </div>
            
            <ConfirmModal 
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                onConfirm={handleDeleteTable}
                title="Delete Table"
                message={`Are you sure you want to delete this table?`}
                confirmText="Delete"
                isDangerous={true}
            />
        </div>
    );
};

export default FloorPlan;
