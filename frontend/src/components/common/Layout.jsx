import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Calendar, Users, UserCheck, Stethoscope,
  FileText, CreditCard, Building2, Bell, ChevronLeft,
  ChevronRight, LogOut, User, Menu, X, Activity, Clock
} from 'lucide-react'
import useAuthStore from '../../store/authStore'
import NotificationBell from './NotificationBell'

const navConfig = {
  admin: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: Calendar, label: 'Appointments' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/doctors', icon: Stethoscope, label: 'Doctors' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/medical-records', icon: FileText, label: 'Medical Records' },
    { to: '/billing', icon: CreditCard, label: 'Billing' },
    { to: '/users', icon: UserCheck, label: 'User Management' },
  ],
  doctor: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: Calendar, label: 'Appointments' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/medical-records', icon: FileText, label: 'Medical Records' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/schedule', icon: Clock, label: 'My Schedule' },

  ],
  nurse: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: Calendar, label: 'Appointments' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/medical-records', icon: FileText, label: 'Medical Records' },
  ],
  receptionist: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: Calendar, label: 'Appointments' },
    { to: '/patients', icon: Users, label: 'Patients' },
    { to: '/doctors', icon: Stethoscope, label: 'Doctors' },
    { to: '/billing', icon: CreditCard, label: 'Billing' },
    { to: '/departments', icon: Building2, label: 'Departments' },
  ],
  patient: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/appointments', icon: Calendar, label: 'My Appointments' },
    { to: '/appointments/book', icon: Calendar, label: 'Book Appointment' },
    { to: '/medical-records', icon: FileText, label: 'My Records' },
    { to: '/billing', icon: CreditCard, label: 'My Bills' },
  ],
}

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  doctor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  nurse: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  receptionist: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  patient: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const navItems = navConfig[user?.role] || navConfig.patient

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-slate-700/50 ${collapsed ? 'justify-center' : ''}`}>
        <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center flex-shrink-0">
          <Activity className="w-5 h-5 text-white" />
        </div>
        {!collapsed && (
          <div>
            <h1 className="text-white font-display font-bold text-base leading-none">MediCore</h1>
            <p className="text-slate-500 text-xs mt-0.5">HMS</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group
               ${isActive
                ? 'bg-primary-600/20 text-primary-300 border border-primary-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
              } ${collapsed ? 'justify-center' : ''}`
            }
          >
            <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-slate-700/50 space-y-1">
        <NavLink
          to="/profile"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200
             ${isActive ? 'bg-slate-700/60 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/40'}
             ${collapsed ? 'justify-center' : ''}`
          }
        >
          <div className="w-7 h-7 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <User size={14} />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 font-medium truncate text-xs">{user?.full_name}</p>
              <span className={`badge border text-[10px] mt-0.5 ${roleColors[user?.role]}`}>
                {user?.role}
              </span>
            </div>
          )}
        </NavLink>

        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400
                      hover:text-red-400 hover:bg-red-500/10 transition-all duration-200
                      ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut size={16} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar - Mobile */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-700/50
                         transform transition-transform duration-300 lg:hidden
                         ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="absolute top-4 right-4">
          <button onClick={() => setMobileOpen(false)} className="p-1.5 text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      {/* Sidebar - Desktop */}
      <aside className={`hidden lg:flex flex-col bg-slate-900 border-r border-slate-700/50 transition-all duration-300 flex-shrink-0
                         ${collapsed ? 'w-16' : 'w-60'}`}>
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute left-0 bottom-20 translate-x-[calc(100%+1px)] -translate-y-1/2 hidden lg:flex
                     w-5 h-10 bg-slate-800 border border-slate-700/50 items-center justify-center
                     text-slate-400 hover:text-white rounded-r-lg transition-colors z-10"
          style={{ position: 'fixed', left: collapsed ? '56px' : '236px', bottom: '80px' }}
        >
          {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-slate-900/80 border-b border-slate-700/50 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
          <button className="lg:hidden p-2 text-slate-400 hover:text-white" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center">
                <User size={14} className="text-slate-300" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-200 leading-none">{user?.full_name}</p>
                <span className={`badge border text-[10px] ${roleColors[user?.role]}`}>{user?.role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  )
}