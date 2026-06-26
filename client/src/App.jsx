import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { BluetoothProvider } from './context/BluetoothContext';
import { ThemeProvider } from './context/ThemeContext';
import { ShiftProvider } from './context/ShiftContext';
import AppLayout from './components/Layout/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import MenuManager from './pages/MenuManager';
import Ingredients from './pages/Ingredients';
import Recipes from './pages/Recipes';
import Categories from './pages/Categories';
import Units from './pages/Units';
import Modifiers from './pages/Modifiers';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Transactions from './pages/Transactions';
import TransactionsVoid from './pages/TransactionsVoid';
import Reports from './pages/Reports';
import UsersPage from './pages/UsersPage';
import Settings from './pages/Settings';
import CashierPerformance from './pages/CashierPerformance';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center" style={{ height: '100vh' }}><div className="text-gold">Loading...</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AdminRoute({ children }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

function PermissionRoute({ permission, children }) {
  const { user, isAdmin } = useAuth();
  if (isAdmin) return children;
  if (user?.permissions?.includes(permission)) return children;
  return <Navigate to="/" replace />;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center" style={{ height: '100vh' }}><div className="text-gold">Loading...</div></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/menu" element={<PermissionRoute permission="manage_menu"><MenuManager /></PermissionRoute>} />
        <Route path="/ingredients" element={<PermissionRoute permission="manage_stock"><Ingredients /></PermissionRoute>} />
        <Route path="/recipes" element={<PermissionRoute permission="manage_recipes"><Recipes /></PermissionRoute>} />
        <Route path="/categories" element={<PermissionRoute permission="manage_menu"><Categories /></PermissionRoute>} />
        <Route path="/units" element={<PermissionRoute permission="manage_menu"><Units /></PermissionRoute>} />
        <Route path="/modifiers" element={<PermissionRoute permission="manage_menu"><Modifiers /></PermissionRoute>} />
        <Route path="/suppliers" element={<PermissionRoute permission="manage_stock"><Suppliers /></PermissionRoute>} />
        <Route path="/purchases" element={<PermissionRoute permission="manage_purchases"><Purchases /></PermissionRoute>} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions-void" element={<PermissionRoute permission="manage_users"><TransactionsVoid /></PermissionRoute>} />
        <Route path="/reports" element={<PermissionRoute permission="view_reports"><Reports /></PermissionRoute>} />
        <Route path="/cashier-performance" element={<PermissionRoute permission="manage_users"><CashierPerformance /></PermissionRoute>} />
        <Route path="/users" element={<PermissionRoute permission="manage_users"><UsersPage /></PermissionRoute>} />
        <Route path="/settings" element={<PermissionRoute permission="manage_settings"><Settings /></PermissionRoute>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <BluetoothProvider>
          <ThemeProvider>
            <ShiftProvider>
              <AppRoutes />
            </ShiftProvider>
          </ThemeProvider>
        </BluetoothProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
