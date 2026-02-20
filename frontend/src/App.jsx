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
import Suppliers from './pages/purchasing/Suppliers';
import PurchaseOrders from './pages/purchasing/PurchaseOrders';
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
              <Route path="/purchasing/suppliers" element={<Suppliers />} />
              <Route path="/purchasing/orders" element={<PurchaseOrders />} />
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
