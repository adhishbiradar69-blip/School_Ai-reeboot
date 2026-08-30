import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../auth/AuthContext';
import { EASE, SPRING } from '../lib/motion.jsx';

const A = ['super_admin', 'school_admin', 'admin'];
const allNavGroups = [
  {
    label: 'Class Teacher',
    roles: ['class_teacher', ...A],
    items: [
      { path: '/teacher/attendance', label: 'Attendance', icon: '📋' },
      { path: '/teacher/tasks', label: 'Tasks', icon: '✅' },
      { path: '/teacher/marks', label: 'Marks', icon: '📝' },
      { path: '/class-teacher/report', label: 'Class Report', icon: '📊' },
    ]
  },
  {
    label: 'Administration',
    roles: A,
    items: [
      { path: '/admin/dashboard', label: 'Dashboard', icon: '🏫' },
      { path: '/admin/students', label: 'Students', icon: '👨‍🎓' },
      { path: '/admin/accounts', label: 'Accounts', icon: '🔑' },
    ]
  },
  {
    label: 'Principal',
    roles: ['principal', ...A],
    items: [
      { path: '/principal/dashboard', label: 'Dashboard', icon: '👔' },
    ]
  },
  {
    label: 'Chairperson',
    roles: ['chairperson', ...A],
    items: [
      { path: '/chairperson/dashboard', label: 'Multi-School', icon: '🎯' },
    ]
  },
  {
    label: 'Parents',
    roles: ['parent', ...A],
    items: [
      { path: '/parent/view', label: 'My Child', icon: '👨‍👩‍👧' },
    ]
  },
];

const roleLabel = { super_admin: 'Super Admin', school_admin: 'School Admin', admin: 'Administrator',
                   principal: 'Principal', chairperson: 'Chairperson',
                   class_teacher: 'Class Teacher', parent: 'Parent' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const userRole = user?.role || 'class_teacher';
  const visibleGroups = allNavGroups.filter(g => g.roles.includes(userRole));

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className={`app-layout ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Ambient orbs behind everything */}
      <div className="ambient-orbs" aria-hidden="true">
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>

      <motion.aside
        className="sidebar"
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
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
          <button className="sidebar-toggle" onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand' : 'Collapse'}>
            {collapsed ? '→' : '←'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((group) => (
            <div key={group.label} className="nav-group">
              {!collapsed && <div className="nav-group-label">{group.label}</div>}
              {group.items.map((item) => (
                <NavLink key={item.path} to={item.path}
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  title={collapsed ? item.label : ''}>
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span layoutId="nav-active-pill" className="nav-active-pill"
                          transition={SPRING} />
                      )}
                      <span className="nav-icon">{item.icon}</span>
                      {!collapsed && <span className="nav-text">{item.label}</span>}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={`sidebar-footer ${collapsed ? 'hidden' : ''}`}>
          <div className="footer-user">
            <p className="footer-label">Signed in as</p>
            <p className="footer-email">{user?.full_name || user?.email || 'User'}</p>
            <p className="footer-role">{roleLabel[userRole] || userRole}</p>
          </div>
          <button onClick={handleLogout} className="btn btn-ghost">Sign Out</button>
        </div>
      </motion.aside>

      <main className="main-area">
        <AnimatePresence mode="wait">
          <motion.div key={location.pathname} className="page-host"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.38, ease: EASE }}>
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
