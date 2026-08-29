import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import AttendanceBoard from './pages/Teacher/AttendanceBoard';
import TaskManager from './pages/Teacher/TaskManager';
import MarksBoard from './pages/Teacher/MarksBoard';
import ClassReport from './pages/ClassTeacher/ClassReport';
import ParentView from './pages/Parent/ChildView';
import AdminDashboard from './pages/Admin/Dashboard';
import AdminStudents from './pages/Admin/Students';
import AdminClasses from './pages/Admin/Classes';
import PrincipalDashboard from './pages/Principal/Dashboard';
import PrincipalAI from './pages/Principal/AIChat';
import VPDashboard from './pages/VicePrincipal/MultiSchool';

function ProtectedRoute({ children }) {
  const { token } = useAuth();
  if (!token) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          
          <Route path="/teacher/attendance" element={
            <ProtectedRoute><AttendanceBoard /></ProtectedRoute>
          } />
          <Route path="/teacher/tasks" element={
            <ProtectedRoute><TaskManager /></ProtectedRoute>
          } />
          <Route path="/teacher/marks" element={
            <ProtectedRoute><MarksBoard /></ProtectedRoute>
          } />
          
          <Route path="/class-teacher/report" element={
            <ProtectedRoute><ClassReport /></ProtectedRoute>
          } />
          
          <Route path="/admin/dashboard" element={
            <ProtectedRoute><AdminDashboard /></ProtectedRoute>
          } />
          <Route path="/admin/students" element={
            <ProtectedRoute><AdminStudents /></ProtectedRoute>
          } />
          <Route path="/admin/classes" element={
            <ProtectedRoute><AdminClasses /></ProtectedRoute>
          } />
          
          <Route path="/principal/dashboard" element={
            <ProtectedRoute><PrincipalDashboard /></ProtectedRoute>
          } />
          <Route path="/principal/ai" element={
            <ProtectedRoute><PrincipalAI /></ProtectedRoute>
          } />
          
          <Route path="/vp/dashboard" element={
            <ProtectedRoute><VPDashboard /></ProtectedRoute>
          } />
          
          <Route path="/parent/view" element={
            <ProtectedRoute><ParentView /></ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;