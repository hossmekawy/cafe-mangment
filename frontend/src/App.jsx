import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DashboardLayout from './components/DashboardLayout';
import RegisterStaff from './pages/RegisterStaff';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import UserManagement from './pages/settings/UserManagement';
import BranchManagement from './pages/settings/BranchManagement';
import InventoryDashboard from './pages/inventory/InventoryDashboard';
import RawMaterials from './pages/inventory/RawMaterials';
import Units from './pages/inventory/Units';
import UnitConversions from './pages/inventory/UnitConversions';
import Categories from './pages/inventory/Categories';
import Products from './pages/inventory/Products';
import Recipes from './pages/inventory/Recipes';
import PhysicalCounts from './pages/inventory/PhysicalCounts';
import WasteLogs from './pages/inventory/WasteLogs';
import Suppliers from './pages/purchasing/Suppliers';
import PurchasingDashboard from './pages/purchasing/PurchasingDashboard';
import PurchaseOrders from './pages/purchasing/PurchaseOrders';
import GoodsReceivedNotes from './pages/purchasing/GoodsReceivedNotes';
import Invoices from './pages/purchasing/Invoices';
import POSDashboard from './pages/pos/POSDashboard';
import FloorPlan from './pages/pos/FloorPlan';
import KDS from './pages/pos/KDS';
import ShiftDashboard from './pages/pos/ShiftDashboard';
import CustomersList from './pages/customers/CustomersList';
import CustomerProfile from './pages/customers/CustomerProfile';
import PromotionsDashboard from './pages/promotions/PromotionsDashboard';
import OrdersPage from './pages/orders/OrdersPage';

// Finance Pages
import CashRegister from './pages/finance/CashRegister';
import SalesJournal from './pages/finance/SalesJournal';
import Expenses from './pages/finance/Expenses';
import PettyCash from './pages/finance/PettyCash';
import BankReconciliation from './pages/finance/BankReconciliation';
import CorporateInvoices from './pages/finance/CorporateInvoices';
import FinancialReports from './pages/finance/FinancialReports';
import EndOfDay from './pages/finance/EndOfDay';

import ReportsDashboard from './pages/reports/ReportsDashboard';

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
            
            {/* Routes explicitly hidden from 'cashier' role */}
            <Route element={<ProtectedRoute excludedRoles={['cashier']} />}>
              <Route path="/" element={<Dashboard />} />
              
              {/* Customers Routes */}
              <Route path="/customers" element={<CustomersList />} />
              <Route path="/customers/:id" element={<CustomerProfile />} />

              {/* Promotions Routes */}
              <Route path="/promotions" element={<PromotionsDashboard />} />
              <Route path="/orders" element={<OrdersPage />} />
            </Route>

            <Route path="/profile" element={<Profile />} />
            
            {/* POS Routes (Accessible to all authenticated staff, including cashiers) */}
            <Route path="/pos" element={<POSDashboard />} />
            <Route path="/pos/floor-plan" element={<FloorPlan />} />
            <Route path="/pos/kds" element={<KDS />} />
            <Route path="/pos/my-shift" element={<ShiftDashboard />} />
            
            {/* Protected Routes (Manager & Super Admin only) */}
            <Route element={<ProtectedRoute allowedRoles={['manager', 'super_admin']} />}>
              <Route path="/settings" element={<Settings />} />
              <Route path="/settings/users" element={<UserManagement />} />
              <Route path="/settings/branches" element={<BranchManagement />} />
              <Route path="/register" element={<RegisterStaff />} />
              
              {/* Inventory & Purchasing */}
              <Route path="/inventory" element={<InventoryDashboard />} />
              <Route path="/inventory/materials" element={<RawMaterials />} />
              <Route path="/inventory/units" element={<Units />} />
              <Route path="/inventory/conversions" element={<UnitConversions />} />
              <Route path="/inventory/categories" element={<Categories />} />
              <Route path="/inventory/products" element={<Products />} />
              <Route path="/inventory/recipes" element={<Recipes />} />
              <Route path="/inventory/counts" element={<PhysicalCounts />} />
              <Route path="/inventory/waste" element={<WasteLogs />} />
              <Route path="/purchasing" element={<PurchasingDashboard />} />
              <Route path="/purchasing/suppliers" element={<Suppliers />} />
              <Route path="/purchasing/orders" element={<PurchaseOrders />} />
              <Route path="/purchasing/grns" element={<GoodsReceivedNotes />} />
              <Route path="/purchasing/invoices" element={<Invoices />} />

              {/* Finance Module - Manager & Admin specific */}
              <Route path="/finance/sales-journal" element={<SalesJournal />} />
              <Route path="/finance/expenses" element={<Expenses />} />
              <Route path="/finance/bank-reconciliation" element={<BankReconciliation />} />
              <Route path="/finance/corporate-invoices" element={<CorporateInvoices />} />
              <Route path="/finance/reports" element={<FinancialReports />} />
              <Route path="/finance/end-of-day" element={<EndOfDay />} />

              {/* Reports Engine */}
              <Route path="/reports" element={<ReportsDashboard />} />
            </Route>

            {/* Finance Module - Staff/Exclude Cashier */}
            <Route element={<ProtectedRoute excludedRoles={['cashier']} />}>
              <Route path="/finance/cash-register" element={<CashRegister />} />
              <Route path="/finance/petty-cash" element={<PettyCash />} />
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
