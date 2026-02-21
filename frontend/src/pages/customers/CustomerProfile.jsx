import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { customersApi } from '../../api/customersApi';
import useSettingsStore from '../../store/settingsStore';
import PageHeader from '../../components/PageHeader';
import { FiArrowLeft, FiPrinter, FiUser, FiClock, FiShoppingBag, FiDollarSign } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const CustomerProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState(null);
    const [stats, setStats] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const { settings } = useSettingsStore();

    useEffect(() => {
        fetchCustomerData();
    }, [id]);

    const fetchCustomerData = async () => {
        setIsLoading(true);
        try {
            const [customerRes, statsRes] = await Promise.all([
                customersApi.getCustomer(id),
                customersApi.getCustomerStats(id)
            ]);
            setCustomer(customerRes.data);
            setStats(statsRes.data);
        } catch (error) {
            toast.error('Failed to load customer profile');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!customer || !stats) {
        return <div className="text-center text-textMuted mt-10">Customer not found.</div>;
    }

    // Determine printer width class based on settings
    const printerClass = {
        'thermal80': 'print:w-[80mm]',
        'thermal72': 'print:w-[72mm]',
        'a4': 'print:w-[210mm]',
        'a5': 'print:w-[148mm]'
    }[settings?.receipt_printer_type || 'thermal80'];

    return (
        <div className={`space-y-6 print:space-y-0 print:m-0 print:p-0 ${printerClass} mx-auto`}>
            {/* Screen-only header */}
            <div className="print:hidden">
                <button 
                    onClick={() => navigate('/customers')}
                    className="flex items-center text-textMuted hover:text-white mb-4 transition-colors text-sm font-medium"
                >
                    <FiArrowLeft className="mr-2" /> Back to Customers
                </button>
                <PageHeader 
                    title={`${customer.first_name} ${customer.last_name || ''}`}
                    subtitle={`Member since ${format(new Date(customer.created_at), 'MMMM yyyy')}`}
                    icon={FiUser}
                    action={{
                        label: "Print Account Statement",
                        icon: FiPrinter,
                        onClick: handlePrint
                    }}
                />
            </div>

            {/* Print-only header */}
            <div className="hidden print:block text-center mb-6 text-black border-b border-black pb-4">
                <h1 className="text-2xl font-bold">{settings?.brand_name || 'Waitless Cafe'}</h1>
                <p className="text-sm mt-1">Customer Account Statement</p>
                <div className="mt-4 text-left">
                    <p><strong>Name:</strong> {customer.first_name} {customer.last_name}</p>
                    <p><strong>Phone:</strong> {customer.phone}</p>
                    <p><strong>Date:</strong> {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                </div>
            </div>

            {/* KPIs Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-2 print:gap-2">
                <div className="glass-panel p-4 print:border-black print:text-black print:bg-white print:shadow-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-textMuted print:text-black">Total Visits</span>
                        <FiShoppingBag className="text-primary print:text-black w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black">{stats.total_visits}</div>
                </div>
                
                <div className="glass-panel p-4 print:border-black print:text-black print:bg-white print:shadow-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-textMuted print:text-black">Total Spent</span>
                        <FiDollarSign className="text-accent print:text-black w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black">
                        {settings?.currency || 'EGP'} {parseFloat(stats.total_spent).toFixed(2)}
                    </div>
                </div>

                <div className="glass-panel p-4 print:border-black print:text-black print:bg-white print:shadow-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-textMuted print:text-black">Tab Balance</span>
                        <FiClock className="text-orange-500 print:text-black w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black">
                        {settings?.currency || 'EGP'} {parseFloat(stats.tab_balance).toFixed(2)}
                    </div>
                </div>

                <div className="glass-panel p-4 print:border-black print:text-black print:bg-white print:shadow-none">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-textMuted print:text-black">Loyalty Points</span>
                        <FiUser className="text-green-500 print:text-black w-5 h-5" />
                    </div>
                    <div className="text-2xl font-bold text-white print:text-black">
                        {parseFloat(stats.loyalty_points).toFixed(0)} pts
                    </div>
                </div>
            </div>

            {/* Last Visit / Info Block */}
            <div className="glass-panel p-6 print:border-black print:text-black print:bg-white print:shadow-none print:mt-4">
                <h3 className="text-lg font-bold text-white print:text-black mb-4 flex items-center">
                    <FiClock className="mr-2 text-primary print:text-black" /> Account Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="text-textMuted print:text-gray-600 block mb-1">Last Visit Date</span>
                        <span className="font-medium text-white print:text-black">
                            {stats.last_visit ? format(new Date(stats.last_visit), 'PPP p') : 'Never'}
                        </span>
                    </div>
                    <div>
                        <span className="text-textMuted print:text-gray-600 block mb-1">Current Tier</span>
                        <span className="font-medium text-white print:text-black">
                            {customer.loyalty_account?.current_tier?.name || 'Standard'}
                        </span>
                    </div>
                    <div>
                        <span className="text-textMuted print:text-gray-600 block mb-1">Marketing Consent</span>
                        <span className="font-medium text-white print:text-black">
                            {customer.marketing_consent ? 'Opted In' : 'None'}
                        </span>
                    </div>
                    <div>
                        <span className="text-textMuted print:text-gray-600 block mb-1">Customer Notes</span>
                        <span className="font-medium text-white print:text-black">
                            {customer.preferences?.general_notes || 'No notes on file.'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Recent Orders */}
            <div className="glass-panel overflow-hidden print:border-black print:shadow-none print:mt-4">
                <div className="p-6 border-b border-white/5 print:border-black bg-white/5 print:bg-white">
                    <h3 className="text-lg font-bold text-white print:text-black flex items-center">
                        <FiShoppingBag className="mr-2 text-primary print:text-black" /> Recent Transactions
                    </h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm print:text-xs">
                        <thead>
                            <tr className="border-b border-white/10 print:border-black bg-white/5 print:bg-white text-textMuted print:text-black font-semibold">
                                <th className="p-4">Date</th>
                                <th className="p-4">Order #</th>
                                <th className="p-4">Type</th>
                                <th className="p-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 print:divide-black">
                            {stats.recent_orders?.length === 0 ? (
                                <tr><td colSpan="4" className="p-4 text-center text-textMuted print:text-black">No transactions found.</td></tr>
                            ) : (
                                stats.recent_orders?.map((order, i) => (
                                    <tr key={i} className="hover:bg-white/5 print:hover:bg-transparent">
                                        <td className="p-4 text-white print:text-black">{format(new Date(order.created_at), 'dd MMM yyyy, HH:mm')}</td>
                                        <td className="p-4 font-mono text-textMuted print:text-black">{order.order_number}</td>
                                        <td className="p-4 text-white print:text-black capitalize">{order.order_type.replace('_', ' ')}</td>
                                        <td className="p-4 text-right font-bold text-accent print:text-black">
                                            {settings?.currency || 'EGP'} {parseFloat(order.total_amount).toFixed(2)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Print Footer */}
            <div className="hidden print:block text-center mt-8 text-xs text-black border-t border-black pt-4">
                <p>{settings?.receipt_footer_msg || '*** End of Statement ***'}</p>
            </div>
        </div>
    );
};

export default CustomerProfile;
