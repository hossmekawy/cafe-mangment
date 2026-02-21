import React, { useState, useEffect } from 'react';
import { posApi } from '../../api/posApi';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { FiShoppingCart, FiSearch, FiX, FiCheck, FiCoffee, FiPlus, FiMinus, FiCreditCard, FiClock, FiLayers, FiUserCheck, FiGift, FiTrash2, FiEdit2 } from 'react-icons/fi';
import ConfirmModal from '../../components/ConfirmModal';
import { customersApi } from '../../api/customersApi';
import useSettingsStore from '../../store/settingsStore';
import { printReceipt } from './ReceiptPrinter';

const POSDashboard = () => {
    const { user } = useAuthStore();
    const { settings } = useSettingsStore();
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [activeCategory, setActiveCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    
    // Cart State
    const [cart, setCart] = useState([]);
    const [orderType, setOrderType] = useState('takeaway');
    const [selectedTable, setSelectedTable] = useState(null);
    const [tables, setTables] = useState([]);
    
    // Modifiers & Variations State
    const [modifierModalOpen, setModifierModalOpen] = useState(false);
    const [selectedProductForMod, setSelectedProductForMod] = useState(null);
    const [selectedVariation, setSelectedVariation] = useState(null); 
    const [currentModifiers, setCurrentModifiers] = useState([]); 
    const [specialInstructions, setSpecialInstructions] = useState('');

    // Checkout & Payments State
    const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
    const [payments, setPayments] = useState([]); // {method, amount}
    const [paymentAmountInput, setPaymentAmountInput] = useState('');
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('cash');

    // Customer & Loyalty State
    const [customerPhone, setCustomerPhone] = useState('');
    const [attachedCustomer, setAttachedCustomer] = useState(null);
    const [pointsToRedeem, setPointsToRedeem] = useState('');
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
    
    // Quick Add Customer Data
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({ first_name: '', last_name: '', phone: '' });

    // Open Orders / Drafts State
    const [activeOrderId, setActiveOrderId] = useState(null);
    const [activeOrderTotal, setActiveOrderTotal] = useState(0);
    const [showDraftsModal, setShowDraftsModal] = useState(false);
    const [draftOrders, setDraftOrders] = useState([]);
    
    // No print state needed - printReceipt() opens its own window

    useEffect(() => {
        fetchProducts();
        fetchTables();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const response = await posApi.getProducts();
            setProducts(response.data);
            
            // Extract unique categories using category_name
            const cats = [...new Set(response.data.map(p => p.category_name || 'Uncategorized'))];
            setCategories(['all', ...cats]);
        } catch (error) {
            toast.error("Failed to load products");
        } finally {
            setIsLoading(false);
        }
    };
    
    const fetchTables = async () => {
        try {
            const response = await posApi.getTables();
            setTables(response.data.filter(t => t.status === 'available'));
        } catch (error) {
            console.error("Failed to load tables", error);
        }
    };

    const handleSearchCustomer = async () => {
        if (!customerPhone) return;
        setIsSearchingCustomer(true);
        try {
            const res = await customersApi.getCustomers({ search: customerPhone });
            if (res.data && res.data.length > 0) {
                const cust = res.data[0];
                setAttachedCustomer(cust);
                toast.success(`Attached ${cust.first_name} ${cust.last_name || ''}`);
                
                // Birthday Alert
                if (cust.date_of_birth) {
                    const dob = new Date(cust.date_of_birth);
                    const today = new Date();
                    if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) {
                        toast('🎂 It is their birthday today!', { icon: '🎉', duration: 5000 });
                    }
                }
            } else {
                setNewCustomerData({ first_name: '', last_name: '', phone: customerPhone });
                setShowAddCustomerModal(true);
            }
        } catch (err) {
            toast.error('Error searching customer');
        } finally {
            setIsSearchingCustomer(false);
        }
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerData.first_name || !newCustomerData.phone) {
            toast.error('Name and Phone are required');
            return;
        }
        try {
            const res = await customersApi.createCustomer(newCustomerData);
            setAttachedCustomer(res.data);
            toast.success('Customer Created & Attached!');
            setShowAddCustomerModal(false);
        } catch (err) {
            toast.error('Failed to create customer');
        }
    };

    const fetchDraftOrders = async () => {
        try {
            const res = await posApi.getOrders();
            setDraftOrders(res.data.filter(o => o.status === 'pending'));
        } catch (error) {
            console.error(error);
        }
    };

    const loadDraftOrder = (order) => {
        setActiveOrderId(order.id);
        setActiveOrderTotal(order.total_amount);
        setOrderType(order.order_type);
        setSelectedTable(order.table || null);
        if (order.customer) {
            customersApi.getCustomer(order.customer).then(res => setAttachedCustomer(res.data)).catch(() => {});
        }
        // Direct to payment — cart stays empty, pays by stored total
        setCart([]);
        setPayments([]);
        setPaymentAmountInput(order.total_amount);
        setSelectedPaymentMethod('cash');
        setShowDraftsModal(false);
        setCheckoutModalOpen(true);
    };

    // Load a draft INTO the cart for full editing (add/remove items, then re-save or pay)
    const loadDraftForEditing = async (order) => {
        const toastId = toast.loading('Loading order for editing...');
        try {
            // Fetch the full order with nested items to rebuild the cart
            const res = await posApi.getOrder(order.id);
            const fullOrder = res.data;

            // Rebuild cart items from the saved order items
            // We need full product objects — fetch them from the existing products list
            const cartItems = (fullOrder.items || []).map(item => ({
                // Minimal product object needed by the cart and calculations
                product: {
                    id:   item.product,
                    name: item.product_name,
                    price: parseFloat(item.unit_price),
                    modifier_groups: [],
                    variations: [],
                },
                quantity:             item.quantity,
                unit_price:           parseFloat(item.unit_price),
                total_price:          parseFloat(item.total_price),
                modifiers:            (item.modifiers_details || []).map(m => m.id),
                modifiersObjects:     item.modifiers_details || [],
                special_instructions: item.special_instructions || '',
                cartKey: `${item.product}-${Date.now()}-${Math.random()}`,
            }));

            setCart(cartItems);
            setActiveOrderId(fullOrder.id);
            setActiveOrderTotal(fullOrder.total_amount);
            setOrderType(fullOrder.order_type);
            setSelectedTable(fullOrder.table || null);
            setPayments([]);
            setPaymentAmountInput('');

            if (fullOrder.customer) {
                customersApi.getCustomer(fullOrder.customer)
                    .then(r => setAttachedCustomer(r.data))
                    .catch(() => {});
            } else {
                setAttachedCustomer(null);
            }

            setShowDraftsModal(false);
            toast.success(`Editing order ${fullOrder.order_number}`, { id: toastId });
        } catch (err) {
            toast.error('Failed to load order for editing', { id: toastId });
        }
    };

    const handleProductClick = (product) => {
        const hasModifiers = product.modifier_groups && product.modifier_groups.length > 0;
        const hasVariations = product.variations && product.variations.length > 0;
        
        if (hasModifiers || hasVariations) {
            // Open modal to select size and modifiers
            setSelectedProductForMod(product);
            setCurrentModifiers([]);
            setSpecialInstructions('');
            
            // Auto-select first variation if exists to prevent errors
            if (hasVariations) {
                setSelectedVariation(product.variations[0]);
            } else {
                setSelectedVariation(null);
            }
            
            setModifierModalOpen(true);
        } else {
            // Add straight to cart
            addToCart(product, null, [], '');
        }
    };

    const addToCart = (product, variation, modifiers = [], instructions = '') => {
        // Calculate unit price with modifiers and variation
        let modifiersPrice = 0;
        let selectedModsObjects = [];
        
        modifiers.forEach(modId => {
            product.modifier_groups?.forEach(group => {
                const mod = group.modifiers.find(m => m.id === modId);
                if (mod) {
                    modifiersPrice += parseFloat(mod.extra_price || 0);
                    selectedModsObjects.push(mod);
                }
            });
        });
        
        // Base price comes from variation if selected, else base product price
        let basePrice = variation ? parseFloat(variation.price) : parseFloat(product.price);
        
        // Add combo extra prices if any (Combos are static for now)
        let comboExtraPrice = 0;
        if (product.combo_items && product.combo_items.length > 0) {
           comboExtraPrice = product.combo_items.reduce((sum, item) => sum + parseFloat(item.extra_price || 0), 0);
        }

        const unitPrice = basePrice + modifiersPrice + comboExtraPrice;

        // Check if identical item already in cart (same product + variation + modifiers + instructions)
        const existingItemIndex = cart.findIndex(item => 
            item.product.id === product.id && 
            item.variation?.id === variation?.id &&
            JSON.stringify(item.modifiers.sort()) === JSON.stringify(modifiers.sort()) &&
            item.special_instructions === instructions
        );

        if (existingItemIndex > -1) {
            const newCart = [...cart];
            newCart[existingItemIndex].quantity += 1;
            newCart[existingItemIndex].total_price = newCart[existingItemIndex].quantity * unitPrice;
            setCart(newCart);
        } else {
            const newItem = {
                id: Date.now().toString(), // local frontend ID
                product: product,
                variation: variation,
                quantity: 1,
                modifiers: modifiers,
                modifiersObjects: selectedModsObjects,
                special_instructions: instructions,
                unit_price: unitPrice,
                total_price: unitPrice
            };
            setCart([...cart, newItem]);
        }
        
        setModifierModalOpen(false);
    };

    const updateCartQuantity = (index, delta) => {
        const newCart = [...cart];
        const newQty = newCart[index].quantity + delta;
        
        if (newQty <= 0) {
            newCart.splice(index, 1);
        } else {
            newCart[index].quantity = newQty;
            newCart[index].total_price = newQty * newCart[index].unit_price;
        }
        setCart(newCart);
    };

    const filteredProducts = products.filter(p => {
        const catName = p.category_name || 'Uncategorized';
        const matchesCat = activeCategory === 'all' || catName === activeCategory;
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                              (p.name_ar && p.name_ar.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCat && matchesSearch;
    });
    
    const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
    
    // Tax Calculation Based on Settings
    const taxRate = settings?.tax_rate ? (parseFloat(settings.tax_rate) / 100) : 0.14;
    const isTaxInclusive = settings?.tax_inclusive === true;
    
    let baseTaxableAmount = subtotal;
    let estimatedTax = 0;

    if (isTaxInclusive) {
        // Subtotal already includes tax: Tax = Subtotal - (Subtotal / (1 + TaxRate))
        baseTaxableAmount = subtotal / (1 + taxRate);
        estimatedTax = subtotal - baseTaxableAmount;
    } else {
        // Subtotal does not include tax: Tax = Subtotal * TaxRate
        estimatedTax = subtotal * taxRate;
    }

    // Service Charge Calculation
    const serviceChargeRate = settings?.service_charge_rate ? (parseFloat(settings.service_charge_rate) / 100) : 0.12;
    const serviceCharge = orderType === 'dine_in' ? subtotal * serviceChargeRate : 0; 
    
    // Loyalty Discount
    const loyaltyDiscount = pointsToRedeem ? (parseFloat(pointsToRedeem) * 0.5) : 0;
    
    // Total (If tax is inclusive, tax is already in subtotal, so we don't add it again)
    const totalWithoutTaxAddition = isTaxInclusive ? subtotal : (subtotal + estimatedTax);
    const total = Math.max(0, totalWithoutTaxAddition + serviceCharge - loyaltyDiscount);

    // Split Payments Logic
    const remainingBalance = Math.max(0, (activeOrderId ? parseFloat(activeOrderTotal) : total) - payments.reduce((sum, p) => sum + p.amount, 0));

    const handleCheckout = () => {
        if (!activeOrderId) {
            if (cart.length === 0) {
                toast.error("Cart is empty");
                return;
            }
            if (orderType === 'dine_in' && !selectedTable) {
                toast.error("Please select a table for Dine-In orders");
                return;
            }
            setPaymentAmountInput(total.toFixed(2));
        }
        
        setPayments([]);
        setSelectedPaymentMethod('cash');
        setCheckoutModalOpen(true);
    };

    const handleSendToKitchen = async () => {
        if (cart.length === 0) {
            toast.error("Cart is empty");
            return;
        }
        if (orderType === 'dine_in' && !selectedTable) {
            toast.error("Please select a table for Dine-In orders");
            return;
        }

        const orderData = {
            order_type: orderType,
            customer: attachedCustomer ? attachedCustomer.id : null,
            table: selectedTable || null,
            subtotal: subtotal.toFixed(2),
            tax_amount: estimatedTax.toFixed(2),
            service_charge: serviceCharge.toFixed(2),
            discount_amount: loyaltyDiscount.toFixed(2),
            total_amount: total.toFixed(2),
            items: cart.map(item => ({
                product: item.product.id,
                quantity: item.quantity,
                modifiers: item.modifiers || [],
                special_instructions: item.special_instructions || ''
            }))
        };

        const isEditingDraft = !!activeOrderId;
        const toastId = toast.loading(isEditingDraft ? "Updating Draft Order..." : "Saving Order...");
        try {
            if (isEditingDraft) {
                // PATCH the existing draft with the new items list
                await posApi.updateOrder(activeOrderId, orderData);
                toast.success("Draft Updated!", { id: toastId });
            } else {
                await posApi.createOrder(orderData);
                toast.success("Order Saved & Sent to Kitchen!", { id: toastId });
            }
            // Reset POS state
            setCart([]);
            setSelectedTable(null);
            setAttachedCustomer(null);
            setCustomerPhone('');
            setPointsToRedeem('');
            setActiveOrderId(null);
            setActiveOrderTotal(0);
            fetchTables();
        } catch (error) {
            toast.error(error.response?.data?.error || error.response?.data?.detail || "Failed to save order", { id: toastId });
        }
    };

    const handleAddPayment = () => {
        const amt = parseFloat(paymentAmountInput);
        if (isNaN(amt) || amt <= 0.01) return;
        if (amt > remainingBalance + 0.01) {
            toast.error("Payment exceeds remaining balance");
            return;
        }
        
        if (selectedPaymentMethod === 'tab' && !attachedCustomer) {
            toast.error("Customer must be attached to use Tab payment");
            return;
        }

        setPayments([...payments, { method: selectedPaymentMethod, amount: amt }]);
        setPaymentAmountInput(Math.max(0, remainingBalance - amt).toFixed(2));
    };

    const handleRemovePayment = (index) => {
        const newPayments = [...payments];
        newPayments.splice(index, 1);
        setPayments(newPayments);
        const newRem = Math.max(0, total - newPayments.reduce((sum, p) => sum + p.amount, 0));
        setPaymentAmountInput(newRem.toFixed(2));
    };

    const submitOrder = async (shouldPrint = false) => {
        if (remainingBalance > 0.01) {
            toast.error("Balance must be completely paid off.");
            return;
        }

        const toastId = toast.loading("Processing Payment...");
        
        try {
            let orderIdToPay = activeOrderId;
            let finalizedOrderData = null;
            
            // If paying a brand new cart order, create it first
            if (!orderIdToPay) {
                const orderData = {
                    order_type: orderType,
                    customer: attachedCustomer ? attachedCustomer.id : null,
                    table: selectedTable || null,
                    subtotal: subtotal.toFixed(2),
                    tax_amount: estimatedTax.toFixed(2),
                    service_charge: serviceCharge.toFixed(2),
                    discount_amount: loyaltyDiscount.toFixed(2),
                    total_amount: total.toFixed(2),
                    items: cart.map(item => ({
                        product: item.product.id,
                        quantity: item.quantity,
                        modifiers: item.modifiers,
                        special_instructions: item.special_instructions
                    }))
                };
                const res = await posApi.createOrder(orderData);
                orderIdToPay = res.data.id;
                finalizedOrderData = res.data;
            } else {
                // If it was a draft, we need it to print. Let's fetch it if not currently held purely in frontend memory.
                const res = await posApi.getOrders();
                finalizedOrderData = res.data.find(o => o.id === orderIdToPay);
            }

            await posApi.processPayment(orderIdToPay, {
                payments: payments,
                redeemed_points: pointsToRedeem ? parseInt(pointsToRedeem) : 0
            });
            
            toast.success("Order Complete!", { id: toastId });
            
            // Trigger Print Flow — call directly before state reset so all values are captured
            if (shouldPrint && finalizedOrderData) {
                printReceipt({
                    order: finalizedOrderData,
                    cart: [...cart],
                    subtotal,
                    taxInfo: estimatedTax,
                    serviceCharge,
                    discountInfo: loyaltyDiscount,
                    total,
                    payments: [...payments],
                    remainingBalance,
                });
            }

            // Reset all state
            setCart([]);
            setSelectedTable(null);
            setAttachedCustomer(null);
            setCustomerPhone('');
            setPointsToRedeem('');
            setCheckoutModalOpen(false);
            setActiveOrderId(null);
            setActiveOrderTotal(0);
            fetchTables(); 
        } catch (error) {
            toast.error(error.response?.data?.error || error.response?.data?.detail || "Failed to process order", { id: toastId });
        }
    };

    const renderModifierContent = () => {
        if (!selectedProductForMod) return null;
        
        return (
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
                
                {/* Size Variations */}
                {selectedProductForMod.variations?.length > 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-4 py-3 bg-[#0f172a] border-b border-white/5">
                            <h4 className="font-bold text-white text-sm">Select Size *</h4>
                        </div>
                        <div className="p-3 grid grid-cols-3 gap-3">
                            {selectedProductForMod.variations.map(variation => (
                                <button
                                    key={variation.id}
                                    onClick={() => setSelectedVariation(variation)}
                                    className={`py-3 px-2 rounded-lg border flex flex-col items-center justify-center transition-all ${
                                        selectedVariation?.id === variation.id
                                        ? 'bg-primary/20 border-primary text-textMain'
                                        : 'bg-surface border-transparent text-textMuted hover:bg-white/10 hover:text-textMain'
                                    }`}
                                >
                                    <span className="font-bold text-sm mb-1">{variation.size_name}</span>
                                    <span className="font-mono text-xs">{settings?.currency || '$'}{variation.price}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Modifiers */}
                {selectedProductForMod.modifier_groups?.map(group => (
                    <div key={group.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                        <div className="px-4 py-2 bg-background border-b border-white/5 flex justify-between items-center">
                            <h4 className="font-bold text-textMain text-sm">{group.name}</h4>
                            <span className="text-[10px] text-textMuted uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded">
                                {group.max_choices === 1 ? 'Choose 1' : `Choose up to ${group.max_choices || 'Any'}`}
                            </span>
                        </div>
                        <div className="p-2 space-y-1">
                            {group.modifiers.map(mod => {
                                const isSelected = currentModifiers.includes(mod.id);
                                return (
                                    <button 
                                        key={mod.id}
                                        onClick={() => {
                                            if (group.max_choices === 1) {
                                                const groupModIds = group.modifiers.map(m => m.id);
                                                const newMods = currentModifiers.filter(id => !groupModIds.includes(id));
                                                setCurrentModifiers([...newMods, mod.id]);
                                            } else {
                                                if (isSelected) {
                                                    setCurrentModifiers(currentModifiers.filter(id => id !== mod.id));
                                                } else {
                                                    const selectedInGroup = currentModifiers.filter(id => group.modifiers.map(m=>m.id).includes(id));
                                                    if (group.max_choices === 0 || selectedInGroup.length < group.max_choices) {
                                                        setCurrentModifiers([...currentModifiers, mod.id]);
                                                    } else {
                                                        toast.error(`Maximum ${group.max_choices} choices allowed for ${group.name}`);
                                                    }
                                                }
                                            }
                                        }}
                                        className={`w-full flex justify-between items-center p-3 rounded-lg text-sm transition-all border ${
                                            isSelected 
                                            ? 'bg-primary/20 border-primary text-textMain shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]' 
                                            : 'bg-surface border-transparent text-textMuted hover:bg-white/5 hover:text-textMain'
                                        }`}
                                    >
                                        <span>{mod.name}</span>
                                        {parseFloat(mod.extra_price) > 0 && (
                                            <span className="font-mono text-xs shadow-sm bg-black/30 px-2 py-1 rounded text-primary">+{settings?.currency || '$'}{mod.extra_price}</span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                ))}
                
                {/* Special Instructions */}
                <div>
                    <label className="block text-sm font-bold text-textMain mb-2">Special Instructions</label>
                    <textarea 
                        className="w-full bg-background text-textMain border border-white/10 rounded-xl p-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary h-24 text-sm resize-none"
                        placeholder="e.g. Extra hot, no foam..."
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                    ></textarea>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex bg-background overflow-hidden">
                {/* LIFT SIDE: PRODUCT GRID */}
            <div className="flex-1 flex flex-col h-full bg-surface rounded-tr-3xl">
                <div className="p-6 pb-0 tracking-tight shrink-0">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-black text-textMain">New Order</h1>
                        <div className="relative w-64">
                            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-textMuted w-5 h-5" />
                            <input 
                                type="text"
                                placeholder="Search products..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-background text-textMain rounded-full py-3 pl-12 pr-4 border border-slate-200 dark:border-white/10 dark:border-white/5 focus:border-primary focus:ring-1 focus:ring-primary transition-colors focus:outline-none placeholder-textMuted"
                            />
                        </div>
                    </div>

                    <div className="flex space-x-3 overflow-x-auto pb-4 custom-scrollbar hide-scrollbar">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-6 py-3 rounded-full font-bold whitespace-nowrap transition-all ${
                                    activeCategory === cat 
                                    ? 'bg-primary text-gray-900 shadow-lg shadow-primary/30 scale-105' 
                                    : 'bg-background text-textMuted border border-slate-200 dark:border-white/10 dark:border-white/5 hover:border-slate-400 dark:hover:border-white/20'
                                }`}
                            >
                                {cat === 'all' ? 'All Items' : cat.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-textMuted animate-pulse">Loading menu...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 content-start">
                            {filteredProducts.map(product => (
                                <button
                                    key={product.id}
                                    onClick={() => handleProductClick(product)}
                                    className="bg-background border border-slate-200 dark:border-white/10 dark:border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center hover:bg-slate-50 dark:hover:bg-white/5 dark:hover:bg-[#16213e] hover:border-primary/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] transition-all group relative overflow-hidden h-40"
                                >
                                    {/* Indicators for Combos and Options */}
                                    <div className="absolute top-3 right-3 flex space-x-1">
                                        {product.is_popular && <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></span>}
                                        {product.combo_items?.length > 0 && <span className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_5px_rgba(168,85,247,0.5)]"></span>}
                                    </div>

                                    {product.image ? (
                                        <img src={product.image} alt={product.name} className="w-14 h-14 rounded-full object-cover mb-3 group-hover:scale-110 transition-transform opacity-90 border border-slate-200 dark:border-white/10" />
                                    ) : (
                                        <div className="w-12 h-12 bg-slate-100 dark:bg-white/5 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                            {product.combo_items?.length > 0 ? (
                                                <FiLayers className="w-6 h-6 text-purple-400" />
                                            ) : (
                                                <FiCoffee className="w-6 h-6 text-primary/70 group-hover:text-primary" />
                                            )}
                                        </div>
                                    )}

                                    <h3 className="font-bold text-textMain mb-1 line-clamp-2 leading-tight text-sm">{product.name}</h3>
                                    
                                    <div className="mt-auto pt-2 w-full flex items-center justify-center space-x-2">
                                        {product.variations?.length > 0 ? (
                                            <p className="font-mono text-primary text-xs font-bold border border-primary/20 px-2 py-0.5 rounded-full">
                                                from {settings?.currency || '$'}{Math.min(...product.variations.map(v => v.price))}
                                            </p>
                                        ) : (
                                            <p className="font-mono text-green-400 font-bold text-sm">
                                                {settings?.currency || '$'}{product.price}
                                            </p>
                                        )}
                                    </div>
                                    
                                </button>
                            ))}
                            {filteredProducts.length === 0 && (
                                <div className="col-span-full py-20 text-center text-textMuted">
                                    No products found matching your search.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT SIDE: CART PANEL */}
            <div className="w-96 bg-background h-full flex flex-col border-l border-slate-200 dark:border-white/10 dark:border-white/5 shadow-[-10px_0_30px_rgba(0,0,0,0.1)] dark:shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10 shrink-0">
                <div className="p-6 border-b border-slate-200 dark:border-white/10 flex items-center justify-between shrink-0">
                    <h2 className="text-xl font-black text-textMain flex items-center">
                        <FiShoppingCart className="mr-3 text-primary" /> Current Order
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={() => { fetchDraftOrders(); setShowDraftsModal(true); }} className="text-xs font-bold text-amber-400 hover:text-amber-300 bg-amber-400/10 px-3 py-1.5 rounded-md transition-colors flex items-center">
                           <FiClock className="mr-1" /> Open Tables
                        </button>
                        <button onClick={() => { setCart([]); setActiveOrderId(null); setActiveOrderTotal(0); setPointsToRedeem(''); }} className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-400/10 px-3 py-1.5 rounded-md transition-colors">Clear</button>
                    </div>
                </div>

                {activeOrderId ? (
                    <div className="px-6 py-3 bg-amber-500/20 text-amber-400 text-sm font-bold flex justify-between items-center border-b border-white/5 shrink-0">
                        <span className="flex items-center gap-2"><FiClock className="animate-pulse" /> Paying Open Order</span>
                        <span className="font-mono bg-amber-500/20 px-2 rounded">#{activeOrderId.split('-')[0]}</span>
                    </div>
                ) : (
                    <div className="px-6 py-4 flex space-x-2 border-b border-white/5 bg-white/5 shrink-0">
                        {['dine_in', 'takeaway', 'delivery'].map(type => (
                            <button
                                key={type}
                                onClick={() => {
                                    setOrderType(type);
                                    if (type !== 'dine_in') setSelectedTable(null);
                                }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                                    orderType === type 
                                    ? 'bg-primary text-white shadow-md' 
                                    : 'bg-surface text-textMuted hover:bg-surface border border-slate-200 dark:border-white/10'
                                }`}
                            >
                                {type.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                )}
                
                {!activeOrderId && orderType === 'dine_in' && (
                    <div className="px-6 py-3 border-b border-white/5 bg-yellow-500/5 shrink-0">
                        <select 
                            value={selectedTable || ''} 
                            onChange={(e) => setSelectedTable(e.target.value)}
                            className="w-full bg-surface text-textMain border border-yellow-500/30 rounded-lg p-2 focus:outline-none focus:border-yellow-500 text-sm font-bold"
                        >
                            <option value="">-- Select Table --</option>
                            {tables.filter(t => t.status === 'available').map(t => (
                                <option key={t.id} value={t.id}>Table {t.number} ({t.capacity} seats)</option>
                            ))}
                        </select>
                    </div>
                )}
                
                {/* Customer CRM Attachment Block */}
                <div className="px-6 py-3 border-b border-white/5 bg-surface/50 shrink-0">
                    {!attachedCustomer ? (
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                placeholder="Customer Phone (e.g. 010...)"
                                value={customerPhone}
                                onChange={(e) => setCustomerPhone(e.target.value)}
                                className="flex-1 bg-background text-textMain border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary text-xs"
                            />
                            <button 
                                onClick={handleSearchCustomer}
                                disabled={isSearchingCustomer || !customerPhone}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold w-[70px] rounded-lg flex justify-center items-center"
                            >
                                {isSearchingCustomer ? '...' : 'Search'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs text-white">
                                <div className="flex items-center gap-2">
                                    <FiUserCheck className="text-green-400" />
                                    <span className="font-bold">{attachedCustomer.first_name}</span>
                                </div>
                                <button onClick={() => { setAttachedCustomer(null); setPointsToRedeem(''); }} className="text-red-400 hover:text-red-300">
                                    Remove
                                </button>
                            </div>
                            
                            {/* Loyalty Points display */}
                            {attachedCustomer.loyalty_account && (
                                <div className="bg-[#0f172a] rounded-lg p-2 border border-white/5 flex flex-col gap-2">
                                    <div className="flex justify-between text-xs items-center">
                                        <span className="text-textMuted flex items-center gap-1"><FiGift /> Points:</span>
                                        <strong className="text-yellow-400">{attachedCustomer.loyalty_account.points_balance} pts</strong>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            placeholder="Redeem points?" 
                                            value={pointsToRedeem}
                                            onChange={(e) => setPointsToRedeem(e.target.value)}
                                            max={attachedCustomer.loyalty_account.points_balance}
                                            className="w-full bg-[#1e293b] text-white border border-white/10 rounded px-2 py-1 flex-1 text-xs focus:outline-none focus:border-yellow-500"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3">
                    {cart.map((item, index) => (
                        <div key={item.id} className="bg-surface/50 border border-slate-200 dark:border-white/10 dark:border-white/5 rounded-xl p-3 flex group relative overflow-hidden transition-colors hover:bg-surface">
                            <div className="flex-1 pr-4">
                                <div className="flex items-center space-x-2">
                                    <h4 className="font-bold text-textMain text-sm leading-snug">{item.product.name}</h4>
                                    {item.variation && (
                                        <span className="bg-primary/20 text-primary text-[10px] px-1.5 py-0.5 rounded font-bold uppercase">{item.variation.size_name}</span>
                                    )}
                                </div>
                                
                                <div className="space-y-0.5 mt-1">
                                    {item.product.combo_items?.map(ci => (
                                        <p key={ci.id} className="text-[10px] text-purple-400 italic block">✦ {ci.quantity}x {ci.child_product_name}</p>
                                    ))}
                                    {item.modifiersObjects?.map(m => (
                                        <p key={m.id} className="text-[10px] text-textMuted block">+ {m.name}</p>
                                    ))}
                                    {item.special_instructions && (
                                        <p className="text-[10px] text-yellow-500/70 italic block">"{item.special_instructions}"</p>
                                    )}
                                </div>
                                
                                <p className="font-mono text-green-400 text-xs font-bold mt-1.5">{settings?.currency || '$'}{item.unit_price.toFixed(2)}</p>
                            </div>
                            <div className="flex flex-col items-center justify-between border-l border-slate-200 dark:border-white/10 dark:border-white/5 pl-3">
                                <button onClick={() => updateCartQuantity(index, 1)} className="w-7 h-7 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-md flex items-center justify-center text-textMain transition-colors">
                                    <FiPlus className="w-3 h-3" />
                                </button>
                                <span className="font-black text-textMain text-sm">{item.quantity}</span>
                                <button onClick={() => updateCartQuantity(index, -1)} className="w-7 h-7 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 hover:text-red-400 rounded-md flex items-center justify-center text-textMain transition-colors">
                                    <FiMinus className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    ))}
                    
                    {cart.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-textMuted space-y-4 opacity-50">
                            <FiShoppingCart className="w-16 h-16" />
                            <p>No items in cart</p>
                        </div>
                    )}
                </div>

                <div className="bg-surface border-t border-slate-200 dark:border-white/10 p-6 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.3)] z-20 shrink-0">
                    <div className="space-y-2 mb-4 text-sm">
                        <div className="flex justify-between text-textMuted">
                            <span>Subtotal</span>
                            <span className="font-mono">{settings?.currency || '$'}{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-textMuted">
                            <span>{settings?.tax_label || 'Tax'} ({settings?.tax_rate || 14}%{isTaxInclusive ? ' Incl' : ''})</span>
                            <span className="font-mono">{settings?.currency || '$'}{estimatedTax.toFixed(2)}</span>
                        </div>
                        {orderType === 'dine_in' && (
                           <div className="flex justify-between text-textMuted">
                               <span>Service ({settings?.service_charge_rate || 12}%)</span>
                               <span className="font-mono">{settings?.currency || '$'}{serviceCharge.toFixed(2)}</span>
                           </div>
                        )}
                        {loyaltyDiscount > 0 && (
                            <div className="flex justify-between text-green-400">
                                <span>Points Discount</span>
                                <span className="font-mono">-{settings?.currency || '$'}{loyaltyDiscount.toFixed(2)}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-textMain font-black text-xl pt-2 border-t border-slate-200 dark:border-white/10">
                            <span>Total</span>
                            <span className="text-primary font-mono">{settings?.currency || '$'}{total.toFixed(2)}</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2">
                        {(!activeOrderId) && (
                            <button 
                                onClick={handleSendToKitchen}
                                disabled={cart.length === 0 || orderType !== 'dine_in' || (orderType === 'dine_in' && !selectedTable)}
                                className="w-1/3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-textMain font-bold py-4 rounded-xl shadow-lg border border-slate-200 dark:border-white/10 flex flex-col items-center justify-center space-y-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <FiClock className="w-5 h-5 text-amber-400" />
                                <span className="text-xs">Hold Order</span>
                            </button>
                        )}
                        
                        <button 
                            onClick={handleCheckout}
                            disabled={(cart.length === 0 && !activeOrderId) || (orderType === 'dine_in' && !selectedTable && !activeOrderId)}
                            className={`${activeOrderId ? 'w-full' : 'w-2/3'} bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-lg py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all transform active:scale-[0.98] flex items-center justify-center space-x-2`}
                        >
                            <FiCheck className="w-6 h-6" />
                            <span>Checkout / Pay</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* MODIFIER MODAL */}
            {modifierModalOpen && selectedProductForMod && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModifierModalOpen(false)}></div>
                    <div className="relative bg-surface w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
                        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-background rounded-t-2xl shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-textMain">Customize Order</h3>
                                <p className="text-primary font-bold mt-1 text-sm">{selectedProductForMod.name}</p>
                            </div>
                            <button onClick={() => setModifierModalOpen(false)} className="text-textMuted hover:text-textMain bg-slate-200 dark:bg-white/5 p-2 rounded-lg transition-colors"><FiX /></button>
                        </div>
                        
                        {renderModifierContent()}
                        
                        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-background rounded-b-2xl shrink-0">
                            <button 
                                onClick={() => addToCart(selectedProductForMod, selectedVariation, currentModifiers, specialInstructions)}
                                className="w-full bg-primary hover:bg-primary/90 text-white font-black py-4 rounded-xl shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all"
                            >
                                Add to Order - {settings?.currency || '$'}{(() => {
                                    let modPrice = currentModifiers.reduce((sum, modId) => {
                                        let price = 0;
                                        selectedProductForMod.modifier_groups?.forEach(g => {
                                            const mod = g.modifiers.find(m => m.id === modId);
                                            if (mod) price = parseFloat(mod.extra_price || 0);
                                        });
                                        return sum + price;
                                    }, 0);
                                    let base = selectedVariation ? parseFloat(selectedVariation.price) : parseFloat(selectedProductForMod.price);
                                    let comboEx = (selectedProductForMod.combo_items||[]).reduce((s, c) => s + parseFloat(c.extra_price||0), 0);
                                    return (base + modPrice + comboEx).toFixed(2);
                                })()}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* CHECKOUT MODAL */}
            {checkoutModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setCheckoutModalOpen(false)}></div>
                    <div className="relative bg-surface w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up overflow-hidden">
                        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-background shrink-0">
                            <div>
                                <h3 className="text-2xl font-black text-textMain flex items-center gap-2">
                                    <FiCreditCard className="text-primary" /> Checkout
                                </h3>
                                <p className="text-textMuted mt-1">Balance Due: <span className="text-primary font-mono font-bold">{settings?.currency || '$'}{total.toFixed(2)}</span></p>
                            </div>
                            <button onClick={() => setCheckoutModalOpen(false)} className="text-textMuted hover:text-textMain bg-slate-200 dark:bg-white/5 p-2 rounded-lg transition-colors"><FiX className="w-6 h-6" /></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            
                            {/* Outstanding Balance Banner */}
                            <div className={`p-4 rounded-xl border flex justify-between items-center ${remainingBalance > 0 ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                                <span className={`font-bold ${remainingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>Remaining Balance</span>
                                <span className={`text-2xl font-black font-mono ${remainingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                    {settings?.currency || '$'}{remainingBalance.toFixed(2)}
                                </span>
                            </div>

                            {/* Add Payment Form */}
                            {remainingBalance > 0 && (
                                <div className="bg-background p-4 rounded-xl border border-slate-200 dark:border-white/10 dark:border-white/5 space-y-4">
                                    <h4 className="text-textMain font-bold mb-2 text-sm">Add Payment</h4>
                                    
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                        {[
                                            { id: 'cash', label: 'Cash', color: 'bg-green-600' },
                                            { id: 'card', label: 'Card', color: 'bg-blue-600' },
                                            { id: 'fawry', label: 'Fawry', color: 'bg-yellow-600' },
                                            { id: 'instapay', label: 'InstaPay', color: 'bg-purple-600' },
                                            { id: 'vodafone_cash', label: 'VF Cash', color: 'bg-red-600' },
                                            { id: 'tab', label: 'Customer Tab', color: 'bg-slate-600' },
                                        ].map(pm => (
                                            <button
                                                key={pm.id}
                                                onClick={() => setSelectedPaymentMethod(pm.id)}
                                                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                                                    selectedPaymentMethod === pm.id 
                                                    ? `${pm.color} text-white shadow-lg` 
                                                    : 'bg-surface text-textMuted hover:bg-slate-200 dark:hover:bg-[#1e293b]/70 border border-slate-200 dark:border-white/10 dark:border-white/5'
                                                }`}
                                            >
                                                {pm.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 items-end pt-2">
                                        <div className="flex-1">
                                            <label className="block text-xs text-textMuted mb-1">Amount ({settings?.currency || '$'})</label>
                                            <input 
                                                type="number"
                                                value={paymentAmountInput}
                                                onChange={(e) => setPaymentAmountInput(e.target.value)}
                                                max={remainingBalance}
                                                className="w-full bg-surface text-textMain border border-slate-200 dark:border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-primary font-mono text-lg"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleAddPayment}
                                            disabled={!paymentAmountInput || parseFloat(paymentAmountInput) <= 0}
                                            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center"
                                        >
                                            <FiPlus className="mr-2" /> Add
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Captured Payments List */}
                            {payments.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-textMain font-bold text-sm">Tendered Payments</h4>
                                    <div className="space-y-2">
                                        {payments.map((p, index) => (
                                            <div key={index} className="flex justify-between items-center bg-surface p-3 rounded-lg border border-slate-200 dark:border-white/10 dark:border-white/5">
                                                <div className="flex items-center gap-3">
                                                    <span className="w-8 h-8 rounded-full bg-slate-200 dark:bg-white/5 flex items-center justify-center text-textMuted text-xs font-bold uppercase">
                                                        {p.method.substring(0, 2)}
                                                    </span>
                                                    <div>
                                                        <p className="text-textMain font-bold capitalize text-sm">{p.method.replace('_', ' ')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-green-400 font-mono font-bold">
                                                        {settings?.currency || '$'}{p.amount.toFixed(2)}
                                                    </span>
                                                    <button onClick={() => handleRemovePayment(index)} className="text-red-400 hover:text-red-300 p-1">
                                                        <FiTrash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                        </div>
                        
                        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-background shrink-0 flex gap-4">
                            <button 
                                onClick={() => submitOrder(false)}
                                disabled={remainingBalance > 0.01}
                                className={`w-1/2 font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 ${
                                    remainingBalance <= 0.01 
                                    ? 'bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-textMain shadow-inner' 
                                    : 'bg-slate-200 dark:bg-white/5 text-textMuted dark:text-white/30 cursor-not-allowed'
                                }`}
                            >
                                <FiCheck className="w-5 h-5" />
                                <span>Save Only</span>
                            </button>
                            
                            <button 
                                onClick={() => submitOrder(true)}
                                disabled={remainingBalance > 0.01}
                                className={`w-1/2 font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center space-x-2 ${
                                    remainingBalance <= 0.01 
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
                                    : 'bg-slate-200 dark:bg-white/5 text-textMuted dark:text-white/30 cursor-not-allowed'
                                }`}
                            >
                                <FiCheck className="w-6 h-6" />
                                <span>Save & Print Receipt</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK ADD CUSTOMER MODAL */}
            {showAddCustomerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddCustomerModal(false)}></div>
                    <div className="relative bg-surface w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
                        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-background rounded-t-2xl shrink-0">
                            <h3 className="text-xl font-black text-textMain flex items-center gap-2">
                                <FiUserCheck className="text-blue-400" /> New Customer
                            </h3>
                            <button onClick={() => setShowAddCustomerModal(false)} className="text-textMuted hover:text-textMain bg-slate-200 dark:bg-white/5 p-2 rounded-lg transition-colors"><FiX /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-textMuted mb-1">Phone Number *</label>
                                <input 
                                    type="text"
                                    value={newCustomerData.phone}
                                    onChange={(e) => setNewCustomerData({...newCustomerData, phone: e.target.value})}
                                    className="w-full bg-background border border-slate-200 dark:border-white/10 text-textMain rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-textMuted mb-1">First Name *</label>
                                <input 
                                    type="text"
                                    value={newCustomerData.first_name}
                                    onChange={(e) => setNewCustomerData({...newCustomerData, first_name: e.target.value})}
                                    className="w-full bg-background border border-slate-200 dark:border-white/10 text-textMain rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-textMuted mb-1">Last Name</label>
                                <input 
                                    type="text"
                                    value={newCustomerData.last_name}
                                    onChange={(e) => setNewCustomerData({...newCustomerData, last_name: e.target.value})}
                                    className="w-full bg-background border border-slate-200 dark:border-white/10 text-textMain rounded-lg px-4 py-3 focus:outline-none focus:border-blue-500"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-slate-200 dark:border-white/10 bg-background rounded-b-2xl">
                            <button 
                                onClick={handleCreateCustomer}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg"
                            >
                                Quick Add & Attach
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* OPEN TABLES / DRAFTS MODAL */}
            {showDraftsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDraftsModal(false)}></div>
                    <div className="relative bg-surface w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] animate-fade-in-up">
                        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center bg-background rounded-t-2xl shrink-0">
                            <h3 className="text-xl font-black text-textMain flex items-center gap-2">
                                <FiClock className="text-amber-400" /> Open Tables & Drafts
                            </h3>
                            <button onClick={() => setShowDraftsModal(false)} className="text-textMuted hover:text-textMain bg-slate-200 dark:bg-white/5 p-2 rounded-lg transition-colors"><FiX /></button>
                        </div>
                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-background">
                            {draftOrders.length === 0 ? (
                                <div className="text-center text-textMuted py-10">No open orders found.</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                    {draftOrders.map(order => (
                                        <div key={order.id} className="bg-surface rounded-xl border border-slate-200 dark:border-white/10 dark:border-white/5 p-5 hover:border-amber-400/50 transition-colors flex flex-col h-full relative overflow-hidden">
                                            <div className="absolute top-0 left-0 w-1 h-full bg-amber-500"></div>
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="font-bold text-textMain text-lg">
                                                        {order.table ? `Table ${order.table_number}` : `Draft #${order.id.split('-')[0]}`}
                                                    </h4>
                                                    <span className="text-xs text-textMuted capitalize">{order.order_type.replace('_', ' ')}</span>
                                                </div>
                                                <span className="font-mono text-primary font-bold bg-primary/10 px-2 py-1 rounded text-sm">
                                                    {settings?.currency || '$'}{parseFloat(order.total_amount).toFixed(2)}
                                                </span>
                                            </div>
                                            
                                            {order.customer_name && (
                                                <div className="text-xs text-textMuted mb-3 flex items-center gap-1">
                                                    <FiUserCheck /> {order.customer_name} ({order.customer_phone})
                                                </div>
                                            )}
                                            
                                            <div className="text-xs text-textMuted flex-grow space-y-1 mb-4">
                                                {order.items?.slice(0, 3).map(item => (
                                                    <p key={item.id} className="truncate">
                                                        <span className="text-textMuted/70">{item.quantity}x</span> {item.product_name || 'Product'} {item.variation_name ? `(${item.variation_name})`:''}
                                                    </p>
                                                ))}
                                                {order.items?.length > 3 && (
                                                    <p className="italic text-textMuted/50">+ {order.items.length - 3} more items...</p>
                                                )}
                                            </div>
                                            
                                            <div className="mt-auto pt-4 border-t border-slate-200 dark:border-white/10 dark:border-white/5 flex gap-2">
                                                {/* Edit Draft — loads items back into POS cart for full editing */}
                                                <button
                                                    onClick={() => loadDraftForEditing(order)}
                                                    className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                                    title="Load items into cart for editing"
                                                >
                                                    <FiEdit2 className="w-3.5 h-3.5" /> Edit Draft
                                                </button>
                                                {/* Checkout & Pay — jumps straight to payment using stored total */}
                                                <button
                                                    onClick={() => loadDraftOrder(order)}
                                                    className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-bold text-sm py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <FiCheck /> Pay
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default POSDashboard;

