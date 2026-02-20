import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiRepeat } from 'react-icons/fi';
import { inventoryApi } from '../../api/inventoryApi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';

const conversionSchema = yup.object().shape({
    from_unit: yup.number().required('From Unit is required'),
    to_unit: yup.number().required('To Unit is required'),
    multiplier: yup.number().positive('Must be positive').required('Multiplier is required'),
});

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

const UnitConversions = () => {
    const [conversions, setConversions] = useState([]);
    const [units, setUnits] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingConversion, setEditingConversion] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [conversionToDelete, setConversionToDelete] = useState(null);

    const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm({
        resolver: yupResolver(conversionSchema)
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [convRes, unitRes] = await Promise.all([
                inventoryApi.getConversions(),
                inventoryApi.getUnits()
            ]);
            setConversions(convRes.data);
            setUnits(unitRes.data);
        } catch (error) {
            toast.error("Failed to fetch unit conversions");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openAddModal = () => {
        setEditingConversion(null);
        reset({ from_unit: '', to_unit: '', multiplier: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (conversion) => {
        setEditingConversion(conversion);
        // Note: The conversion object likely has from_unit and to_unit as scalar IDs, but verify this based on your API response
        setValue('from_unit', conversion.from_unit);
        setValue('to_unit', conversion.to_unit);
        setValue('multiplier', conversion.multiplier);
        setIsModalOpen(true);
    };

    const onSubmit = async (data) => {
        try {
            if (editingConversion) {
                await inventoryApi.updateConversion(editingConversion.id, data);
                toast.success("Conversion updated successfully");
            } else {
                await inventoryApi.createConversion(data);
                toast.success("Conversion rule created");
            }
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
             toast.error(error.response?.data?.non_field_errors?.[0] || "Failed to save conversion");
        }
    };

    const confirmDelete = async () => {
        try {
            await inventoryApi.deleteConversion(conversionToDelete.id);
            toast.success("Conversion deleted");
            setDeleteConfirmOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to delete conversion");
        }
    };

    const columns = useMemo(() => [
        {
            header: 'From Unit (Base)',
            accessorKey: 'from_unit_name',
            cell: info => <span className="font-semibold text-white">{info.getValue()} ({info.row.original.from_unit_abbreviation})</span>
        },
        {
            header: 'Multiplier',
            accessorKey: 'multiplier',
            cell: info => <span className="font-mono text-accent">x {info.getValue()}</span>
        },
        {
            header: 'To Unit (Target)',
            accessorKey: 'to_unit_name',
            cell: info => <span className="font-semibold text-white">{info.getValue()} ({info.row.original.to_unit_abbreviation})</span>
        },
        {
            header: 'Formula Example',
            id: 'formula',
            cell: info => (
                <div className="text-sm text-textMuted bg-white/5 px-3 py-1.5 rounded inline-flex items-center space-x-2">
                    <span>1 {info.row.original.from_unit_abbreviation}</span>
                    <FiRepeat className="w-3 h-3" />
                    <span>{parseFloat(info.row.original.multiplier)} {info.row.original.to_unit_abbreviation}</span>
                </div>
            )
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <div className="flex space-x-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(info.row.original); }}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                    >
                        <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setConversionToDelete(info.row.original);
                            setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [units]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-2xl font-bold text-white">Unit Conversions</h1>
                     <p className="text-sm text-textMuted mt-1">Define rules for converting bulk units (e.g., KGs) into prep units (e.g., Grams).</p>
                </div>
                <button 
                    onClick={openAddModal}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Add Rule</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={conversions} 
                isLoading={isLoading}
                searchPlaceholder="Search conversions..."
            />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingConversion ? 'Edit Conversion' : 'New Conversion Rule'}
                        </h2>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-2">From Unit (Base)</label>
                                    <Controller
                                        name="from_unit"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                {...field}
                                                options={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
                                                styles={selectStyles}
                                                placeholder="e.g. Kilogram"
                                                value={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })).find(u => u.value === field.value)}
                                                onChange={val => field.onChange(val.value)}
                                            />
                                        )}
                                    />
                                    {errors.from_unit && <span className="text-red-400 text-xs mt-1 block">{errors.from_unit.message}</span>}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-2">To Unit (Target)</label>
                                    <Controller
                                        name="to_unit"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                {...field}
                                                options={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
                                                styles={selectStyles}
                                                placeholder="e.g. Grams"
                                                value={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })).find(u => u.value === field.value)}
                                                onChange={val => field.onChange(val.value)}
                                            />
                                        )}
                                    />
                                    {errors.to_unit && <span className="text-red-400 text-xs mt-1 block">{errors.to_unit.message}</span>}
                                </div>
                            </div>

                            <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                                <label className="block text-sm font-medium text-primary mb-2">Multiplier</label>
                                <div className="flex items-center space-x-3">
                                    <span className="text-white whitespace-nowrap">1 Base =</span>
                                    <div className="flex-1">
                                        <input 
                                            type="number" 
                                            step="0.00001" 
                                            {...register('multiplier')} 
                                            className="form-input w-full font-mono text-accent text-lg" 
                                            placeholder="e.g. 1000"
                                        />
                                    </div>
                                    <span className="text-white whitespace-nowrap">Targets</span>
                                </div>
                                {errors.multiplier && <span className="text-red-400 text-xs mt-1 block">{errors.multiplier.message}</span>}
                                <p className="text-xs text-textMuted mt-2">Example: If converting Kilograms to Grams, multiplier is 1000. If converting Boxes (of 12) to Pieces, multiplier is 12.</p>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors font-medium shadow-lg">
                                    Save Rule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                title="Delete Conversion Rule"
                message={`Are you sure you want to delete this conversion rule? Recipes relying on this specific conversion may fail to calculate costs correctly.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
                confirmText="Delete Rule"
                isDestructive={true}
            />
        </div>
    );
};

export default UnitConversions;
