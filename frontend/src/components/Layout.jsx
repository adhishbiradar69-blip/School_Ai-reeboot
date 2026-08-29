import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const allNavGroups = [
  {
    label: 'Class Teacher',
    roles: ['class_teacher', 'admin'],
    items: [
      { path: '/teacher/attendance', label: 'Attendance', icon: '📋' },
      { path: '/teacher/tasks', label: 'Tasks', icon: '✅' },
      { path: '/teacher/marks', label: 'Marks', icon: '📝' },
      { path: '/class-teacher/report', label: 'Class Report', icon: '📊' },
    ]
  },
  {
    label: 'Administration',
    roles: ['admin'],
    items: [
      { path: '/admin/dashboard', label: 'Dashboard', icon: '🏫' },
      { path: '/admin/students', label: 'Students', icon: '👨‍🎓' },
      { path: '/admin/classes', label: 'Classes', icon: '📚' },
    ]
  },
  {
    label: 'Principal',
    roles: ['principal', 'admin'],
    items: [
      { path: '/principal/dashboard', label: 'Dashboard', icon: '👔' },
      { path: '/principal/ai', label: 'AI Assistant', icon: '🤖' },
    ]
  },
  {
    label: 'Vice Principal',
    roles: ['vp', 'admin'],
    items: [
      { path: '/vp/dashboard', label: 'Dashboard', icon: '🎯' },
    ]
  },
  {
    label: 'Parents',
    roles: ['parent', 'admin'],
    items: [
      { path: '/parent/view', label: 'My Child', icon: '👨‍👩‍👧' },
    ]
  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const userRole = user?.role || 'class_teacher';
  
  const visibleGroups = allNavGroups.filter(g => 
    g.roles.includes(userRole)
  );

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-text">
            {!collapsed ? (
              <>
                <h1>SchoolAI</h1>
                <p>Intelligent Management</p>
              </>
            ) : (
              <h1 className="brand-logo">S</h1>
            )}
          </div>
          <button 
            className="sidebar-toggle"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((group) => (
            <div key={group.label} className="nav-group">
              {!collapsed && <div className="nav-group-label">{group.label}</div>}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {!collapsed && <span className="nav-text">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={`sidebar-footer ${collapsed ? 'hidden' : ''}`}>
          <div className="footer-user">
            <p className="footer-label">Signed in as</p>
            <p className="footer-email">{user?.email || 'User'}</p>
            <p className="footer-role">{userRole}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost">
            Sign Out
          </button>
        </div>
      </aside>

      <main className="main-area">
        <div key={location.pathname} className="animate-fade">
          {children}
        </div>
      </main>
    </div>
  );
}