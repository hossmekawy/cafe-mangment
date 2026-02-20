import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import useSettingsStore from '../store/settingsStore';
import { 
  FiHome, FiSettings, FiUserPlus, FiLogOut, 
  FiMenu, FiX, FiUser, FiCoffee,
  FiBox, FiShoppingCart, FiChevronDown, FiChevronRight,
  FiClipboard, FiTruck, FiList
} from 'react-icons/fi';

const DashboardLayout = () => {
  const { user, logout } = useAuthStore();
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

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [purchasingOpen, setPurchasingOpen] = useState(false);

  // Auto-expand menus if child route is active
  useEffect(() => {
    if (window.location.pathname.includes('/inventory')) setInventoryOpen(true);
    if (window.location.pathname.includes('/purchasing')) setPurchasingOpen(true);
  }, []);

  const navLinks = [
    { name: 'Dashboard', path: '/', icon: FiHome, show: true },
    { 
      name: 'Inventory', 
      icon: FiBox, 
      show: isAdminOrManager,
      isOpen: inventoryOpen,
      setIsOpen: setInventoryOpen,
      subLinks: [
        { name: 'Overview', path: '/inventory', icon: FiMenu },
        { name: 'Raw Materials', path: '/inventory/materials', icon: FiList },
      ]
    },
    { 
      name: 'Purchasing', 
      icon: FiShoppingCart, 
      show: isAdminOrManager,
      isOpen: purchasingOpen,
      setIsOpen: setPurchasingOpen,
      subLinks: [
        { name: 'Suppliers', path: '/purchasing/suppliers', icon: FiTruck },
        { name: 'Purchase Orders', path: '/purchasing/orders', icon: FiClipboard },
      ]
    },
    { name: 'Register Staff', path: '/register', icon: FiUserPlus, show: isAdminOrManager },
    { name: 'Global Settings', path: '/settings', icon: FiSettings, show: isAdminOrManager },
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
