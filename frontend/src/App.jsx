import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { AuthProvider, useAuth, homePathFor, isAdmin } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
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
  if (!token) return <Navigate to="/" replace />;
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <Layout>{children}</Layout>;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Login />} />
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
