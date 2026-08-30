import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth, homePathFor } from './auth/AuthContext';
import Layout from './components/Layout';
import PublicLayout from './components/PublicLayout';
import { RouteLoader, useRouteTransition } from './components/PageLoader.jsx';
import Login from './pages/Login';
import Landing from './pages/public/Landing';
import About from './pages/public/About';
import Terms from './pages/public/Terms';
import Privacy from './pages/public/Privacy';
import AttendanceBoard from './pages/Teacher/AttendanceBoard';
import TaskManager from './pages/Teacher/TaskManager';
import MarksBoard from './pages/Teacher/MarksBoard';
import ClassReport from './pages/ClassTeacher/ClassReport';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminStudents from './pages/Admin/Students';
import AccountCreation from './pages/Admin/Accounts';
import PrincipalDashboard from './pages/Principal/Dashboard';
import ChairpersonMultiSchool from './pages/Chairperson/MultiSchool';
import ParentChildView from './pages/Parent/ChildView';

const A = ['super_admin', 'school_admin', 'admin']; // admin roles

function ProtectedRoute({ children, roles }) {
  const { user, token } = useAuth();
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <Layout>{children}</Layout>;
}

/* Landing route: shows Landing if NOT logged in, otherwise redirects to the
   user's role-based home. */
function LandingRoute() {
  const { user, token } = useAuth();
  if (token && user) return <Navigate to={homePathFor(user.role)} replace />;
  return <PublicLayout><Landing /></PublicLayout>;
}

/* Generic public-page wrapper — never blocks on auth. */
function PublicPage({ children }) {
  return <PublicLayout>{children}</PublicLayout>;
}

/* Login route: if already authenticated, send to role home. */
function LoginRoute() {
  const { user, token } = useAuth();
  if (token && user) return <Navigate to={homePathFor(user.role)} replace />;
  return <Login />;
}

function AnimatedRoutes() {
  const location = useLocation();
  // 600ms route-loader on every navigation. Doesn't block public pages — the
  // loader is purely visual (overlay) and the new route renders underneath.
  const loading = useRouteTransition(location.pathname, 600);

  return (
    <>
      <AnimatePresence>{loading && <RouteLoader key="route-loader" ms={600} onDone={() => {}} />}</AnimatePresence>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public pages — no auth required */}
          <Route path="/" element={<LandingRoute />} />
          <Route path="/about" element={<PublicPage><About /></PublicPage>} />
          <Route path="/terms" element={<PublicPage><Terms /></PublicPage>} />
          <Route path="/privacy" element={<PublicPage><Privacy /></PublicPage>} />
          <Route path="/login" element={<LoginRoute />} />

          {/* Protected app pages — auth + role required */}
          <Route path="/teacher/attendance" element={
            <ProtectedRoute roles={['class_teacher', ...A]}><AttendanceBoard /></ProtectedRoute>} />
          <Route path="/teacher/tasks" element={
            <ProtectedRoute roles={['class_teacher', ...A]}><TaskManager /></ProtectedRoute>} />
          <Route path="/teacher/marks" element={
            <ProtectedRoute roles={['class_teacher', ...A]}><MarksBoard /></ProtectedRoute>} />
          <Route path="/class-teacher/report" element={
            <ProtectedRoute roles={['class_teacher', ...A]}><ClassReport /></ProtectedRoute>} />
          <Route path="/admin/dashboard" element={
            <ProtectedRoute roles={A}><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/students" element={
            <ProtectedRoute roles={A}><AdminStudents /></ProtectedRoute>} />
          <Route path="/admin/accounts" element={
            <ProtectedRoute roles={A}><AccountCreation /></ProtectedRoute>} />
          <Route path="/principal/dashboard" element={
            <ProtectedRoute roles={['principal', ...A]}><PrincipalDashboard /></ProtectedRoute>} />
          <Route path="/chairperson/dashboard" element={
            <ProtectedRoute roles={['chairperson', ...A]}><ChairpersonMultiSchool /></ProtectedRoute>} />
          <Route path="/parent/view" element={
            <ProtectedRoute roles={['parent', ...A]}><ParentChildView /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AnimatedRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
