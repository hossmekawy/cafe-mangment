import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { 
    FiPlus, FiEdit2, FiTrash2, FiAlertTriangle, FiUploadCloud, 
    FiArrowLeft, FiDownload, FiX, FiCheck 
} from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { inventoryApi } from '../../api/inventoryApi';
import useSettingsStore from '../../store/settingsStore';

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
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  
  // Delete confirm state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [materialToDelete, setMaterialToDelete] = useState(null);

  const { settings } = useSettingsStore();

  const { register, control, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: yupResolver(materialSchema)
  });

  const categoryOptions = [
    { value: 'dairy', label: 'Dairy' },
    { value: 'beverages', label: 'Beverages' },
    { value: 'dry_goods', label: 'Dry Goods' },
    { value: 'packaging', label: 'Packaging' },
    { value: 'fresh_produce', label: 'Fresh Produce' },
    { value: 'cleaning', label: 'Cleaning & Maintenance' },
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
      accessorFn: row => `${settings?.currency || '$'}${parseFloat(row.cost_per_unit).toFixed(2)}`,
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
  ], [units, settings]);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">Raw Materials</h1>
        <div className="flex items-center space-x-3">
            <button 
              onClick={() => setImportModalOpen(true)}
              className="bg-[#1e293b] hover:bg-[#2dd4bf]/20 text-white border border-white/10 hover:border-[#2dd4bf]/50 px-4 py-2 rounded-lg font-medium transition-all flex items-center space-x-2"
            >
              <FiUploadCloud className="w-5 h-5 text-[#2dd4bf]" />
              <span>Bulk Import</span>
            </button>
            <button 
              onClick={openAddModal}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
            >
              <FiPlus className="w-5 h-5" />
              <span>Add Material</span>
            </button>
        </div>
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
                    <label className="block text-sm font-medium text-textMuted mb-1">Base Unit</label>
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

                  <div>
                    <label className="block text-sm font-medium text-textMuted mb-1">Base Cost ({settings?.currency || '$'})</label>
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

      {/* Bulk Import Modal */}
      <ImportRawMaterialsModal 
          isOpen={importModalOpen} 
          onClose={() => setImportModalOpen(false)} 
          onSuccess={() => { setImportModalOpen(false); fetchData(); }} 
      />
    </div>
  );
};

