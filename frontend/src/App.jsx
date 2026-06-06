import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import HouseList from './pages/HouseList';
import HouseDetail from './pages/HouseDetail';
import ArchiveList from './pages/ArchiveList';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>加载中...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="houses" element={<HouseList />} />
        <Route path="houses/:id" element={<HouseDetail />} />
        <Route path="archives" element={<ArchiveList />} />
      </Route>
    </Routes>
  );
}

export default App;
