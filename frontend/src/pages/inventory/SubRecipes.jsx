import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { 
    FiPlus, FiEdit2, FiTrash2, FiAlertTriangle, FiLayers, FiPlayCircle
} from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { inventoryApi } from '../../api/inventoryApi';
import useSettingsStore from '../../store/settingsStore';

const subrecipeSchema = yup.object().shape({
  name: yup.string().required('Name is required'),
  category: yup.string().required('Category is required'),
  unit: yup.string().required('Unit is required'),
  minimum_stock: yup.number().min(0, 'Must be positive').required('Minimum stock is required'),
  reorder_quantity: yup.number().min(0, 'Must be positive').required('Reorder quantity is required'),
  cost_per_unit: yup.number().min(0, 'Must be positive').required('Cost per unit is required'),
  expiry_tracked: yup.boolean()
});

const SubRecipes = () => {
  const [subRecipes, setSubRecipes] = useState([]);
  const [units, setUnits] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubRecipe, setEditingSubRecipe] = useState(null);
  
  // Batch Production State
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedForBatch, setSelectedForBatch] = useState(null);
  const [batchYield, setBatchYield] = useState(1);
  const [batchNotes, setBatchNotes] = useState('');
  const [isProducing, setIsProducing] = useState(false);

  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  const { settings } = useSettingsStore();

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(subrecipeSchema)
  });

  const categoryOptions = [
    { value: 'sub_recipe', label: 'Sub-Recipe / Prepared Item' },
    { value: 'other', label: 'Other' },
  ];

  const selectStyles = {
    control: (base, state) => ({
      ...base,
      background: 'rgba(255, 255, 255, 0.05)',
      borderColor: state.isFocused ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)',
      color: '#fff',
      minHeight: '40px',
      boxShadow: 'none',
      borderRadius: '0.5rem',
      cursor: 'pointer',
      '&:hover': { borderColor: 'rgba(255, 255, 255, 0.2)' }
    }),
    menu: (base) => ({
      ...base,
      background: '#1e293b',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: '0.5rem',
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [matRes, unitRes] = await Promise.all([
        inventoryApi.getMaterials(),
        inventoryApi.getUnits()
      ]);
      // Filter only subrecipes (item_type === 'subrecipe' or category === 'sub_recipe')
      const filtered = matRes.data.filter(m => m.item_type === 'subrecipe' || m.category === 'sub_recipe');
      setSubRecipes(filtered);
      setUnits(unitRes.data);
    } catch (error) {
      toast.error('Failed to load sub-recipes');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openAddModal = () => {
    setEditingSubRecipe(null);
    reset({
        name: '',
        category: 'sub_recipe',
        unit: units[0]?.id || '',
        minimum_stock: 0,
        reorder_quantity: 0,
        cost_per_unit: 0,
        expiry_tracked: false
    });
    setIsModalOpen(true);
  };

  const openEditModal = (material) => {
    setEditingSubRecipe(material);
    reset({
      name: material.name,
      category: material.category || 'sub_recipe',
      unit: material.unit.id || material.unit, // Handle nested or flat serializer
      minimum_stock: parseFloat(material.minimum_stock),
      reorder_quantity: parseFloat(material.reorder_quantity),
      cost_per_unit: parseFloat(material.cost_per_unit),
      expiry_tracked: material.expiry_tracked
    });
    setIsModalOpen(true);
  };

  const onSubmit = async (data) => {
    const payload = { ...data, item_type: 'subrecipe' };
    try {
      if (editingSubRecipe) {
        await inventoryApi.updateMaterial(editingSubRecipe.id, payload);
        toast.success('Sub-Recipe updated successfully');
      } else {
        await inventoryApi.createMaterial(payload);
        toast.success('Sub-Recipe created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save sub-recipe');
    }
  };

  const confirmDelete = async () => {
    try {
      await inventoryApi.deleteMaterial(materialToDelete.id);
      toast.success('Sub-Recipe deleted successfully');
      setDeleteConfirmOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Cannot delete sub-recipe. It might be in use.');
      setDeleteConfirmOpen(false);
    }
  };

  const handleProduceBatch = async () => {
    if (!selectedForBatch || batchYield <= 0) return;
    
    setIsProducing(true);
    const toastId = toast.loading('Producing batch...');
    try {
        await inventoryApi.createBatchProduction({
            subrecipe: selectedForBatch.id,
            yield_quantity: batchYield,
            notes: batchNotes
        });
        toast.success(`Successfully produced ${batchYield} of ${selectedForBatch.name}`, { id: toastId });
        setBatchModalOpen(false);
        fetchData(); // Refresh stock levels
    } catch (error) {
        toast.error(error.response?.data?.error || 'Failed to produce batch.', { id: toastId });
    } finally {
        setIsProducing(false);
    }
  };

  const columns = useMemo(() => [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: info => (
          <div className="flex items-center space-x-3">
              <div className="bg-[#2dd4bf]/20 p-2 rounded-lg">
                  <FiLayers className="text-[#2dd4bf] w-4 h-4" />
              </div>
              <span className="font-semibold text-white">{info.getValue()}</span>
          </div>
      )
    },
    {
      header: 'Current Stock',
      accessorFn: row => `${parseFloat(row.current_stock)} ${row.unit?.abbreviation || row.unit_abbreviation || ''}`,
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
      header: 'Est. Unit Cost',
      accessorFn: row => `${settings?.currency || '$'}${parseFloat(row.cost_per_unit).toFixed(2)}`,
    },
    {
      header: 'Actions',
      id: 'actions',
      cell: info => (
        <div className="flex space-x-2">
          <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                setSelectedForBatch(info.row.original);
                setBatchYield(1);
                setBatchNotes('');
                setBatchModalOpen(true);
            }}
            className="px-3 py-1.5 bg-[#2dd4bf]/20 text-[#2dd4bf] text-sm font-medium rounded hover:bg-[#2dd4bf]/30 transition-colors flex items-center space-x-1"
          >
            <FiPlayCircle className="w-4 h-4" />
            <span>Produce Batch</span>
          </button>
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
  ], [units, settings]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h1 className="text-2xl font-bold text-white mb-1">Sub-Recipes (Prep Items)</h1>
            <p className="text-sm text-textMuted">Manage your batched recipes like dough, sauces, and premixes before they're sold.</p>
        </div>
        <div className="flex items-center space-x-3">
            <button 
              onClick={openAddModal}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
            >
              <FiPlus className="w-5 h-5" />
              <span>New Sub-Recipe</span>
            </button>
        </div>
      </div>

      <DataTable 
        columns={columns} 
        data={subRecipes} 
        isLoading={isLoading}
        searchPlaceholder="Search sub-recipes..."
      />

      {/* Sub-Recipe Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative glass-panel w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto border border-[#2dd4bf]/30">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center space-x-2">
              <FiLayers className="text-[#2dd4bf]" />
              <span>{editingSubRecipe ? 'Edit Sub-Recipe' : 'Create New Sub-Recipe'}</span>
            </h2>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="bg-[#1e293b] p-4 rounded-xl border border-white/5 text-sm text-textMuted mb-6">
                  <strong>Note:</strong> Creating a sub-recipe here only creates the "Inventory Item". You must still go to the Recipes tab to define its ingredients and instructions.
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-textMuted mb-1">Name</label>
                    <input {...register('name')} className="form-input" placeholder="e.g. Pizza Dough Master Batch" />
                    {errors.name && <span className="text-red-400 text-xs">{errors.name.message}</span>}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Category</label>
                    <Controller
                      name="category"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          options={categoryOptions}
                          styles={selectStyles}
                          placeholder="Search Category..."
                          value={categoryOptions.find(c => c.value === field.value)}
                          onChange={val => field.onChange(val.value)}
                        />
                      )}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Production Unit</label>
                    <Controller
                      name="unit"
                      control={control}
                      render={({ field }) => (
                        <Select
                          {...field}
                          options={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` }))}
                          styles={selectStyles}
                          placeholder="Search Unit..."
                          value={units.map(u => ({ value: u.id, label: `${u.name} (${u.abbreviation})` })).find(u => u.value === field.value)}
                          onChange={val => field.onChange(val.value)}
                        />
                      )}
                    />
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

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-textMuted mb-1">Est. Cost Per Unit ({settings?.currency || '$'})</label>
                    <input type="number" step="0.01" {...register('cost_per_unit')} className="form-input w-1/2" />
                    <p className="text-xs text-textMuted mt-1">This will automatically update when you produce batches based on ingredient costs.</p>
                  </div>

                  <div className="flex items-center space-x-2 mt-4 col-span-2 hidden">
                    <input type="checkbox" {...register('expiry_tracked')} id="expiry_tracked" className="w-4 h-4 rounded bg-white/5 border-white/10 text-primary focus:ring-primary focus:ring-offset-background" />
                    <label htmlFor="expiry_tracked" className="text-sm font-medium text-textMuted">Track Expiry Dates</label>
                  </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-[#2dd4bf]/20">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                  Cancel
                </button>
                <button type="submit" className="bg-[#2dd4bf] hover:bg-[#2dd4bf]/90 text-[#0f172a] font-bold px-4 py-2 rounded-lg transition-colors">
                  Save Sub-Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Produce Batch Modal */}
      {batchModalOpen && selectedForBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isProducing && setBatchModalOpen(false)}></div>
          <div className="relative glass-panel w-full max-w-md p-6 border border-[#2dd4bf]/50 shadow-[0_0_30px_rgba(45,212,191,0.2)]">
            <h2 className="text-xl font-bold text-white mb-2 flex items-center space-x-2">
              <FiPlayCircle className="text-[#2dd4bf]" />
              <span>Produce Batch</span>
            </h2>
            <p className="text-sm text-textMuted mb-6">
                You are about to produce <strong className="text-white">{selectedForBatch.name}</strong>. 
                This will deduct the raw ingredients based on its recipe and increase its stock.
            </p>
            
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">
                        Yield Quantity ({selectedForBatch.unit?.abbreviation || selectedForBatch.unit_abbreviation || 'units'})
                    </label>
                    <input 
                        type="number" 
                        step="0.01"
                        min="0.01"
                        value={batchYield}
                        onChange={(e) => setBatchYield(parseFloat(e.target.value) || 0)}
                        className="form-input text-lg font-bold" 
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Notes (Optional)</label>
                    <textarea 
                        value={batchNotes}
                        onChange={(e) => setBatchNotes(e.target.value)}
                        className="form-input h-20 resize-none"
                        placeholder="e.g. Morning prep batch..."
                    />
                </div>
            </div>

            <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-white/10">
                <button 
                    disabled={isProducing}
                    onClick={() => setBatchModalOpen(false)} 
                    className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors"
                >
                    Cancel
                </button>
                <button 
                    onClick={handleProduceBatch}
                    disabled={isProducing || batchYield <= 0}
                    className="bg-[#2dd4bf] hover:bg-[#2dd4bf]/90 disabled:opacity-50 text-[#0f172a] font-bold px-6 py-2 rounded-lg transition-colors flex items-center space-x-2"
                >
                    {isProducing ? <div className="w-4 h-4 rounded-full border-2 border-[#0f172a] border-t-transparent animate-spin"></div> : null}
                    <span>Produce & Log</span>
                </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={deleteConfirmOpen}
        title="Delete Sub-Recipe"
        message={`Are you sure you want to delete ${materialToDelete?.name}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmOpen(false)}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
};

export default SubRecipes;
