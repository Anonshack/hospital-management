import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Check, X, Eye, Filter } from 'lucide-react'
import toast from 'react-hot-toast'
import { appointmentsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  StatusBadge, SearchInput, Pagination, LoadingPage,
  EmptyState, ConfirmDialog, Modal, Select
} from '../components/common/UI'

export default function AppointmentsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cancelModal, setCancelModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', page, search, statusFilter],
    queryFn: () => appointmentsAPI.list({
      page,
      search: search || undefined,
      status: statusFilter || undefined,
    }).then(r => r.data),
  })

  const approveMutation = useMutation({
    mutationFn: (id) => appointmentsAPI.approve(id),
    onSuccess: () => { toast.success('Appointment approved'); qc.invalidateQueries(['appointments']) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to approve'),
  })

  const completeMutation = useMutation({
    mutationFn: (id) => appointmentsAPI.complete(id),
    onSuccess: () => { toast.success('Marked as completed'); qc.invalidateQueries(['appointments']) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to complete'),
  })

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }) => appointmentsAPI.cancel(id, reason),
    onSuccess: () => { toast.success('Appointment cancelled'); qc.invalidateQueries(['appointments']); setCancelModal(null) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to cancel'),
  })

  const appointments = data?.results || data || []
  const totalPages = data?.total_pages || 1

  const isStaff = ['admin', 'doctor', 'receptionist'].includes(user?.role)
  const isPatientOrStaff = user?.role === 'patient' || isStaff

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">Appointments</h1>
          <p className="section-subtitle">Manage and track all appointments</p>
        </div>
        {(user?.role === 'patient' || user?.role === 'receptionist' || user?.role === 'admin') && (
          <Link to="/appointments/book" className="btn-primary">
            <Plus size={16} /> Book Appointment
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search patient or doctor..." />
        <Select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="sm:w-48">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </Select>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        {isLoading ? <LoadingPage /> : appointments.length === 0 ? (
          <EmptyState icon={Calendar} title="No appointments found" description="No appointments match your filters." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Patient', 'Doctor', 'Date & Time', 'Reason', 'Status', 'Actions'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(appt => (
                    <tr key={appt.id} className="table-row">
                      <td className="table-cell font-medium text-slate-200">{appt.patient_name}</td>
                      <td className="table-cell text-slate-400">Dr. {appt.doctor_name}</td>
                      <td className="table-cell">
                        <div className="text-slate-300">{appt.date}</div>
                        <div className="text-slate-500 text-xs font-mono">{appt.time?.slice(0, 5)}</div>
                      </td>
                      <td className="table-cell text-slate-400 max-w-[160px] truncate">{appt.reason || '—'}</td>
                      <td className="table-cell"><StatusBadge status={appt.status} /></td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setDetailModal(appt)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
                            <Eye size={14} />
                          </button>
                          {isStaff && appt.status === 'pending' && (
                            <button onClick={() => approveMutation.mutate(appt.id)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all" title="Approve">
                              <Check size={14} />
                            </button>
                          )}
                          {isStaff && appt.status === 'approved' && user?.role !== 'receptionist' && (
                            <button onClick={() => completeMutation.mutate(appt.id)}
                              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title="Complete">
                              <Check size={14} />
                            </button>
                          )}
                          {!['cancelled', 'completed'].includes(appt.status) && (
                            <button onClick={() => { setCancelModal(appt); setCancelReason('') }}
                              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title="Cancel">
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </>
        )}
      </div>

      {/* Cancel Modal */}
      <Modal open={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel Appointment" size="sm">
        <p className="text-slate-400 text-sm mb-4">
          Cancel appointment for <strong className="text-slate-200">{cancelModal?.patient_name}</strong> on {cancelModal?.date}?
        </p>
        <div className="mb-5">
          <label className="label">Reason (optional)</label>
          <textarea
            value={cancelReason}
            onChange={e => setCancelReason(e.target.value)}
            className="input-field resize-none"
            rows={3}
            placeholder="Reason for cancellation..."
          />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setCancelModal(null)} className="btn-secondary">Keep Appointment</button>
          <button onClick={() => cancelMutation.mutate({ id: cancelModal.id, reason: cancelReason })} className="btn-danger">
            Cancel Appointment
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Appointment Details" size="md">
        {detailModal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Patient', detailModal.patient_name],
                ['Doctor', `Dr. ${detailModal.doctor_name}`],
                ['Date', detailModal.date],
                ['Time', detailModal.time?.slice(0, 5)],
                ['Specialization', detailModal.doctor_specialization || '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
                </div>
              ))}
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider">Status</p>
                <div className="mt-1"><StatusBadge status={detailModal.status} /></div>
              </div>
            </div>
            {detailModal.reason && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{detailModal.reason}</p>
              </div>
            )}
            {detailModal.notes && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{detailModal.notes}</p>
              </div>
            )}
            {detailModal.cancellation_reason && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Cancellation Reason</p>
                <p className="text-sm text-red-300 bg-red-900/20 rounded-lg p-3">{detailModal.cancellation_reason}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
