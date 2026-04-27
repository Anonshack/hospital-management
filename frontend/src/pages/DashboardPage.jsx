import { useQuery } from '@tanstack/react-query'
import {
  Users, Stethoscope, Calendar, CreditCard,
  TrendingUp, Clock, CheckCircle, AlertCircle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import useAuthStore from '../store/authStore'
import useLanguageStore from '../store/languageStore'
import { appointmentsAPI, usersAPI, billingAPI } from '../services/api'
import { StatCard, LoadingPage, StatusBadge } from '../components/common/UI'
import { format } from 'date-fns'

// ── Admin Dashboard ────────────────────────────────────────────────────────────
function AdminDashboard() {
  const t = useLanguageStore(state => state.t)
  const { data: userStats } = useQuery({ queryKey: ['user-stats'], queryFn: () => usersAPI.statistics().then(r => r.data) })
  const { data: apptStats } = useQuery({ queryKey: ['appt-stats'], queryFn: () => appointmentsAPI.statistics().then(r => r.data) })
  const { data: revenue } = useQuery({ queryKey: ['revenue'], queryFn: () => billingAPI.revenueSummary().then(r => r.data) })
  const { data: recent } = useQuery({ queryKey: ['recent-appts'], queryFn: () => appointmentsAPI.list({ page_size: 6 }).then(r => r.data) })

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  const pieData = apptStats?.by_status
    ? Object.entries(apptStats.by_status).map(([name, value]) => ({ name, value }))
    : []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">{t('adminDashboard')}</h1>
        <p className="section-subtitle">{t('hospitalOverview')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label={t('totalPatients')} value={userStats?.by_role?.patient ?? '—'} icon={Users} color="blue" />
        <StatCard label={t('activeDoctors')} value={userStats?.by_role?.doctor ?? '—'} icon={Stethoscope} color="green" />
        <StatCard label={t('todayAppointments')} value={apptStats?.today ?? '—'} icon={Calendar} color="amber" />
        <StatCard label={t('monthlyRevenue')} value={`$${Number(revenue?.monthly_revenue || 0).toLocaleString()}`} icon={CreditCard} color="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('totalRevenue')} value={`$${Number(revenue?.total_revenue || 0).toLocaleString()}`} icon={TrendingUp} color="green" />
        <StatCard label={t('pendingAppointments')} value={apptStats?.by_status?.pending ?? '—'} icon={Clock} color="amber" />
        <StatCard label={t('unpaidBills')} value={`$${Number(revenue?.unpaid_total || 0).toLocaleString()}`} icon={AlertCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {pieData.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-white mb-4">{t('appointmentsByStatus')}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f1f5f9' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
              {pieData.map(({ name, value }, i) => (
                <div key={name} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  {name}: {value}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="glass-card lg:col-span-2 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-700/40">
            <h3 className="text-base font-semibold text-white">{t('recentAppointments')}</h3>
          </div>
          <div className="divide-y divide-slate-700/30">
            {(recent?.results || recent || []).slice(0, 6).map(appt => (
              <div key={appt.id} className="px-6 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-200 font-medium">{appt.patient_name}</p>
                  <p className="text-xs text-slate-500">Dr. {appt.doctor_name} · {appt.date}</p>
                </div>
                <StatusBadge status={appt.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Doctor Dashboard ───────────────────────────────────────────────────────────
function DoctorDashboard() {
  const t = useLanguageStore(state => state.t)
  const { data: today } = useQuery({ queryKey: ['today-appts'], queryFn: () => appointmentsAPI.today().then(r => r.data) })
  const { user } = useAuthStore()

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">{t('goodMorning')}, {user?.full_name?.split(' ')[0]} 👋</h1>
        <p className="section-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('todayAppointments')} value={today?.length ?? '—'} icon={Calendar} color="blue" />
        <StatCard label={t('pendingApproval')} value={(today || []).filter(a => a.status === 'pending').length} icon={Clock} color="amber" />
        <StatCard label={t('completedToday')} value={(today || []).filter(a => a.status === 'completed').length} icon={CheckCircle} color="green" />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/40">
          <h3 className="text-base font-semibold text-white">{t('todaySchedule')}</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          {(today || []).length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Calendar size={28} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">{t('noAppointmentsToday')}</p>
            </div>
          ) : (today || []).map(appt => (
            <div key={appt.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 text-center">
                  <p className="text-primary-400 font-mono text-sm font-medium">{appt.time?.slice(0, 5)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{appt.patient_name}</p>
                  <p className="text-xs text-slate-500">{appt.reason || t('generalConsultation')}</p>
                </div>
              </div>
              <StatusBadge status={appt.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Patient Dashboard ──────────────────────────────────────────────────────────
function PatientDashboard() {
  const t = useLanguageStore(state => state.t)
  const { data: upcoming } = useQuery({ queryKey: ['patient-upcoming'], queryFn: () => appointmentsAPI.upcoming().then(r => r.data) })
  const { data: bills } = useQuery({ queryKey: ['patient-bills'], queryFn: () => billingAPI.myBills().then(r => r.data) })

  const unpaidCount = (bills || []).filter(b => b.status === 'unpaid').length
  const nextAppt = (upcoming || [])[0]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">{t('myHealthDashboard')}</h1>
        <p className="section-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('upcomingAppointments')} value={upcoming?.length ?? '—'} icon={Calendar} color="blue" />
        <StatCard label={t('unpaidBills')} value={unpaidCount} icon={CreditCard} color={unpaidCount > 0 ? 'red' : 'green'} />
        <StatCard label={t('totalAppointmentsCount')} value={(bills || []).length} icon={CheckCircle} color="green" />
      </div>

      {nextAppt && (
        <div className="glass-card p-6 border-l-4 border-primary-500">
          <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">{t('nextAppointment')}</p>
          <p className="text-lg font-display font-semibold text-white">Dr. {nextAppt.doctor_name}</p>
          <p className="text-slate-400 text-sm mt-1">
            {nextAppt.date} {t('at')} {nextAppt.time?.slice(0, 5)} · {nextAppt.reason || t('generalConsultation')}
          </p>
          <StatusBadge status={nextAppt.status} />
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/40">
          <h3 className="text-base font-semibold text-white">{t('upcomingAppointments')}</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          {(upcoming || []).length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Calendar size={28} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">{t('noUpcomingAppointments')}</p>
            </div>
          ) : (upcoming || []).map(appt => (
            <div key={appt.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Dr. {appt.doctor_name}</p>
                <p className="text-xs text-slate-500">{appt.date} {t('at')} {appt.time?.slice(0, 5)}</p>
              </div>
              <StatusBadge status={appt.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Staff Dashboard ────────────────────────────────────────────────────────────
function StaffDashboard() {
  const t = useLanguageStore(state => state.t)
  const { data: today } = useQuery({ queryKey: ['today-appts'], queryFn: () => appointmentsAPI.today().then(r => r.data) })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">{t('staffDashboard')}</h1>
        <p className="section-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label={t('todayAppointments')} value={today?.length ?? '—'} icon={Calendar} color="blue" />
        <StatCard label={t('pending')} value={(today || []).filter(a => a.status === 'pending').length} icon={Clock} color="amber" />
        <StatCard label={t('approved')} value={(today || []).filter(a => a.status === 'approved').length} icon={CheckCircle} color="green" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/40">
          <h3 className="text-base font-semibold text-white">{t('todayAppointments')}</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          {(today || []).map(appt => (
            <div key={appt.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">{appt.patient_name}</p>
                <p className="text-xs text-slate-500">Dr. {appt.doctor_name} · {appt.time?.slice(0, 5)}</p>
              </div>
              <StatusBadge status={appt.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main Export ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuthStore()
  if (!user) return <LoadingPage />

  switch (user.role) {
    case 'admin': return <AdminDashboard />
    case 'doctor': return <DoctorDashboard />
    case 'patient': return <PatientDashboard />
    default: return <StaffDashboard />
  }
}
