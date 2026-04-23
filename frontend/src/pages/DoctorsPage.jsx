import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Users, Stethoscope, Calendar, CreditCard,
  TrendingUp, Clock, CheckCircle, AlertCircle
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format } from 'date-fns'
import useAuthStore from '../store/authStore'
import { appointmentsAPI, usersAPI, billingAPI, doctorsAPI } from '../services/api'
import { StatCard, LoadingPage, StatusBadge } from '../components/common/UI'

// ── Admin Dashboard ────────────────────────────────────────────────────────────
function AdminDashboard() {
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
        <h1 className="section-title">Admin Dashboard</h1>
        <p className="section-subtitle">Hospital overview and key metrics</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={userStats?.by_role?.patient ?? '—'} icon={Users} color="blue" />
        <StatCard label="Active Doctors" value={userStats?.by_role?.doctor ?? '—'} icon={Stethoscope} color="green" />
        <StatCard label="Today's Appointments" value={apptStats?.today ?? '—'} icon={Calendar} color="amber" />
        <StatCard label="Monthly Revenue" value={`$${Number(revenue?.monthly_revenue || 0).toLocaleString()}`} icon={CreditCard} color="purple" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={`$${Number(revenue?.total_revenue || 0).toLocaleString()}`} icon={TrendingUp} color="green" />
        <StatCard label="Pending Appointments" value={apptStats?.by_status?.pending ?? '—'} icon={Clock} color="amber" />
        <StatCard label="Unpaid Bills" value={`$${Number(revenue?.unpaid_total || 0).toLocaleString()}`} icon={AlertCircle} color="red" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {pieData.length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-base font-semibold text-white mb-4">Appointments by Status</h3>
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
            <h3 className="text-base font-semibold text-white">Recent Appointments</h3>
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
  const { data: today } = useQuery({ queryKey: ['today-appts'], queryFn: () => appointmentsAPI.today().then(r => r.data) })
  const { data: doctorData } = useQuery({ queryKey: ['doctor-me'], queryFn: () => doctorsAPI.getMe().then(r => r.data) })
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [availDays, setAvailDays] = useState([])
  const [availFrom, setAvailFrom] = useState('09:00')
  const [availTo, setAvailTo] = useState('17:00')
  const [saving, setSaving] = useState(false)

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  const openSchedule = () => {
    setAvailDays(doctorData?.available_days || [])
    setAvailFrom(doctorData?.available_from?.slice(0, 5) || '09:00')
    setAvailTo(doctorData?.available_to?.slice(0, 5) || '17:00')
    setScheduleOpen(true)
  }

  const toggleDay = (day) => {
    setAvailDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  const saveSchedule = async () => {
    setSaving(true)
    try {
      await doctorsAPI.updateMe({
        available_days: availDays,
        available_from: availFrom,
        available_to: availTo,
        is_available: true,
      })
      toast.success('Schedule saved!')
      qc.invalidateQueries(['doctor-me'])
      setScheduleOpen(false)
    } catch {
      toast.error('Failed to save schedule')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">Good morning, {user?.full_name?.split(' ')[0]} 👋</h1>
          <p className="section-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <button onClick={openSchedule} className="btn-primary">
          <Clock size={15} /> Manage Schedule
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today's Appointments" value={today?.length ?? '—'} icon={Calendar} color="blue" />
        <StatCard label="Pending Approval" value={(today || []).filter(a => a.status === 'pending').length} icon={Clock} color="amber" />
        <StatCard label="Completed Today" value={(today || []).filter(a => a.status === 'completed').length} icon={CheckCircle} color="green" />
      </div>

      {doctorData && (
        <div className="glass-card p-4 flex flex-wrap gap-6 items-center">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Working Hours</p>
            <p className="text-slate-200 font-medium mt-0.5">
              {doctorData.available_from?.slice(0, 5) || '—'} → {doctorData.available_to?.slice(0, 5) || '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Available Days</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {doctorData.available_days?.length > 0
                ? doctorData.available_days.map(d => (
                    <span key={d} className="badge bg-primary-500/15 text-primary-300 border border-primary-500/30 text-xs">{d.slice(0, 3)}</span>
                  ))
                : <span className="text-slate-500 text-sm">Not set</span>
              }
            </div>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
            <span className={`badge border text-xs mt-1 ${doctorData.is_available
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
              : 'bg-red-500/15 text-red-300 border-red-500/30'}`}>
              {doctorData.is_available ? 'Available' : 'Unavailable'}
            </span>
          </div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/40">
          <h3 className="text-base font-semibold text-white">Today's Schedule</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          {(today || []).length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Calendar size={28} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">No appointments today</p>
            </div>
          ) : (today || []).map(appt => (
            <div key={appt.id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 text-center">
                  <p className="text-primary-400 font-mono text-sm font-medium">{appt.time?.slice(0, 5)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-200">{appt.patient_name}</p>
                  <p className="text-xs text-slate-500">{appt.reason || 'General consultation'}</p>
                </div>
              </div>
              <StatusBadge status={appt.status} />
            </div>
          ))}
        </div>
      </div>

      {/* Schedule Modal */}
      {scheduleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/70" onClick={() => setScheduleOpen(false)} />
          <div className="relative w-full max-w-md glass-card p-6 shadow-2xl animate-slide-up">
            <h2 className="text-lg font-display font-semibold text-white mb-5">Manage Schedule</h2>
            <div className="space-y-5">
              <div>
                <p className="label">Available Days</p>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={`py-2 px-1 rounded-xl text-xs font-medium border transition-all
                        ${availDays.includes(day)
                          ? 'bg-primary-600 border-primary-500 text-white'
                          : 'bg-slate-800/60 border-slate-600/40 text-slate-400 hover:border-primary-500/50'
                        }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">From</label>
                  <input type="time" value={availFrom} onChange={e => setAvailFrom(e.target.value)} className="input-field" />
                </div>
                <div>
                  <label className="label">To</label>
                  <input type="time" value={availTo} onChange={e => setAvailTo(e.target.value)} className="input-field" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setScheduleOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
              <button onClick={saveSchedule} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? 'Saving...' : 'Save Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Patient Dashboard ──────────────────────────────────────────────────────────
function PatientDashboard() {
  const { data: upcoming } = useQuery({ queryKey: ['patient-upcoming'], queryFn: () => appointmentsAPI.upcoming().then(r => r.data) })
  const { data: bills } = useQuery({ queryKey: ['patient-bills'], queryFn: () => billingAPI.myBills().then(r => r.data) })

  const unpaidCount = (bills || []).filter(b => b.status === 'unpaid').length
  const nextAppt = (upcoming || [])[0]

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">My Health Dashboard</h1>
        <p className="section-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Upcoming Appointments" value={upcoming?.length ?? '—'} icon={Calendar} color="blue" />
        <StatCard label="Unpaid Bills" value={unpaidCount} icon={CreditCard} color={unpaidCount > 0 ? 'red' : 'green'} />
        <StatCard label="Total Appointments" value={(bills || []).length} icon={CheckCircle} color="green" />
      </div>

      {nextAppt && (
        <div className="glass-card p-6 border-l-4 border-primary-500">
          <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider mb-2">Next Appointment</p>
          <p className="text-lg font-display font-semibold text-white">Dr. {nextAppt.doctor_name}</p>
          <p className="text-slate-400 text-sm mt-1">
            {nextAppt.date} at {nextAppt.time?.slice(0, 5)} · {nextAppt.reason || 'General consultation'}
          </p>
          <div className="mt-2"><StatusBadge status={nextAppt.status} /></div>
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/40">
          <h3 className="text-base font-semibold text-white">Upcoming Appointments</h3>
        </div>
        <div className="divide-y divide-slate-700/30">
          {(upcoming || []).length === 0 ? (
            <div className="px-6 py-10 text-center">
              <Calendar size={28} className="mx-auto text-slate-600 mb-2" />
              <p className="text-slate-500 text-sm">No upcoming appointments</p>
            </div>
          ) : (upcoming || []).map(appt => (
            <div key={appt.id} className="px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-200">Dr. {appt.doctor_name}</p>
                <p className="text-xs text-slate-500">{appt.date} at {appt.time?.slice(0, 5)}</p>
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
  const { data: today } = useQuery({ queryKey: ['today-appts'], queryFn: () => appointmentsAPI.today().then(r => r.data) })

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">Staff Dashboard</h1>
        <p className="section-subtitle">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Today's Appointments" value={today?.length ?? '—'} icon={Calendar} color="blue" />
        <StatCard label="Pending" value={(today || []).filter(a => a.status === 'pending').length} icon={Clock} color="amber" />
        <StatCard label="Approved" value={(today || []).filter(a => a.status === 'approved').length} icon={CheckCircle} color="green" />
      </div>
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/40">
          <h3 className="text-base font-semibold text-white">Today's Appointments</h3>
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
    case 'admin':   return <AdminDashboard />
    case 'doctor':  return <DoctorDashboard />
    case 'patient': return <PatientDashboard />
    default:        return <StaffDashboard />
  }
}