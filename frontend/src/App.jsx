import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/common/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AppointmentsPage from './pages/AppointmentsPage'
import BookAppointmentPage from './pages/BookAppointmentPage'
import PatientsPage from './pages/PatientsPage'
import DoctorsListPage from './pages/DoctorsListPage'
import MedicalRecordsPage from './pages/MedicalRecordsPage'
import BillingPage from './pages/BillingPage'
import DepartmentsPage from './pages/DepartmentsPage'
import UsersPage from './pages/UsersPage'
import ProfilePage from './pages/ProfilePage'
import NotFoundPage from './pages/NotFoundPage'
import DoctorSchedulePage from './pages/DoctorSchedulePage'
import BlogPage from './pages/BlogPage'

function PrivateRoute({ children, roles }) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user?.role)) return <Navigate to="/dashboard" replace />
  return children
}

function PublicRoute({ children }) {
  const { isAuthenticated } = useAuthStore()
  if (isAuthenticated) return <Navigate to="/dashboard" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Private Routes — all inside Layout */}
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="appointments" element={<AppointmentsPage />} />
        <Route path="appointments/book" element={<BookAppointmentPage />} />
        <Route path="medical-records" element={<MedicalRecordsPage />} />
        <Route path="billing" element={<BillingPage />} />
        <Route path="blog" element={<BlogPage />} />

        {/* Doctor schedule */}
        <Route path="schedule" element={
          <PrivateRoute roles={['doctor']}>
            <DoctorSchedulePage />
          </PrivateRoute>
        } />

        {/* Staff only */}
        <Route path="patients" element={
          <PrivateRoute roles={['admin', 'doctor', 'nurse', 'receptionist']}>
            <PatientsPage />
          </PrivateRoute>
        } />
        <Route path="doctors" element={
          <PrivateRoute roles={['admin', 'receptionist', 'nurse', 'patient']}>
            <DoctorsListPage />
          </PrivateRoute>
        } />
        <Route path="departments" element={
          <PrivateRoute roles={['admin', 'doctor', 'nurse', 'receptionist']}>
            <DepartmentsPage />
          </PrivateRoute>
        } />

        {/* Admin only */}
        <Route path="users" element={
          <PrivateRoute roles={['admin']}>
            <UsersPage />
          </PrivateRoute>
        } />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}