// -------------------------------------------------------------
// BULK IMPORT MODAL (Two-Step process)
// -------------------------------------------------------------
const ImportRawMaterialsModal = ({ isOpen, onClose, onSuccess }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [previewData, setPreviewData] = useState([]);

    if (!isOpen) return null;

    const resetModal = () => {
        setStep(1);
        setFile(null);
        setPreviewData([]);
        onClose();
    };

    const handleDownloadTemplate = async () => {
        try {
            const toastId = toast.loading("Downloading template...");
            const response = await inventoryApi.exportMaterialsTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'materials_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success("Template downloaded", { id: toastId });
        } catch (error) {
            toast.error("Failed to download template");
        }
    };

    const handlePreview = async () => {
        if (!file) return toast.error("Please select an Excel file first");
        
        const formData = new FormData();
        formData.append('file', file);
        
        setIsProcessing(true);
        const toastId = toast.loading("Parsing Excel file...");
        
        try {
            const response = await inventoryApi.previewBulkMaterials(formData);
            if (response.data.success && response.data.data.length > 0) {
                toast.success("File parsed! Please review the data.", { id: toastId });
                setPreviewData(response.data.data);
                setStep(2);
            } else {
                toast.error("No valid data found in the file", { id: toastId });
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to parse the file.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleConfirmImport = async () => {
        setIsProcessing(true);
        const toastId = toast.loading("Importing materials...");
        try {
            const response = await inventoryApi.confirmBulkMaterials(previewData);
            if (response.data.success) {
                toast.success(response.data.message, { id: toastId });
                if (response.data.errors?.length > 0) {
                    toast.error(`Some rows failed: ${response.data.errors.length} errors. Check console.`, { duration: 5000 });
                    console.warn("Import Errors:", response.data.errors);
                }
                onSuccess();
                resetModal();
            } else {
                toast.error(response.data.detail || "Import failed", { id: toastId });
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "Import failed during saving.", { id: toastId });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleCellChange = (rowIndex, field, value) => {
        const newData = [...previewData];
        newData[rowIndex][field] = value;
        setPreviewData(newData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in-up">
            <div className={`bg-[#1e293b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${step === 2 ? 'w-full max-w-6xl' : 'w-full max-w-md'}`}>
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                    <h3 className="text-xl font-black text-white flex items-center space-x-2">
                        <FiUploadCloud className="text-[#2dd4bf]" /> 
                        <span>{step === 1 ? 'Bulk Import Materials' : 'Review & Edit Materials Data'}</span>
                    </h3>
                    <button onClick={resetModal} className="text-textMuted hover:text-white bg-white/5 p-2 rounded-lg transition-colors">
                        <FiX />
                    </button>
                </div>
                
                {step === 1 ? (
                    <>
                        <div className="p-6 space-y-6">
                            <div className="bg-[#2dd4bf]/10 border border-[#2dd4bf]/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-white font-medium mb-3">1. Download the Excel template</p>
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="bg-[#2dd4bf]/20 hover:bg-[#2dd4bf]/30 text-[#2dd4bf] border border-[#2dd4bf]/30 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 transition-colors"
                                >
                                    <FiDownload /> <span>Download Template.xlsx</span>
                                </button>
                                <p className="text-xs text-textMuted mt-3">Fill in your material details exactly as structured in the downloaded file.</p>
                            </div>

                            <div className="border border-white/10 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-white font-medium mb-3">2. Upload filled Excel file</p>
                                <div className="w-full relative">
                                    <input 
                                        type="file" 
                                        accept=".xlsx, .xls" 
                                        onChange={(e) => setFile(e.target.files[0])}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={`w-full py-4 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center ${file ? 'border-green-500/50 bg-green-500/10' : 'border-white/20 bg-white/5 hover:border-[#2dd4bf]/50'}`}>
                                        <FiUploadCloud className={`w-6 h-6 mb-2 ${file ? 'text-green-400' : 'text-textMuted'}`} />
                                        <span className={`text-sm font-bold ${file ? 'text-green-400' : 'text-textMuted'}`}>
                                            {file ? file.name : 'Click to browse or drag file here'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-5 border-t border-white/10 bg-[#0f172a]">
                            <button 
                                onClick={handlePreview}
                                disabled={!file || isProcessing}
                                className="w-full bg-[#2dd4bf] hover:bg-[#2dd4bf]/90 disabled:opacity-50 text-[#0f172a] font-black py-3 rounded-xl shadow-[0_0_15px_rgba(45,212,191,0.3)] transition-all flex justify-center items-center space-x-2"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#0f172a]"></div>
                                ) : (
                                    <>
                                        <span>Preview Data</span> <FiArrowLeft className="rotate-180" />
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="p-6 overflow-y-auto max-h-[70vh]">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr className="border-b border-white/10 text-textMuted">
                                        <th className="pb-3 px-2 font-medium">Name (EN)</th>
                                        <th className="pb-3 px-2 font-medium">Name (AR)</th>
                                        <th className="pb-3 px-2 font-medium">Category</th>
                                        <th className="pb-3 px-2 font-medium">Unit ID</th>
                                        <th className="pb-3 px-2 font-medium">Cost Price</th>
                                        <th className="pb-3 px-2 font-medium">Current Stock</th>
                                        <th className="pb-3 px-2 font-medium">Min Stock</th>
                                        <th className="pb-3 px-2 font-medium">Reorder Qty</th>
                                        <th className="pb-3 px-2 font-medium">Barcode</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                            <td className="p-2">
                                                <input type="text" value={row.name} onChange={(e) => handleCellChange(idx, 'name', e.target.value)} className="input py-1 px-2 w-full text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.name_ar} onChange={(e) => handleCellChange(idx, 'name_ar', e.target.value)} className="input py-1 px-2 w-full text-sm" dir="rtl" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.category} onChange={(e) => handleCellChange(idx, 'category', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.unit_id} onChange={(e) => handleCellChange(idx, 'unit_id', e.target.value)} className="input py-1 px-2 w-20 text-sm text-center" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.cost_price} onChange={(e) => handleCellChange(idx, 'cost_price', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.current_stock} onChange={(e) => handleCellChange(idx, 'current_stock', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.minimum_stock} onChange={(e) => handleCellChange(idx, 'minimum_stock', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.reorder_quantity} onChange={(e) => handleCellChange(idx, 'reorder_quantity', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.barcode} onChange={(e) => handleCellChange(idx, 'barcode', e.target.value)} className="input py-1 px-2 w-32 text-sm" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-5 border-t border-white/10 bg-[#0f172a] flex justify-between items-center">
                            <button onClick={() => setStep(1)} className="btn hover:bg-white/5 text-textMuted flex items-center space-x-2">
                                <FiArrowLeft /> <span>Back to Upload</span>
                            </button>
                            <button 
                                onClick={handleConfirmImport}
                                disabled={isProcessing}
                                className="bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 transition-colors shadow-lg shadow-green-500/20"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                ) : (
                                    <>
                                        <FiCheck /> <span>Confirm & Import {previewData.length} Materials</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default RawMaterials;
