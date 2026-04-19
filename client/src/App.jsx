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

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex-center" style={{ height: '100vh' }}><div className="text-gold">Loading...</div></div>;

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/pos" element={<POS />} />
        <Route path="/menu" element={<AdminRoute><MenuManager /></AdminRoute>} />
        <Route path="/ingredients" element={<AdminRoute><Ingredients /></AdminRoute>} />
        <Route path="/recipes" element={<AdminRoute><Recipes /></AdminRoute>} />
        <Route path="/categories" element={<AdminRoute><Categories /></AdminRoute>} />
        <Route path="/units" element={<AdminRoute><Units /></AdminRoute>} />
        <Route path="/modifiers" element={<AdminRoute><Modifiers /></AdminRoute>} />
        <Route path="/suppliers" element={<AdminRoute><Suppliers /></AdminRoute>} />
        <Route path="/purchases" element={<AdminRoute><Purchases /></AdminRoute>} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/transactions-void" element={<AdminRoute><TransactionsVoid /></AdminRoute>} />
        <Route path="/reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="/cashier-performance" element={<AdminRoute><CashierPerformance /></AdminRoute>} />
        <Route path="/users" element={<AdminRoute><UsersPage /></AdminRoute>} />
        <Route path="/settings" element={<AdminRoute><Settings /></AdminRoute>} />
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
