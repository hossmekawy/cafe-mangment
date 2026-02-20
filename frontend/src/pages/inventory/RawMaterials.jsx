import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { inventoryApi } from '../../api/inventoryApi';

const materialSchema = yup.object().shape({
  name: yup.string().required('Name is required'),
  category: yup.string().required('Category is required'),
  unit: yup.string().required('Unit is required'),
  minimum_stock: yup.number().min(0, 'Must be positive').required('Minimum stock is required'),
  reorder_quantity: yup.number().min(0, 'Must be positive').required('Reorder quantity is required'),
  cost_per_unit: yup.number().min(0, 'Must be positive').required('Cost per unit is required'),
  expiry_tracked: yup.boolean()
});

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  
  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(materialSchema)
  });

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [matRes, unitRes] = await Promise.all([
        inventoryApi.getMaterials(),
        inventoryApi.getUnits()
      ]);
      setMaterials(matRes.data);
      setUnits(unitRes.data);
    } catch (error) {
      toast.error('Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingMaterial(null);
    reset({
        name: '',
        category: 'other',
        unit: units[0]?.id || '',
        minimum_stock: 0,
        reorder_quantity: 0,
        cost_per_unit: 0,
        expiry_tracked: false
    });
    setIsModalOpen(true);
  };

  const openEditModal = (material) => {
    setEditingMaterial(material);
    reset({
      name: material.name,
      category: material.category,
      unit: material.unit.id || material.unit, // Handle nested or flat serializer
      minimum_stock: parseFloat(material.minimum_stock),
      reorder_quantity: parseFloat(material.reorder_quantity),
      cost_per_unit: parseFloat(material.cost_per_unit),
      expiry_tracked: material.expiry_tracked
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      if (editingMaterial) {
        await inventoryApi.updateMaterial(editingMaterial.id, data);
        toast.success('Material updated successfully');
      } else {
        await inventoryApi.createMaterial(data);
        toast.success('Material created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save material');
    }
  };

  const confirmDelete = async () => {
    try {
      await inventoryApi.deleteMaterial(materialToDelete.id);
      toast.success('Material deleted successfully');
      setDeleteConfirmOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Cannot delete material. It might be in use.');
      setDeleteConfirmOpen(false);
    }
  };

  const columns = useMemo(() => [
    {
      header: 'Name',
      accessorKey: 'name',
    },
    {
      header: 'Category',
      accessorKey: 'category',
      cell: info => <span className="capitalize">{info.getValue().replace('_', ' ')}</span>
    },
    {
      header: 'Current Stock',
      accessorFn: row => `${parseFloat(row.current_stock)} ${row.unit?.abbreviation || ''}`,
      cell: info => {
        const row = info.row.original;
        const current = parseFloat(row.current_stock);
        const min = parseFloat(row.minimum_stock);
        const isLow = current <= min;
        return (
            <div className={`flex items-center space-x-2 ${isLow ? 'text-red-400 font-medium' : ''}`}>
                {isLow && <FiAlertTriangle className="w-4 h-4" />}
                <span>{info.getValue()}</span>
            </div>
        )
      }
    },
    {
      header: 'Unit Cost',
      accessorFn: row => `$${parseFloat(row.cost_per_unit).toFixed(2)}`,
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
                setMaterialToDelete(info.row.original);
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
        <h1 className="text-2xl font-bold text-white">Raw Materials</h1>
        <button 
          onClick={openAddModal}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
        >
          <FiPlus className="w-5 h-5" />
          <span>Add Material</span>
        </button>
      </div>

      <DataTable 
        columns={columns} 
        data={materials} 
        isLoading={isLoading}
        searchPlaceholder="Search materials..."
      />

      {/* Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative glass-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingMaterial ? 'Edit Material' : 'Add New Material'}
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-textMuted mb-1">Name</label>
                    <input {...register('name')} className="form-input" placeholder="e.g. Arabica Coffee Beans" />
                    {errors.name && <span className="text-red-400 text-xs">{errors.name.message}</span>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Category</label>
                    <select {...register('category')} className="form-input">
                        <option value="dairy">Dairy</option>
                        <option value="beverages">Beverages</option>
                        <option value="dry_goods">Dry Goods</option>
                        <option value="packaging">Packaging</option>
                        <option value="fresh_produce">Fresh Produce</option>
                        <option value="cleaning">Cleaning & Maintenance</option>
                        <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Base Unit</label>
                    <select {...register('unit')} className="form-input">
                        <option value="">Select Unit...</option>
                        {units.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                        ))}
                    </select>
                    {errors.unit && <span className="text-red-400 text-xs">{errors.unit.message}</span>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Min Stock Alert</label>
                    <input type="number" step="0.001" {...register('minimum_stock')} className="form-input" />
                    {errors.minimum_stock && <span className="text-red-400 text-xs">{errors.minimum_stock.message}</span>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Reorder Quantity</label>
                    <input type="number" step="0.001" {...register('reorder_quantity')} className="form-input" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Base Cost ($)</label>
                    <input type="number" step="0.01" {...register('cost_per_unit')} className="form-input" />
                  </div>

                  <div className="flex items-center space-x-2 mt-6">
                    <input type="checkbox" {...register('expiry_tracked')} id="expiry_tracked" className="w-4 h-4 rounded bg-white/5 border-white/10 text-primary focus:ring-primary focus:ring-offset-background" />
                    <label htmlFor="expiry_tracked" className="text-sm font-medium text-textMuted">Track Expiry Dates (FIFO)</label>
                  </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors">
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteConfirmOpen}
        title="Delete Material"
        message={`Are you sure you want to delete ${materialToDelete?.name}? This action cannot be undone and may fail if stock exists.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default RawMaterials;
