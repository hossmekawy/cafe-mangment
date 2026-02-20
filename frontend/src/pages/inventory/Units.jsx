import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { inventoryApi } from '../../api/inventoryApi';

const unitSchema = yup.object().shape({
  name: yup.string().required('Unit name is required'),
  abbreviation: yup.string().required('Abbreviation is required').max(10, 'Max 10 chars')
});

const Units = () => {
    const [units, setUnits] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUnit, setEditingUnit] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: yupResolver(unitSchema)
    });

    const fetchUnits = async () => {
        setIsLoading(true);
        try {
            const res = await inventoryApi.getUnits();
            setUnits(res.data);
        } catch (error) {
            toast.error('Failed to load units');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUnits();
    }, []);

    const openAddModal = () => {
        setEditingUnit(null);
        reset({ name: '', abbreviation: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (unit) => {
        setEditingUnit(unit);
        reset({ name: unit.name, abbreviation: unit.abbreviation });
        setIsModalOpen(true);
    };

    const onSubmit = async (data) => {
        try {
            if (editingUnit) {
                await inventoryApi.updateUnit(editingUnit.id, data);
                toast.success('Unit updated successfully');
            } else {
                await inventoryApi.createUnit(data);
                toast.success('Unit created successfully');
            }
            setIsModalOpen(false);
            fetchUnits();
        } catch (error) {
            toast.error('Failed to save unit');
        }
    };

    const confirmDelete = async () => {
        try {
            await inventoryApi.deleteUnit(unitToDelete.id);
            toast.success('Unit deleted successfully');
            setDeleteConfirmOpen(false);
            fetchUnits();
        } catch (error) {
            toast.error('Cannot delete unit. It might be used by existing materials.');
            setDeleteConfirmOpen(false);
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Unit Name',
            accessorKey: 'name',
            cell: info => <span className="font-semibold text-white">{info.getValue()}</span>
        },
        {
            header: 'Abbreviation',
            accessorKey: 'abbreviation',
            cell: info => <span className="font-mono bg-white/10 px-2 py-1 rounded text-sm">{info.getValue()}</span>
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <div className="flex space-x-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); openEditModal(info.row.original); }}
                        className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                    >
                        <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setUnitToDelete(info.row.original);
                            setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white">Measurement Units</h1>
                    <p className="text-textMuted text-sm">Manage units used for tracking inventory quantities (kg, ml, box)</p>
                </div>
                <button 
                    onClick={openAddModal}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Add Unit</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={units} 
                isLoading={isLoading}
                searchPlaceholder="Search units..."
            />

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-sm p-6">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingUnit ? 'Edit Unit' : 'Add Unit'}
                        </h2>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Unit Name *</label>
                                <input {...register('name')} className="form-input" placeholder="e.g. Kilogram" />
                                {errors.name && <span className="text-red-400 text-xs">{errors.name.message}</span>}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Abbreviation *</label>
                                <input {...register('abbreviation')} className="form-input" placeholder="e.g. kg" />
                                {errors.abbreviation && <span className="text-red-400 text-xs">{errors.abbreviation.message}</span>}
                            </div>
                            
                            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors">
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                title="Delete Unit"
                message={`Are you sure you want to delete the unit "${unitToDelete?.name}"?`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
                confirmText="Delete"
                isDestructive={true}
            />
        </div>
    );
};

export default Units;
