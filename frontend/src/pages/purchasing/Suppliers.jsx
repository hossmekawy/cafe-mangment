import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import DataTable from '../../components/DataTable';
import ConfirmModal from '../../components/ConfirmModal';
import { purchasingApi } from '../../api/purchasingApi';

const supplierSchema = yup.object().shape({
  name: yup.string().required('Supplier Name is required'),
  contact_person: yup.string(),
  email: yup.string().email('Invalid email').nullable(),
  phone: yup.string(),
  address: yup.string(),
  tax_id: yup.string()
});

const Suppliers = () => {
    const [suppliers, setSuppliers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    
    // Delete confirm state
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [supplierToDelete, setSupplierToDelete] = useState(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: yupResolver(supplierSchema)
    });

    const fetchSuppliers = async () => {
        setIsLoading(true);
        try {
            const res = await purchasingApi.getSuppliers();
            setSuppliers(res.data);
        } catch (error) {
            toast.error('Failed to load suppliers');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const openAddModal = () => {
        setEditingSupplier(null);
        reset({
            name: '',
            contact_person: '',
            email: '',
            phone: '',
            address: '',
            tax_id: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (supplier) => {
        setEditingSupplier(supplier);
        reset({
            name: supplier.name,
            contact_person: supplier.contact_person || '',
            email: supplier.email || '',
            phone: supplier.phone || '',
            address: supplier.address || '',
            tax_id: supplier.tax_id || ''
        });
        setIsModalOpen(true);
    };

    const onSubmit = async (data) => {
        try {
            if (editingSupplier) {
                await purchasingApi.updateSupplier(editingSupplier.id, data);
                toast.success('Supplier updated successfully');
            } else {
                await purchasingApi.createSupplier(data);
                toast.success('Supplier created successfully');
            }
            setIsModalOpen(false);
            fetchSuppliers();
        } catch (error) {
            toast.error('Failed to save supplier details');
        }
    };

    const confirmDelete = async () => {
        try {
            await purchasingApi.deleteSupplier(supplierToDelete.id);
            toast.success('Supplier deleted successfully');
            setDeleteConfirmOpen(false);
            fetchSuppliers();
        } catch (error) {
            toast.error('Cannot delete supplier. They may be linked to existing orders.');
            setDeleteConfirmOpen(false);
        }
    };

    const columns = useMemo(() => [
        {
            header: 'Supplier Name',
            accessorKey: 'name',
            cell: info => <span className="font-semibold">{info.getValue()}</span>
        },
        {
            header: 'Contact Person',
            accessorKey: 'contact_person',
        },
        {
            header: 'Phone / Email',
            accessorFn: row => `${row.phone || 'N/A'} | ${row.email || 'N/A'}`,
        },
        {
            header: 'Status',
            accessorKey: 'is_active',
            cell: info => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${info.getValue() ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {info.getValue() ? 'Active' : 'Inactive'}
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
                        className="p-1.5 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                    >
                        <FiEdit2 className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            setSupplierToDelete(info.row.original);
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
                <h1 className="text-2xl font-bold text-white">Suppliers</h1>
                <button 
                    onClick={openAddModal}
                    className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-lg shadow-primary/20"
                >
                    <FiPlus className="w-5 h-5" />
                    <span>Add Supplier</span>
                </button>
            </div>

            <DataTable 
                columns={columns} 
                data={suppliers} 
                isLoading={isLoading}
                searchPlaceholder="Search suppliers by name or contact..."
            />

            {/* Supplier Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
                    <div className="relative glass-panel w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold text-white mb-4">
                            {editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                        </h2>
                        
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Company / Supplier Name *</label>
                                <input {...register('name')} className="form-input" placeholder="e.g. Global Foods Inc." />
                                {errors.name && <span className="text-red-400 text-xs">{errors.name.message}</span>}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Contact Person</label>
                                    <input {...register('contact_person')} className="form-input" placeholder="e.g. John Doe" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Tax ID / VAT Number</label>
                                    <input {...register('tax_id')} className="form-input" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Phone</label>
                                    <input {...register('phone')} className="form-input" placeholder="+1..." />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-textMuted mb-1">Email</label>
                                    <input type="email" {...register('email')} className="form-input" placeholder="supplier@example.com" />
                                    {errors.email && <span className="text-red-400 text-xs">{errors.email.message}</span>}
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-textMuted mb-1">Billing / Shipping Address</label>
                                <textarea {...register('address')} rows="2" className="form-input"></textarea>
                            </div>

                            <div className="flex justify-end space-x-3 pt-4 border-t border-white/10 mt-6">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg text-textMuted hover:bg-white/5 transition-colors">
                                    Cancel
                                </button>
                                <button type="submit" className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg transition-colors">
                                    Save Supplier
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <ConfirmModal 
                isOpen={deleteConfirmOpen}
                title="Delete Supplier"
                message={`Are you sure you want to completely remove ${supplierToDelete?.name}?`}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteConfirmOpen(false)}
                confirmText="Delete Supplier"
                isDestructive={true}
            />
        </div>
    );
};

export default Suppliers;
