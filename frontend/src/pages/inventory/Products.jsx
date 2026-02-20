import React, { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import Select from 'react-select';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2, FiCoffee, FiUploadCloud } from 'react-icons/fi';
import { inventoryApi } from '../../api/inventoryApi';
import useSettingsStore from '../../store/settingsStore';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';

const productSchema = yup.object().shape({
    name: yup.string().required('Name is required'),
    name_ar: yup.string().nullable(),
    category: yup.string().required('Category is required'),
    price: yup.number().positive('Must be positive').required('Price is required'),
    description: yup.string().nullable(),
    is_active: yup.boolean()
});

const categoryOptions = [
    { value: 'hot_drinks', label: 'Hot Drinks' },
    { value: 'cold_drinks', label: 'Cold Drinks' },
    { value: 'pastries', label: 'Pastries' },
    { value: 'desserts', label: 'Desserts' },
    { value: 'addons', label: 'Add-ons' },
    { value: 'other', label: 'Other' }
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

const Products = () => {
    const [products, setProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [imageFile, setImageFile] = useState(null);

    const { settings } = useSettingsStore();

    const { register, control, handleSubmit, reset, setValue, formState: { errors } } = useForm({
        resolver: yupResolver(productSchema),
        defaultValues: { is_active: true }
    });

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const res = await inventoryApi.getProducts();
            setProducts(res.data);
        } catch (error) {
            toast.error("Failed to fetch products");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const openAddModal = () => {
        setEditingProduct(null);
        setImageFile(null);
        reset({ name: '', name_ar: '', category: '', price: '', description: '', is_active: true });
        setIsModalOpen(true);
    };

    const openEditModal = (product) => {
        setEditingProduct(product);
        setImageFile(null);
        setValue('name', product.name);
        setValue('name_ar', product.name_ar || '');
        setValue('category', product.category);
        setValue('price', product.price);
        setValue('description', product.description || '');
        setValue('is_active', product.is_active);
        setIsModalOpen(true);
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setImageFile(e.target.files[0]);
        }
    };

    const onSubmit = async (data) => {
        try {
            // Using FormData because of the image upload
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (data[key] !== null && data[key] !== undefined) {
                    formData.append(key, data[key]);
                }
            });
            
            if (imageFile) {
                formData.append('image', imageFile);
            }

            if (editingProduct) {
                await inventoryApi.updateProduct(editingProduct.id, formData);
                toast.success("Product updated successfully");
            } else {
                await inventoryApi.createProduct(formData);
                toast.success("Product created successfully");
            }
            setIsModalOpen(false);
            fetchProducts();
        } catch (error) {
             toast.error(error.response?.data?.detail || "Failed to save product");
        }
    };

    const confirmDelete = async () => {
        try {
            await inventoryApi.deleteProduct(productToDelete.id);
            toast.success("Product deleted");
            setDeleteConfirmOpen(false);
            fetchProducts();
        } catch (error) {
            toast.error("Failed to delete product (It might be currently used in a recipe)");
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
            accessorKey: 'category',
            cell: info => <span className="uppercase text-xs tracking-wider bg-white/5 px-2 py-1 rounded">{info.getValue().replace('_', ' ')}</span>
        },
        {
            header: 'Selling Price',
            accessorFn: row => `${settings?.currency || '$'}${parseFloat(row.price).toFixed(2)}`,
            cell: info => <span className="font-mono text-green-400 font-bold">{info.getValue()}</span>
        },
        {
            header: 'Status',
            accessorKey: 'is_active',
            cell: info => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.getValue() ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {info.getValue() ? 'Active' : 'Archived'}
                </span>
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
            <div className="flex justify-between items-center mb-6">
                <div>
                     <h1 className="text-2xl font-bold text-white">Menu Products</h1>
                     <p className="text-sm text-textMuted mt-1">Manage what you sell to customers and link them to recipes.</p>
                </div>
                <button 
                    onClick={openAddModal}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Add Product</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={products} 
                isLoading={isLoading}
                searchPlaceholder="Search products..."
            />

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-white mb-6">
                            {editingProduct ? 'Edit Product' : 'New Product'}
                        </h2>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            
                            <div className="flex space-x-6">
                                {/* Image Upload */}
                                <div className="w-1/3 flex flex-col justify-center items-center border-2 border-dashed border-white/10 rounded-xl p-4 text-center hover:border-primary/50 transition-colors cursor-pointer relative overflow-hidden group">
                                    <input type="file" accept="image/*" onChange={handleImageChange} className="absolute inset-0 opacity-0 cursor-pointer z-10" />
                                    {imageFile ? (
                                        <img src={URL.createObjectURL(imageFile)} alt="Preview" className="w-full h-full object-cover absolute inset-0 rounded-xl" />
                                    ) : editingProduct?.image ? (
                                        <img src={editingProduct.image} alt="Current" className="w-full h-full object-cover absolute inset-0 rounded-xl" />
                                    ) : (
                                        <>
                                            <FiUploadCloud className="w-8 h-8 text-textMuted mb-2 group-hover:text-primary transition-colors" />
                                            <span className="text-sm text-white font-medium">Upload Image</span>
                                            <span className="text-xs text-textMuted mt-1">PNG, JPG up to 2MB</span>
                                        </>
                                    )}
                                </div>

                                {/* Main Details */}
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-1">Product Name (EN) *</label>
                                        <input type="text" {...register('name')} className="form-input" placeholder="e.g. Caramel Macchiato" />
                                        {errors.name && <span className="text-red-400 text-xs">{errors.name.message}</span>}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-textMuted mb-1">Product Name (AR)</label>
                                        <input type="text" {...register('name_ar')} className="form-input text-right" placeholder="مثال: كراميل ميكاتو" dir="rtl" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Category *</label>
                                    <Controller
                                        name="category"
                                        control={control}
                                        render={({ field }) => (
                                            <Select
                                                {...field}
                                                options={categoryOptions}
                                                styles={selectStyles}
                                                placeholder="Select Category..."
                                                value={categoryOptions.find(c => c.value === field.value)}
                                                onChange={val => field.onChange(val.value)}
                                            />
                                        )}
                                    />
                                    {errors.category && <span className="text-red-400 text-xs">{errors.category.message}</span>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Target Selling Price ({settings?.currency || '$'}) *</label>
                                    <input type="number" step="0.01" {...register('price')} className="form-input font-mono text-green-400" />
                                    {errors.price && <span className="text-red-400 text-xs">{errors.price.message}</span>}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Internal Description</label>
                                <textarea {...register('description')} className="form-input min-h-[80px]" placeholder="Optional notes about this product..."></textarea>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <input type="checkbox" {...register('is_active')} id="is_active" className="w-4 h-4 rounded bg-white/5 border-white/10 text-primary focus:ring-primary focus:ring-offset-background" />
                                <label htmlFor="is_active" className="text-sm font-medium text-textMuted">Active (Visible on POS)</label>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors font-medium shadow-lg">
                                    Save Product
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                title="Delete Product"
                message={`Are you sure you want to delete this product? This will also archive its recipe. This action cannot be undone.`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
                confirmText="Delete Product"
                isDestructive={true}
            />
        </div>
    );
};

export default Products;
