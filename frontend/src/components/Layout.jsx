import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleNames = {
  resident: '居民',
  evaluator: '评估人员',
  handler: '街道经办人',
  legal: '法务'
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard', label: '进度看板', icon: '📊' },
    { path: '/houses', label: '房屋管理', icon: '🏠' },
    { path: '/archives', label: '台账归档', icon: '📁' }
  ];

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          🏗️ 城市更新签约系统
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              {item.icon} {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>{user?.name}</div>
        </div>
      </aside>
      <div className="main-content">
        <header className="top-header">
          <div>欢迎使用城市更新居民签约管理系统</div>
          <div className="user-info">
            <span className="role-tag">{roleNames[user?.role]}</span>
            <span>{user?.name}</span>
            <button className="logout-btn" onClick={handleLogout}>退出</button>
          </div>
        </header>
        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
