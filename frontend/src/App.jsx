import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './components/DashboardLayout';
import RegisterStaff from './pages/RegisterStaff';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import RawMaterials from './pages/inventory/RawMaterials';
import Units from './pages/inventory/Units';
import UnitConversions from './pages/inventory/UnitConversions';
import Products from './pages/inventory/Products';
import Recipes from './pages/inventory/Recipes';
import PhysicalCounts from './pages/inventory/PhysicalCounts';
import WasteLogs from './pages/inventory/WasteLogs';
import Suppliers from './pages/purchasing/Suppliers';
import PurchasingDashboard from './pages/purchasing/PurchasingDashboard';
import PurchaseOrders from './pages/purchasing/PurchaseOrders';
import GoodsReceivedNotes from './pages/purchasing/GoodsReceivedNotes';
import Invoices from './pages/purchasing/Invoices';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <BrowserRouter>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: 'glass-panel text-sm font-medium border border-white/10',
          style: {
            background: 'rgba(15, 23, 42, 0.8)',
            color: '#fff',
            backdropFilter: 'blur(12px)',
          },
          success: {
            iconTheme: { primary: '#10B981', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#EF4444', secondary: '#fff' },
          },
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes (Authenticated any role) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            
            {/* Protected Routes (Manager & Super Admin only) */}
            <Route element={<ProtectedRoute allowedRoles={['manager', 'super_admin']} />}>
              <Route path="/settings" element={<Settings />} />
              <Route path="/register" element={<RegisterStaff />} />
              
              {/* Inventory & Purchasing */}
              <Route path="/inventory" element={<InventoryDashboard />} />
              <Route path="/inventory/materials" element={<RawMaterials />} />
              <Route path="/inventory/units" element={<Units />} />
              <Route path="/inventory/conversions" element={<UnitConversions />} />
              <Route path="/inventory/products" element={<Products />} />
              <Route path="/inventory/recipes" element={<Recipes />} />
              <Route path="/inventory/counts" element={<PhysicalCounts />} />
              <Route path="/inventory/waste" element={<WasteLogs />} />
              <Route path="/purchasing" element={<PurchasingDashboard />} />
              <Route path="/purchasing/suppliers" element={<Suppliers />} />
              <Route path="/purchasing/orders" element={<PurchaseOrders />} />
              <Route path="/purchasing/grns" element={<GoodsReceivedNotes />} />
              <Route path="/purchasing/invoices" element={<Invoices />} />
            </Route>
          </Route>
        </Route>



        {/* Catch-all route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
