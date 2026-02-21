import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { 
    FiPlus, FiEdit2, FiTrash2, FiCoffee, FiUploadCloud, 
    FiArrowLeft, FiSettings, FiTag, FiLayers, FiBox, FiClock, FiStar, FiCalendar, FiDownload, FiX, FiCheck, FiActivity
} from 'react-icons/fi';
import { inventoryApi } from '../../api/inventoryApi';
import useSettingsStore from '../../store/settingsStore';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import ProductAnalyticsModal from './ProductAnalyticsModal';

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

export default function Products() {
    const [view, setView] = useState('list'); // 'list' | 'builder'
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [rawMaterials, setRawMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingProduct, setEditingProduct] = useState(null);
    const { settings } = useSettingsStore();

    // Delete Modal
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    
    // Import Modal
    const [importModalOpen, setImportModalOpen] = useState(false);

    // Analytics Modal
    const [analyticsProduct, setAnalyticsProduct] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [prodRes, catRes, recipesRes, materialsRes] = await Promise.all([
                inventoryApi.getProducts(),
                inventoryApi.getCategories(),
                inventoryApi.getRecipes(),
                inventoryApi.getMaterials()
            ]);
            setProducts(prodRes.data);
            setCategories(catRes.data);
            setRecipes(recipesRes.data);
            setRawMaterials(materialsRes.data);
        } catch (error) {
            toast.error("Failed to fetch initial data");
        } finally {
            setIsLoading(false);
        }
    };

    const confirmDelete = async () => {
        try {
            await inventoryApi.deleteProduct(productToDelete.id);
            toast.success("Product deleted");
            setDeleteConfirmOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to delete product (It might be currently used)");
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Item',
            accessorFn: row => row.name,
            cell: info => (
                <div className="flex items-center space-x-3">
                    {info.row.original.image ? (
                        <img src={info.row.original.image} alt="product" className="w-10 h-10 rounded-lg object-cover border border-white/10" />
                    ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/30">
                            <FiCoffee className="w-5 h-5 text-primary" />
                        </div>
                    )}
                    <div>
                        <p className="font-bold text-white leading-tight">{info.row.original.name}</p>
                        {info.row.original.name_ar && <p className="text-xs text-textMuted mt-0.5">{info.row.original.name_ar}</p>}
                    </div>
                </div>
            )
        },
        {
            header: 'Category',
            accessorFn: row => row.category_name,
            cell: info => <span className="uppercase text-xs tracking-wider bg-white/5 px-2 py-1 rounded">{info.getValue() || 'Uncategorized'}</span>
        },
        {
            header: 'Selling Price',
            accessorFn: row => `${settings?.currency || '$'}${parseFloat(row.price).toFixed(2)}`,
            cell: info => <span className="font-mono text-green-400 font-bold">{info.getValue()}</span>
        },
        {
            header: 'Status',
            accessorKey: 'availability_status',
            cell: info => {
                const map = {
                    'available': { label: 'Available', color: 'bg-green-500/20 text-green-400' },
                    'out_of_stock': { label: 'Out of Stock', color: 'bg-orange-500/20 text-orange-400' },
                    'hidden': { label: 'Hidden', color: 'bg-gray-500/20 text-gray-400' },
                };
                const status = map[info.getValue()] || map['hidden'];
                return (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                        {status.label}
                    </span>
                );
            }
        },
        {
            header: 'Actions',
            id: 'actions',
            cell: info => (
                <div className="flex space-x-2">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setAnalyticsProduct(info.row.original);
                        }}
                        className="p-1.5 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded transition-colors"
                        title="View Analytics"
                    >
                        <FiActivity className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setEditingProduct(info.row.original);
                            setView('builder');
                        }}
                        className="p-1.5 bg-white/5 hover:bg-white/10 text-white rounded transition-colors"
                    >
                        <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setProductToDelete(info.row.original);
                            setDeleteConfirmOpen(true);
                        }}
                        className="p-1.5 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [settings]);

    return (
        <div className="p-6">
            {view === 'list' ? (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <div>
                             <h1 className="text-2xl font-bold text-white">Menu Products</h1>
                             <p className="text-sm text-textMuted mt-1">Manage core items, pricing tiers, and meal combos.</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button 
                                onClick={() => setImportModalOpen(true)}
                                className="bg-[#1e293b] hover:bg-[#1e293b]/80 border border-white/10 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
                            >
                                <FiUploadCloud className="w-5 h-5 text-primary" />
                                <span>Bulk Import</span>
                            </button>
                            <button 
                                onClick={() => { setEditingProduct(null); setView('builder'); }}
                                className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                            >
                                <FiPlus className="w-5 h-5" />
                                <span>New Product</span>
                            </button>
                        </div>
                    </div>

                    <DataTable 
                        columns={columns} 
                        data={products} 
                        isLoading={isLoading}
                        searchPlaceholder="Search products by name or category..."
                    />

                    {analyticsProduct && (
                        <ProductAnalyticsModal 
                            product={analyticsProduct} 
                            onClose={() => setAnalyticsProduct(null)} 
                        />
                    )}
                </>
            ) : (
                <ProductBuilder 
                    product={editingProduct} 
                    categories={categories}
                    allProducts={products}
                    recipes={recipes}
                    rawMaterials={rawMaterials}
                    currency={settings?.currency || '$'}
                    onBack={() => { setView('list'); fetchData(); }}
                />
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                title="Delete Product"
                message={`Are you sure you want to delete this product? This action cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
                confirmText="Delete Product"
                isDestructive={true}
            />

            {/* Bulk Import Modal */}
            <ImportProductsModal 
                isOpen={importModalOpen} 
                onClose={() => setImportModalOpen(false)} 
                onSuccess={() => { setImportModalOpen(false); fetchData(); }} 
            />
        </div>
    );
}

// -------------------------------------------------------------
// BULK IMPORT MODAL (Two-Step process)
// -------------------------------------------------------------
const ImportProductsModal = ({ isOpen, onClose, onSuccess }) => {
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
            const response = await inventoryApi.exportProductsTemplate();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'products_template.xlsx');
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
            const response = await inventoryApi.importBulkProducts(formData);
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
        const toastId = toast.loading("Importing products...");
        try {
            const response = await inventoryApi.confirmBulkProducts(previewData);
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
            <div className={`bg-[#1e293b] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${step === 2 ? 'w-full max-w-5xl' : 'w-full max-w-md'}`}>
                <div className="p-5 border-b border-white/10 flex justify-between items-center bg-[#0f172a] shrink-0">
                    <h3 className="text-xl font-black text-white flex items-center space-x-2">
                        <FiUploadCloud className="text-primary" /> 
                        <span>{step === 1 ? 'Bulk Import' : 'Review & Edit Data'}</span>
                    </h3>
                    <button onClick={resetModal} className="text-textMuted hover:text-white bg-white/5 p-2 rounded-lg transition-colors">
                        <FiX />
                    </button>
                </div>
                
                {step === 1 ? (
                    <>
                        <div className="p-6 space-y-6">
                            <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex flex-col items-center justify-center text-center">
                                <p className="text-sm text-white font-medium mb-3">1. Download the Excel template</p>
                                <button 
                                    onClick={handleDownloadTemplate}
                                    className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30 px-4 py-2 rounded-lg text-sm font-bold flex items-center space-x-2 transition-colors"
                                >
                                    <FiDownload /> <span>Download Template.xlsx</span>
                                </button>
                                <p className="text-xs text-textMuted mt-3">Fill in your product details exactly as structured in the downloaded file.</p>
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
                                    <div className={`w-full py-4 rounded-lg border-2 border-dashed transition-colors flex flex-col items-center justify-center ${file ? 'border-green-500/50 bg-green-500/10' : 'border-white/20 bg-white/5 hover:border-primary/50'}`}>
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
                                className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-black py-3 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all flex justify-center items-center space-x-2"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
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
                                        <th className="pb-3 px-2 font-medium">Cat. ID</th>
                                        <th className="pb-3 px-2 font-medium">Price</th>
                                        <th className="pb-3 px-2 font-medium">Cost Price</th>
                                        <th className="pb-3 px-2 font-medium min-w-[200px]">Description</th>
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
                                                <input type="text" value={row.cat_id} onChange={(e) => handleCellChange(idx, 'cat_id', e.target.value)} className="input py-1 px-2 w-16 text-sm text-center" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.price} onChange={(e) => handleCellChange(idx, 'price', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="number" step="0.01" value={row.cost_price} onChange={(e) => handleCellChange(idx, 'cost_price', e.target.value)} className="input py-1 px-2 w-24 text-sm" />
                                            </td>
                                            <td className="p-2">
                                                <input type="text" value={row.description} onChange={(e) => handleCellChange(idx, 'description', e.target.value)} className="input py-1 px-2 w-full text-sm" />
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
                                        <FiCheck /> <span>Confirm & Import {previewData.length} Products</span>
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

// -------------------------------------------------------------
// PRODUCT BUILDER (MULTI-TAB)
// -------------------------------------------------------------
const ProductBuilder = ({ product, categories, allProducts, recipes, rawMaterials, currency, onBack }) => {
    const [activeTab, setActiveTab] = useState('basic');
    const [imageFile, setImageFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form Data overriding specific defaults
    const [formData, setFormData] = useState({
        name: product?.name || '',
        name_ar: product?.name_ar || '',
        description: product?.description || '',
        category: product?.category || '',
        price: product?.price || 0,
        price_takeaway: product?.price_takeaway || '',
        price_delivery: product?.price_delivery || '',
        cost_price: product?.cost_price || 0,
        linked_raw_material: product?.linked_raw_material || '',
        availability_status: product?.availability_status || 'available',
        preparation_time: product?.preparation_time || 5, // minutes
        is_popular: product?.is_popular || false,
        is_seasonal: product?.is_seasonal || false,
        season_start_date: product?.season_start_date || '',
        season_end_date: product?.season_end_date || '',
    });

    const [variations, setVariations] = useState(
        (product?.variations || []).map(v => ({ ...v, _localId: Math.random().toString(36).substr(2, 9) }))
    );
    const [deletedVariations, setDeletedVariations] = useState([]);

    const [comboItems, setComboItems] = useState(
        (product?.combo_items || []).map(c => ({ ...c, _localId: Math.random().toString(36).substr(2, 9) }))
    );
    const [deletedComboItems, setDeletedComboItems] = useState([]);

    const catOptions = buildCategoryOptions(categories);

    function buildCategoryOptions(cats) {
        // Flatten categories for react-select, showing hierarchical names gracefully
        const flatList = [];
        const catMap = {};
        cats.forEach(c => catMap[c.id] = { ...c, children: [] });
        const roots = [];
        cats.forEach(c => {
            if (c.parent) { if (catMap[c.parent]) catMap[c.parent].children.push(catMap[c.id]); }
            else { roots.push(catMap[c.id]); }
        });

        const processNode = (nodes, prefix = '') => {
            nodes.sort((a,b) => a.order - b.order || a.name.localeCompare(b.name));
            nodes.forEach(n => {
                flatList.push({ value: n.id, label: `${prefix}${n.name}` });
                processNode(n.children, prefix + '— ');
            });
        };
        processNode(roots);
        return flatList;
    }

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        if (!formData.name || !formData.category || formData.price === '') {
            toast.error("Name, Category, and Price are required.");
            return;
        }

        setIsSaving(true);
        const toastId = toast.loading("Saving product details...");

        try {
            // 1. Save Base Product
            const pData = new FormData();
            Object.keys(formData).forEach(key => {
                if (formData[key] !== '' && formData[key] !== null) {
                    pData.append(key, formData[key]);
                } else if (key === 'linked_raw_material' && formData[key] === '') {
                    // Send an empty string explicitely so DRF clears the foreign key
                    pData.append(key, '');
                }
            });
            if (imageFile) {
                pData.append('image', imageFile);
            }

            let savedProduct;
            if (product?.id) {
                const res = await inventoryApi.updateProduct(product.id, pData);
                savedProduct = res.data;
            } else {
                const res = await inventoryApi.createProduct(pData);
                savedProduct = res.data;
            }

            // 2. Process Variations
            // Delete removed
            for (const id of deletedVariations) {
                await inventoryApi.deleteVariation(id);
            }
            // Add / Edit current
            for (const v of variations) {
                const payload = {
                    product: savedProduct.id,
                    size_name: v.size_name,
                    price: v.price || 0,
                    price_takeaway: v.price_takeaway || null,
                    price_delivery: v.price_delivery || null,
                    cost_price: v.cost_price || 0,
                    is_active: true
                };
                if (v.id) {
                    await inventoryApi.updateVariation(v.id, payload);
                } else {
                    await inventoryApi.createVariation(payload);
                }
            }

            // 3. Process Combos
            for (const id of deletedComboItems) {
                await inventoryApi.deleteComboItem(id);
            }
            for (const c of comboItems) {
                const payload = {
                    parent_combo: savedProduct.id,
                    child_product: c.child_product,
                    quantity: c.quantity || 1,
                    extra_price: c.extra_price || 0
                };
                if (c.id) {
                    await inventoryApi.updateComboItem(c.id, payload);
                } else {
                    await inventoryApi.createComboItem(payload);
                }
            }

            toast.success("Menu Builder Saved Successfully!", { id: toastId });
            onBack();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Failed to save entire product configuration.", { id: toastId });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="flex items-center space-x-4 mb-6">
                <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-textMuted hover:text-white">
                    <FiArrowLeft className="w-5 h-5" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">{product ? 'Menu Builder: ' + product.name : 'New Menu Item'}</h1>
                    <p className="text-textMuted text-sm">Configure multi-tab details</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 items-start">
                
                {/* Tabs Sidebar */}
                <div className="w-full lg:w-48 xl:w-64 flex lg:flex-col space-x-2 lg:space-x-0 lg:space-y-2 overflow-x-auto pb-2 lg:pb-0 shrink-0">
                    <TabBtn active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} icon={<FiTag />} label="Basic Info" />
                    <TabBtn active={activeTab === 'pricing'} onClick={() => setActiveTab('pricing')} icon={<FiBox />} label="Pricing & Sizes" />
                    <TabBtn active={activeTab === 'recipes'} onClick={() => setActiveTab('recipes')} icon={<FiCoffee />} label="Recipes & Cost" />
                    <TabBtn active={activeTab === 'combos'} onClick={() => setActiveTab('combos')} icon={<FiLayers />} label="Combo Meals" />
                    <TabBtn active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<FiSettings />} label="Settings" />
                </div>

                {/* Content Area */}
                <div className="flex-1 glass-panel p-6 w-full lg:min-h-[500px] flex flex-col justify-between">
                    <div className="space-y-6">
                        {activeTab === 'basic' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-bold text-white mb-4 border-b border-white/10 pb-2">Basic Information</h3>
                                <div className="flex flex-col sm:flex-row gap-6">
                                    <div className="w-full sm:w-48 h-48 border-2 border-dashed border-white/10 hover:border-primary/50 rounded-xl flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group shrink-0 transition-colors">
                                        <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && setImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                        {imageFile ? (
                                            <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover absolute inset-0" />
                                        ) : product?.image ? (
                                            <img src={product.image} alt="Current" className="w-full h-full object-cover absolute inset-0" />
                                        ) : (
                                            <>
                                                <FiUploadCloud className="w-8 h-8 text-textMuted mb-2 group-hover:text-primary transition-colors" />
                                                <span className="text-sm font-medium">Upload Image</span>
                                                <span className="text-xs text-textMuted mt-1 px-4 text-center">PNG, JPG up to 2MB</span>
                                            </>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-textMuted mb-1">Name (EN) *</label>
                                                <input required type="text" name="name" value={formData.name} onChange={handleChange} className="input w-full" placeholder="Caramel Macchiato" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-textMuted mb-1">Name (AR)</label>
                                                <input type="text" name="name_ar" value={formData.name_ar} onChange={handleChange} className="input w-full text-right" dir="rtl" placeholder="كراميل ميكاتو" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1">Menu Category *</label>
                                            <Select 
                                                options={catOptions} 
                                                styles={selectStyles}
                                                value={catOptions.find(o => o.value === formData.category)}
                                                onChange={v => setFormData({ ...formData, category: v.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1">Public Description</label>
                                            <textarea name="description" value={formData.description} onChange={handleChange} className="input w-full min-h-[80px]" placeholder="Delicious notes..."></textarea>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'pricing' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">Base Pricing</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1">Selling Price ({currency}) *</label>
                                            <input required type="number" step="0.01" name="price" value={formData.price} onChange={handleChange} className="input w-full text-green-400 font-mono" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1">Takeaway Over. ({currency})</label>
                                            <input type="number" step="0.01" name="price_takeaway" value={formData.price_takeaway} onChange={handleChange} className="input w-full" placeholder="Optional" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1">Delivery Over. ({currency})</label>
                                            <input type="number" step="0.01" name="price_delivery" value={formData.price_delivery} onChange={handleChange} className="input w-full" placeholder="Optional" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-1">Cost Price ({currency})</label>
                                            <input type="number" step="0.01" name="cost_price" value={formData.cost_price} onChange={handleChange} className="input w-full text-red-400 font-mono" />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
                                        <h3 className="text-lg font-bold text-white">Size Variations</h3>
                                        <button 
                                            onClick={() => setVariations([...variations, { _localId: Date.now().toString(), size_name: '', price: 0 }])}
                                            className="btn btn-sm bg-white/5 hover:bg-white/10 text-xs flex items-center space-x-1"
                                        >
                                            <FiPlus /> <span>Add Size</span>
                                        </button>
                                    </div>
                                    {variations.length === 0 ? (
                                        <p className="text-textMuted text-sm italic">No variations enabled. The base pricing above will be used exclusively.</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {variations.map((v, index) => (
                                                <div key={v._localId} className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
                                                    <div className="flex-1 min-w-[120px]">
                                                        <label className="text-xs text-textMuted block mb-1">Size Name (e.g. Large)</label>
                                                        <input type="text" value={v.size_name || ''} onChange={e => {
                                                            const n = [...variations]; n[index].size_name = e.target.value; setVariations(n);
                                                        }} className="input w-full text-sm py-1.5" />
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="text-xs text-textMuted block mb-1">Price</label>
                                                        <input type="number" step="0.01" value={v.price || ''} onChange={e => {
                                                            const n = [...variations]; n[index].price = e.target.value; setVariations(n);
                                                        }} className="input w-full text-sm py-1.5 font-mono text-green-400" />
                                                    </div>
                                                    <div className="w-24">
                                                        <label className="text-xs text-textMuted block mb-1">Cost</label>
                                                        <input type="number" step="0.01" value={v.cost_price || ''} onChange={e => {
                                                            const n = [...variations]; n[index].cost_price = e.target.value; setVariations(n);
                                                        }} className="input w-full text-sm py-1.5 font-mono text-red-400" />
                                                    </div>
                                                    <button onClick={() => {
                                                        const n = [...variations];
                                                        if (n[index].id) setDeletedVariations([...deletedVariations, n[index].id]);
                                                        n.splice(index, 1);
                                                        setVariations(n);
                                                    }} className="mt-5 p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors">
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))}
                                            <p className="text-xs text-textMuted mt-2 px-2">Note: POS will prompt for size selection if variations exist.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'combos' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Meal Combos</h3>
                                        <p className="text-xs text-textMuted mt-1">Select child products that make up this meal deal.</p>
                                    </div>
                                    <button 
                                        onClick={() => setComboItems([...comboItems, { _localId: Date.now().toString(), child_product: '', quantity: 1, extra_price: 0 }])}
                                        className="btn btn-sm bg-primary/20 hover:bg-primary/30 text-primary flex items-center space-x-1"
                                    >
                                        <FiPlus /> <span>Add Combo Item</span>
                                    </button>
                                </div>

                                {comboItems.length === 0 ? (
                                    <div className="text-center py-10 bg-black/20 rounded-xl border border-white/5 border-dashed">
                                        <FiLayers className="w-8 h-8 mx-auto text-textMuted mb-2" />
                                        <p className="text-textMuted">This is a standard product. Add items here to turn it into a Bundle/Meal.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {comboItems.map((c, index) => (
                                            <div key={c._localId} className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-lg border border-white/5">
                                                <div className="flex-1 min-w-[200px]">
                                                    <label className="text-xs text-textMuted block mb-1">Child Product</label>
                                                    <select 
                                                        value={c.child_product || ''} 
                                                        onChange={e => {
                                                            const n = [...comboItems]; n[index].child_product = e.target.value; setComboItems(n);
                                                        }} 
                                                        className="input w-full text-sm py-1.5"
                                                    >
                                                        <option value="">Select product...</option>
                                                        {allProducts.filter(ap => ap.id !== product?.id).map((p) => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="w-20">
                                                    <label className="text-xs text-textMuted block mb-1">Quantity</label>
                                                    <input type="number" min="1" value={c.quantity || 1} onChange={e => {
                                                        const n = [...comboItems]; n[index].quantity = parseInt(e.target.value); setComboItems(n);
                                                    }} className="input w-full text-sm py-1.5" />
                                                </div>
                                                <div className="w-32">
                                                    <label className="text-xs text-textMuted block mb-1">Added {currency} (Optional)</label>
                                                    <input type="number" step="0.01" value={c.extra_price || ''} onChange={e => {
                                                        const n = [...comboItems]; n[index].extra_price = e.target.value; setComboItems(n);
                                                    }} className="input w-full text-sm py-1.5" />
                                                </div>
                                                <button onClick={() => {
                                                    const n = [...comboItems];
                                                    if (n[index].id) setDeletedComboItems([...deletedComboItems, n[index].id]);
                                                    n.splice(index, 1);
                                                    setComboItems(n);
                                                }} className="mt-5 p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors">
                                                    <FiTrash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'recipes' && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Recipes & Cost Tracking</h3>
                                        <p className="text-xs text-textMuted mt-1">Manage sub-recipes for this base item and its variations.</p>
                                    </div>
                                    <button 
                                        onClick={() => window.open('/dashboard/inventory', '_blank')}
                                        className="btn btn-sm bg-primary/20 hover:bg-primary/30 text-primary flex items-center space-x-1"
                                    >
                                        <FiPlus /> <span>Manage Recipes</span>
                                    </button>
                                </div>

                                {!product?.id ? (
                                    <div className="text-center py-10 bg-black/20 rounded-xl border border-white/5 border-dashed">
                                        <FiCoffee className="w-8 h-8 mx-auto text-textMuted mb-2" />
                                        <p className="text-textMuted text-sm">You must save this product first before linking recipes.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {(() => {
                                            const prodRecipes = recipes.filter(r => r.product === product.id);
                                            
                                            if (prodRecipes.length === 0) {
                                                return (
                                                    <div className="text-center py-10 bg-black/20 rounded-xl border border-warning/20 border-dashed text-yellow-500">
                                                        <FiCoffee className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                                        <p className="font-medium">No recipes found for this product.</p>
                                                        <p className="text-xs opacity-70 mt-1">Cost is completely manually set until you build a recipe.</p>
                                                    </div>
                                                );
                                            }

                                            return prodRecipes.map(recipe => {
                                                const costPerYield = parseFloat(recipe.total_cost) / parseFloat(recipe.yield_quantity);
                                                return (
                                                    <div key={recipe.id} className="bg-black/20 p-4 rounded-xl border border-white/10 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all hover:bg-white/5">
                                                        <div className="flex items-start space-x-3">
                                                            <div className="p-3 bg-primary/20 text-primary rounded-lg border border-primary/20 shrink-0">
                                                                <FiCoffee className="w-5 h-5" />
                                                            </div>
                                                            <div>
                                                                <h4 className="font-bold text-white text-md">
                                                                    {recipe.variation_name ? `Size: ${recipe.variation_name}` : 'Base Recipe'}
                                                                </h4>
                                                                <p className="text-xs text-textMuted mt-1">
                                                                    {recipe.ingredients?.length || 0} ingredients used. Yields {parseFloat(recipe.yield_quantity).toFixed(2)} units.
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="bg-[#0f172a] px-4 py-2 rounded-lg border border-white/5 whitespace-nowrap">
                                                            <p className="text-xs text-textMuted font-medium mb-0.5">Calculated Cost</p>
                                                            <p className="text-lg font-mono text-red-400 font-bold">{currency}{costPerYield.toFixed(2)}</p>
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'settings' && (
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">Inventory & Tracking</h3>
                                    <div className="bg-primary/10 border border-primary/20 p-4 rounded-xl">
                                        <label className="block text-sm font-bold text-white mb-2">Direct Retail Link</label>
                                        <p className="text-xs text-textMuted mb-3">If this is a simple item (e.g. Water Bottle) that does NOT have a recipe, select the mapped Inventory Material below. Selling this product will deduct 1 unit from that material's stock automatically.</p>
                                        <select name="linked_raw_material" value={formData.linked_raw_material || ''} onChange={handleChange} className="input w-full bg-[#0f172a]">
                                            <option value="">-- No Direct Link (Requires Recipe) --</option>
                                            {rawMaterials.map(rm => (
                                                <option key={rm.id} value={rm.id}>{rm.name} ({rm.unit_abbreviation || ''})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">Availability & Status</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-textMuted mb-2">POS Status</label>
                                            <select name="availability_status" value={formData.availability_status} onChange={handleChange} className="input w-full">
                                                <option value="available">Available (Active on POS)</option>
                                                <option value="out_of_stock">Out of Stock (Shows but disabled)</option>
                                                <option value="hidden">Hidden (Archived/Invisible)</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center space-x-3 pt-6">
                                            <input type="checkbox" id="is_popular" name="is_popular" checked={formData.is_popular} onChange={handleChange} className="w-5 h-5 rounded border-white/20 bg-black/20 text-yellow-500 focus:ring-yellow-500" />
                                            <label htmlFor="is_popular" className="font-medium text-white flex items-center space-x-2 cursor-pointer">
                                                <FiStar className="text-yellow-500 fill-current" /> <span>Mark as Popular (Highlights on POS)</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">Preparation & Operations</h3>
                                    <div className="w-full md:w-1/2">
                                        <label className="block text-sm font-medium text-textMuted mb-2 flex items-center space-x-2">
                                            <FiClock /> <span>Est. Preparation Time (Minutes)</span>
                                        </label>
                                        <input type="number" min="0" name="preparation_time" value={formData.preparation_time} onChange={handleChange} className="input w-full" />
                                        <p className="text-xs text-textMuted mt-1">Helps kitchen display system (KDS) manage queues.</p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white border-b border-white/10 pb-2 mb-4">Seasonality (Optional)</h3>
                                    <div className="flex items-center space-x-3 mb-4">
                                        <input type="checkbox" id="is_seasonal" name="is_seasonal" checked={formData.is_seasonal} onChange={handleChange} className="w-5 h-5 rounded border-white/20 bg-black/20 text-primary focus:ring-primary" />
                                        <label htmlFor="is_seasonal" className="font-medium text-white flex items-center space-x-2 cursor-pointer">
                                            <FiCalendar className="text-primary" /> <span>Seasonal Item</span>
                                        </label>
                                    </div>
                                    {formData.is_seasonal && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                                            <div>
                                                <label className="block text-sm font-medium text-textMuted mb-1">Season Start Date</label>
                                                <input type="date" name="season_start_date" value={formData.season_start_date} onChange={handleChange} className="input w-full" />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-textMuted mb-1">Season End Date</label>
                                                <input type="date" name="season_end_date" value={formData.season_end_date} onChange={handleChange} className="input w-full" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-6 mt-8 border-t border-white/10 flex justify-end">
                        <button onClick={handleSave} disabled={isSaving} className="btn btn-primary flex items-center space-x-2 px-8 py-3 text-lg w-full sm:w-auto justify-center shadow-lg shadow-primary/20">
                            {isSaving ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                <><span>Save Product Data</span></>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper for tabs
const TabBtn = ({ active, onClick, icon, label }) => (
    <button 
        onClick={onClick}
        className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-all text-sm w-full lg:w-full shrink-0 ${active ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-100' : 'text-textMuted hover:bg-white/5 hover:text-white'}`}
    >
        {icon} <span>{label}</span>
    </button>
);
