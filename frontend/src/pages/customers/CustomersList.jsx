import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '../../api/customersApi';
import DataTable from '../../components/DataTable';
import PageHeader from '../../components/PageHeader';
import { FiUsers, FiPlus, FiEdit, FiTrash2, FiSearch, FiFilter, FiUser } from 'react-icons/fi';
import toast from 'react-hot-toast';
import CustomerModal from './CustomerModal';

const CustomersList = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const response = await customersApi.getCustomers();
            setCustomers(response.data);
        } catch (error) {
            toast.error('Failed to parse customer profiles');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this customer?")) return;
        try {
            await customersApi.deleteCustomer(id);
            toast.success('Customer removed successfully');
            fetchCustomers();
        } catch (error) {
            toast.error('Failed to delete customer');
        }
    };

    const handleEdit = (customer) => {
        setEditingCustomer(customer);
        setIsModalOpen(true);
    };

    const handleCreateCustomer = () => {
        setEditingCustomer(null);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data) => {
        try {
            if (editingCustomer) {
                await customersApi.updateCustomer(editingCustomer.id, data);
                toast.success('Customer profile updated');
            } else {
                await customersApi.createCustomer(data);
                toast.success('New customer registered');
            }
            setIsModalOpen(false);
            fetchCustomers();
        } catch (error) {
            let errorMsg = 'Failed to save customer';
            const data = error.response?.data;
            
            if (data) {
                if (typeof data.detail === 'string') {
                    errorMsg = data.detail;
                } else if (typeof data === 'object') {
                    // Extract first validation error (e.g. { phone: ["already exists"] })
                    const firstKey = Object.keys(data)[0];
                    if (firstKey && Array.isArray(data[firstKey])) {
                        errorMsg = `${firstKey.replace('_', ' ')}: ${data[firstKey][0]}`;
                    } else if (firstKey && typeof data[firstKey] === 'string') {
                        errorMsg = data[firstKey];
                    }
                }
            }
            toast.error(errorMsg);
            console.error(error);
        }
    };

    const columns = [
        {
            header: "Name",
            accessorFn: (row) => `${row.first_name} ${row.last_name || ''}`,
        },
        { header: "Phone", accessorKey: "phone" },
        { 
            header: "Loyalty Tier", 
            id: "loyalty_tier",
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    {row.original.loyalty_account?.current_tier_name ? (
                        <span 
                            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{ 
                                backgroundColor: `${row.original.loyalty_account.current_tier_color}20`,
                                color: row.original.loyalty_account.current_tier_color 
                            }}
                        >
                            {row.original.loyalty_account.current_tier_name}
                        </span>
                    ) : (
                        <span className="text-textMuted italic text-sm">None</span>
                    )}
                    <span className="text-xs text-textMuted">
                        ({parseFloat(row.original.loyalty_account?.points_balance || 0)} pts)
                    </span>
                </div>
            )
        },
        { 
            header: "Tab Balance", 
            id: "tab_balance",
            cell: ({ row }) => (
                <span className={`font-semibold ${parseFloat(row.original.tab?.balance) > 0 ? 'text-red-600' : 'text-textMuted'}`}>
                    {parseFloat(row.original.tab?.balance || 0).toFixed(2)} EGP
                </span>
            )
        },
        {
            header: "Actions",
            id: "actions",
            cell: ({ row }) => (
                <div className="flex justify-end gap-2">
                    <button 
                        onClick={() => navigate(`/customers/${row.original.id}`)}
                        className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="View Profile"
                    >
                        <FiUser className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleEdit(row.original)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit Customer"
                    >
                        <FiEdit className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => handleDelete(row.original.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Customer"
                    >
                        <FiTrash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ];

    const filteredCustomers = customers.filter(c => 
        c.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
    );

    return (
        <div className="space-y-6">
            <PageHeader 
                title="Customer CRM"
                subtitle="Manage loyalty members, store credit, and preferences"
                icon={FiUsers}
                action={{
                    label: "Add Customer",
                    icon: FiPlus,
                    onClick: handleCreateCustomer
                }}
            />

            {/* Filters Area */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 glass-panel mb-6">
                <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
                    <input 
                        type="text"
                        placeholder="Search by name or phone number..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-white/10 bg-background text-textMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                    />
                </div>
                <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-textMain bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                    <FiFilter className="w-4 h-4" /> Filters
                </button>
            </div>

            <DataTable 
                columns={columns}
                data={filteredCustomers}
                isLoading={isLoading}
                emptyMessage="No customers found matching your search."
            />

            <CustomerModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                customer={editingCustomer}
            />
        </div>
    );
};

export default CustomersList;
