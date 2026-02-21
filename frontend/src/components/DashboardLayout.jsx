import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import { 
  FiHome, FiSettings, FiUserPlus, FiLogOut, 
  FiMenu, FiX, FiUser, FiCoffee, FiUsers, FiGift,
  FiBox, FiShoppingCart, FiChevronDown, FiChevronRight,
  FiClipboard, FiTruck, FiList, FiTrash2, FiBookOpen, FiInbox, FiDollarSign, FiRepeat, FiLayers, FiClock, FiFolder, FiSun, FiMoon, FiShoppingBag, FiFileText, FiTrendingUp, FiBriefcase, FiCheckSquare, FiPieChart
} from 'react-icons/fi';

const DashboardLayout = () => {
  const { user, logout, updateTheme } = useAuthStore();
  const { settings, fetchSettings } = useSettingsStore();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const isAdminOrManager = ['manager', 'super_admin'].includes(user?.role);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Theme Logic
  const toggleTheme = async () => {
    const isDark = user?.theme_preference === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    await updateTheme(newTheme);
  };

  useEffect(() => {
    // Apply class to HTML element based on user preference
    const root = document.documentElement;
    if (user?.theme_preference === 'light') {
      root.classList.remove('dark');
    } else {
      root.classList.add('dark'); // 'dark' and 'system' both default to dark here for simplicity unless system explicitly means OS preference
    }
  }, [user?.theme_preference]);

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [purchasingOpen, setPurchasingOpen] = useState(false);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Auto-expand menus if child route is active
  useEffect(() => {
    if (window.location.pathname.includes('/inventory')) setInventoryOpen(true);
    if (window.location.pathname.includes('/purchasing')) setPurchasingOpen(true);
    if (window.location.pathname.includes('/finance')) setFinanceOpen(true);
    if (window.location.pathname.includes('/settings') || window.location.pathname.includes('/register')) setAdminOpen(true);
  }, []);

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: FiHome, show: true },
    { name: 'Point of Sale (POS)', path: '/pos', icon: FiCoffee, show: true },
    { name: 'Floor Plan (Tables)', path: '/pos/floor-plan', icon: FiLayers, show: true },
    { name: 'Kitchen Display (KDS)', path: '/pos/kds', icon: FiClock, show: true },
    { name: 'Orders History', path: '/orders', icon: FiShoppingBag, show: true },
    {
      name: 'Inventory Mgt', icon: FiBox, show: isAdminOrManager,
      isOpen: inventoryOpen, setIsOpen: setInventoryOpen,
      subLinks: [
        { name: 'Dashboard', path: '/inventory', icon: FiHome },
        { name: 'Raw Materials', path: '/inventory/materials', icon: FiList },
        { name: 'Measurement Units', path: '/inventory/units', icon: FiBox },
        { name: 'Unit Conversions', path: '/inventory/conversions', icon: FiRepeat },
        { name: 'Menu Categories', path: '/inventory/categories', icon: FiFolder },
        { name: 'Products (Menu)', path: '/inventory/products', icon: FiCoffee },
        { name: 'Recipes', path: '/inventory/recipes', icon: FiBookOpen },
        { name: 'Physical Counts', path: '/inventory/counts', icon: FiClipboard },
        { name: 'Waste Logs', path: '/inventory/waste', icon: FiTrash2 },
      ]
    },
    {
      name: 'Purchasing', icon: FiShoppingCart, show: isAdminOrManager,
      isOpen: purchasingOpen, setIsOpen: setPurchasingOpen,
      subLinks: [
        { name: 'Dashboard', path: '/purchasing', icon: FiHome },
        { name: 'Suppliers', path: '/purchasing/suppliers', icon: FiTruck },
        { name: 'Purchase Orders', path: '/purchasing/orders', icon: FiClipboard },
        { name: 'Receive GRNs', path: '/purchasing/grns', icon: FiInbox },
        { name: 'Invoices', path: '/purchasing/invoices', icon: FiDollarSign },
      ]
    },
    {
      name: 'Finance & Accounts', icon: FiDollarSign, show: true,
      isOpen: financeOpen, setIsOpen: setFinanceOpen,
      subLinks: [
        { name: 'Cash Register', path: '/finance/cash-register', icon: FiDollarSign },
        { name: 'Sales Journal', path: '/finance/sales-journal', icon: FiFileText, hideFromCashier: true },
        { name: 'Expenses', path: '/finance/expenses', icon: FiTrendingUp, hideFromCashier: true },
        { name: 'Petty Cash', path: '/finance/petty-cash', icon: FiBriefcase },
        { name: 'Corp. Invoices', path: '/finance/corporate-invoices', icon: FiFileText, hideFromCashier: true },
        { name: 'Bank Recon.', path: '/finance/bank-reconciliation', icon: FiCheckSquare, hideFromCashier: true },
        { name: 'Fin. Reports', path: '/finance/reports', icon: FiPieChart, hideFromCashier: true },
        { name: 'EOD Review', path: '/finance/end-of-day', icon: FiClock, hideFromCashier: true }
      ].filter(link => !link.hideFromCashier || isAdminOrManager)
    },
    { name: 'Customer CRM', path: '/customers', icon: FiUsers, show: true },
    { name: 'Promotions Engine', path: '/promotions', icon: FiGift, show: isAdminOrManager },
    {
      name: 'Administration', icon: FiSettings, show: isAdminOrManager,
      isOpen: adminOpen, setIsOpen: setAdminOpen,
      subLinks: [
        { name: 'User Management', path: '/settings/users', icon: FiUsers },
        { name: 'Register Staff', path: '/register', icon: FiUserPlus },
        { name: 'Global Settings', path: '/settings', icon: FiSettings },
      ]
    },
  ];

  return (
    <div className="min-h-screen bg-background text-textMain flex overflow-hidden">
      
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-30 w-64 glass-panel transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 rounded-none border-y-0 border-l-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-full flex flex-col pt-6 pb-4">
          <div className="px-6 pb-6 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3 overflow-hidden">
                {settings?.logo_base64 ? (
                    <img src={settings.logo_base64} alt="Brand Logo" className="w-8 h-8 object-contain shrink-0" />
                ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                        <FiCoffee className="w-5 h-5 text-primary" />
                    </div>
                )}
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent truncate">
                  {settings?.brand_name || 'Cafe System'}
                </h1>
            </div>
            <button className="lg:hidden text-textMuted" onClick={() => setSidebarOpen(false)}>
               <FiX className="w-6 h-6" />
            </button>
          </div>
          
          <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
            {navLinks.filter(link => link.show).map((link) => {
              const Icon = link.icon;
              
              if (link.subLinks) {
                return (
                  <div key={link.name} className="space-y-1">
                    <button
                      onClick={() => link.setIsOpen(!link.isOpen)}
                      className={`
                        w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors text-sm
                        ${link.isOpen ? 'text-white font-semibold block' : 'text-textMuted hover:text-white hover:bg-white/5'}
                      `}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className="w-5 h-5" />
                        <span>{link.name}</span>
                      </div>
                      {link.isOpen ? <FiChevronDown className="w-4 h-4" /> : <FiChevronRight className="w-4 h-4" />}
                    </button>
                    
                    {link.isOpen && (
                      <div className="pl-10 pr-3 py-1 space-y-1">
                        {link.subLinks.map(sub => (
                          <NavLink
                            key={sub.name}
                            to={sub.path}
                            end={sub.path === '/inventory'}
                            onClick={() => setSidebarOpen(false)}
                            className={({ isActive }) => `
                              flex items-center space-x-3 px-3 py-2 rounded-md transition-colors text-sm
                              ${isActive 
                                ? 'bg-primary/20 text-primary font-medium' 
                                : 'text-textMuted hover:text-white hover:bg-white/5'
                              }
                            `}
                          >
                            <sub.icon className="w-4 h-4" />
                            <span>{sub.name}</span>
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <NavLink
                  key={link.name}
                  to={link.path}
                  end={link.path === '/'}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) => `
                    flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium
                    ${isActive 
                      ? 'bg-primary/20 text-primary' 
                      : 'hover:bg-white/5 text-textMuted hover:text-white'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.name}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col w-full min-w-0">
        
        {/* Header */}
        <header className="h-16 glass-panel rounded-none border-x-0 border-t-0 flex items-center justify-between px-4 sm:px-6 relative z-10 w-full overflow-visible">
          <div className="flex items-center">
            <button 
              className="lg:hidden p-2 text-textMuted hover:text-white transition-colors"
              onClick={() => setSidebarOpen(true)}
            >
              <FiMenu className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
             {/* Theme Toggle Button */}
             <button
               onClick={toggleTheme}
               className="p-2 rounded-full text-textMuted hover:text-white hover:bg-white/5 transition-colors focus:outline-none"
               title="Toggle Dark/Light Mode"
             >
               {user?.theme_preference === 'light' ? <FiMoon className="w-5 h-5" /> : <FiSun className="w-5 h-5" />}
             </button>

             <div className="relative">
                <button 
                   className="flex items-center space-x-3 p-1 rounded-full hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
                   onClick={() => setProfileOpen(!profileOpen)}
                >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/50 overflow-hidden">
                        {user?.avatar ? (
                            <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <FiUser className="text-primary w-4 h-4" />
                        )}
                    </div>
                    <span className="hidden sm:block font-medium text-sm text-textMuted">
                        {user?.name || user?.username}
                    </span>
                </button>
                
                {/* Profile Dropdown */}
                {profileOpen && (
                    <div className="absolute right-0 mt-2 w-48 glass-panel py-2 shadow-2xl animate-fade-in z-50">
                        <div className="px-4 py-2 border-b border-white/5 mb-2">
                           <p className="text-sm font-semibold truncate">{user?.name}</p>
                           <p className="text-xs text-textMuted capitalize">{user?.role?.replace('_', ' ')}</p>
                        </div>
                        <button 
                            className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 transition-colors flex items-center space-x-2 text-textMuted hover:text-white"
                            onClick={() => { setProfileOpen(false); navigate('/profile'); }}
                        >
                            <FiUser className="w-4 h-4" />
                            <span>My Profile</span>
                        </button>
                        <button 
                            className="w-full text-left px-4 py-2 text-sm hover:bg-danger/20 transition-colors flex items-center space-x-2 text-danger"
                            onClick={handleLogout}
                        >
                            <FiLogOut className="w-4 h-4" />
                            <span>Sign Out</span>
                        </button>
                    </div>
                )}
             </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto w-full p-4 sm:p-6 lg:p-8 relative">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
