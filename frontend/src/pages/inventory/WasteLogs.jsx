import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import { inventoryApi } from '../../api/inventoryApi';
import useSettingsStore from '../../store/settingsStore';

const wasteSchema = yup.object().shape({
  raw_material: yup.string().required('Material is required'),
  quantity: yup.number().min(0.01, 'Quantity must be > 0').required('Required'),
  reason: yup.string().required('Reason is required'),
  notes: yup.string()
});

const WasteLogs = () => {
    const [logs, setLogs] = useState([]);
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    const { settings } = useSettingsStore();

    const selectStyles = {
        control: (base, state) => ({
            ...base,
            background: 'rgba(255, 255, 255, 0.05)',
            borderColor: state.isFocused ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
            color: '#fff',
            minHeight: '40px',
            boxShadow: 'none',
            borderRadius: '0.5rem',
            '&:hover': { borderColor: 'rgba(255, 255, 255, 0.2)' }
        }),
        menu: (base) => ({
            ...base,
            background: '#1e293b',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            zIndex: 100
        }),
        option: (base, state) => ({
            ...base,
            background: state.isSelected ? 'rgba(59, 130, 246, 0.3)' : state.isFocused ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
            color: state.isSelected ? '#fff' : '#cbd5e1',
            cursor: 'pointer',
            '&:active': { background: 'rgba(59, 130, 246, 0.4)' }
        }),
        singleValue: (base) => ({ ...base, color: '#fff' }),
        input: (base) => ({ ...base, color: '#fff' })
    };

    const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: yupResolver(wasteSchema)
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [logsRes, matRes] = await Promise.all([
                inventoryApi.getWasteLogs(),
                inventoryApi.getMaterials()
            ]);
            setLogs(logsRes.data);
            setMaterials(matRes.data);
        } catch (error) {
            toast.error('Failed to load waste logs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const onSubmit = async (data) => {
        try {
            await inventoryApi.createWasteLog(data);
            toast.success('Waste log recorded successfully. Stock adjusted.');
            setIsCreateModalOpen(false);
            fetchData();
        } catch (error) {
             toast.error(error.response?.data?.error || 'Failed to record waste');
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Date',
            accessorFn: row => new Date(row.date_logged).toLocaleString(),
        },
        {
            header: 'Material',
            accessorKey: 'raw_material_name',
            cell: info => <span className="font-semibold">{info.getValue()}</span>
        },
        {
            header: 'Quantity Discarded',
            accessorFn: row => `${parseFloat(row.quantity)} ${row.unit_abbreviation || ''}`,
            cell: info => <span className="text-red-400 font-bold">{info.getValue()}</span>
        },
        {
            header: 'Calculated Cost',
            accessorFn: row => `${settings?.currency || '$'}${parseFloat(row.financial_impact).toFixed(2)}`,
            cell: info => <span className="font-mono text-textMuted">{info.getValue()}</span>
        },
        {
            header: 'Reason',
            accessorKey: 'reason',
            cell: info => <span className="uppercase text-xs tracking-wider">{info.getValue().replace('_', ' ')}</span>
        },
        {
            header: 'Logged By',
            accessorKey: 'logged_by_name',
        }
    ], [settings]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-white">Waste & Spoilage Logs</h1>
                <button 
                    onClick={() => {
                        reset({ raw_material: '', quantity: '', reason: 'expired', notes: '' });
                        setIsCreateModalOpen(true);
                    }}
                    className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30 px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                >
                    <FiTrash2 className="w-5 h-5" />
                    <span>Log Waste</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={logs} 
                isLoading={isLoading}
                searchPlaceholder="Search logs..."
            />

            {/* Create Waste Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsCreateModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-red-400 mb-2">Record Waste / Spoilage</h2>
                        <p className="text-textMuted text-sm mb-6">Logging this will permanently deduct stock from the inventory.</p>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Material *</label>
                                <Controller
                                    name="raw_material"
                                    control={control}
                                    render={({ field }) => (
                                        <Select
                                            {...field}
                                            options={materials.filter(m => m.is_active).map(m => ({ value: m.id, label: `${m.name} (Max: ${m.current_stock})` }))}
                                            styles={selectStyles}
                                            placeholder="Search Material..."
                                            value={materials.map(m => ({ value: m.id, label: `${m.name} (Max: ${m.current_stock})` })).find(m => m.value === field.value)}
                                            onChange={val => field.onChange(val.value)}
                                        />
                                    )}
                                />
                                {errors.raw_material && <span className="text-red-400 text-xs">{errors.raw_material.message}</span>}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Quantity Lost</label>
                                    <input type="number" step="0.001" {...register('quantity')} className="form-input" />
                                    {errors.quantity && <span className="text-red-400 text-xs">{errors.quantity.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Reason</label>
                                    <select {...register('reason')} className="form-input">
                                        <option value="expired">Expired</option>
                                        <option value="damaged">Damaged / Dropped</option>
                                        <option value="quality_issue">Quality Issue</option>
                                        <option value="theft">Theft / Unaccounted</option>
                                        <option value="other">Other</option>
                                    </select>
                                    {errors.reason && <span className="text-red-400 text-xs">{errors.reason.message}</span>}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Additional Notes</label>
                                <textarea {...register('notes')} className="form-input" rows="2" placeholder="e.g. Found damaged in the walk-in fridge"></textarea>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10 mt-6">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-red-500/20 text-red-500 hover:bg-red-500/30 border border-red-500/30 px-4 py-2 rounded-lg transition-colors font-medium">
                                    Deduct Stock
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WasteLogs;
