import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage.jsx';
import AdminLoginPage from './pages/AdminLoginPage.jsx';
import DetailsPage from './pages/DetailsPage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminUserNew from './pages/admin/AdminUserNew.jsx';
import AdminUserDetail from './pages/admin/AdminUserDetail.jsx';
import AdminUserEdit from './pages/admin/AdminUserEdit.jsx';
import AdminAudit from './pages/admin/AdminAudit.jsx';
import AdminSettings from './pages/admin/AdminSettings.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

const user = (element) => <ProtectedRoute>{element}</ProtectedRoute>;
const admin = (element) => <ProtectedRoute adminOnly>{element}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/details" element={user(<DetailsPage />)} />
      <Route path="/change-password" element={admin(<ChangePasswordPage />)} />
      <Route path="/admin" element={admin(<AdminDashboard />)} />
      <Route path="/admin/users" element={admin(<AdminUsers />)} />
      <Route path="/admin/users/new" element={admin(<AdminUserNew />)} />
      <Route path="/admin/users/:id" element={admin(<AdminUserDetail />)} />
      <Route path="/admin/users/:id/edit" element={admin(<AdminUserEdit />)} />
      <Route path="/admin/audit" element={admin(<AdminAudit />)} />
      <Route path="/admin/settings" element={admin(<AdminSettings />)} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
