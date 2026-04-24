import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Calendar, Plus, Check, X, Eye, Trash2, ThumbsDown, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { appointmentsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import {
  StatusBadge, SearchInput, Pagination, LoadingPage,
  EmptyState, Modal, Select
} from '../components/common/UI'

function PatientInfoRow({ label, value }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
    </div>
  )
}

function ImageGallery({ images }) {
  const [idx, setIdx] = useState(0)
  if (!images?.length) return null
  return (
    <div>
      <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Uploaded Images ({images.length})</p>
      <div className="relative">
        <img
          src={images[idx]?.image_url || images[idx]?.image}
          alt={`Image ${idx + 1}`}
          className="w-full rounded-xl object-cover max-h-56 bg-slate-800"
        />
        {images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-2">
            <button onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
              className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
              <ChevronLeft size={14} />
            </button>
            <button onClick={() => setIdx(i => (i + 1) % images.length)}
              className="p-1 bg-black/50 rounded-full text-white hover:bg-black/70">
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        <div className="absolute bottom-2 right-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
          {idx + 1}/{images.length}
        </div>
      </div>
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-2">
          {images.map((img, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${i === idx ? 'border-primary-500' : 'border-transparent'}`}>
              <img src={img.image_url || img.image} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppointmentsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [cancelModal, setCancelModal] = useState(null)
  const [rejectModal, setRejectModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', page, search, statusFilter],
    queryFn: () => appointmentsAPI.list({
      page,
      search: search || undefined,
      status: statusFilter || undefined,
    }).then(r => r.data),
  })

  // Fetch full detail when modal opens
  const { data: detailData } = useQuery({
    queryKey: ['appointment-detail', detailModal?.id],
    queryFn: () => appointmentsAPI.get(detailModal.id).then(r => r.data),
    enabled: !!detailModal?.id,
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
    onSuccess: () => {
      toast.success('Appointment cancelled')
      qc.invalidateQueries(['appointments'])
      setCancelModal(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to cancel'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }) => appointmentsAPI.reject(id, reason),
    onSuccess: () => {
      toast.success('Appointment rejected')
      qc.invalidateQueries(['appointments'])
      setRejectModal(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to reject'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => appointmentsAPI.delete(id),
    onSuccess: () => { toast.success('Appointment deleted'); qc.invalidateQueries(['appointments']) },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to delete'),
  })

  const appointments = data?.results || data || []
  const totalPages = data?.total_pages || 1

  const isStaff = ['admin', 'doctor', 'receptionist'].includes(user?.role)
  const isDoctor = user?.role === 'doctor'
  const isAdmin = user?.role === 'admin'

  const detail = detailData || detailModal

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">Appointments</h1>
          <p className="section-subtitle">Manage and track all appointments</p>
        </div>
        {(user?.role === 'patient' || user?.role === 'receptionist' || isAdmin) && (
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
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {appt.patient_avatar
                            ? <img src={appt.patient_avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                            : <div className="w-7 h-7 rounded-full bg-primary-600/30 flex items-center justify-center text-xs text-primary-300 font-bold">
                                {appt.patient_name?.[0]}
                              </div>
                          }
                          <span className="font-medium text-slate-200">{appt.patient_name}</span>
                        </div>
                      </td>
                      <td className="table-cell text-slate-400">Dr. {appt.doctor_name}</td>
                      <td className="table-cell">
                        <div className="text-slate-300">{appt.date}</div>
                        <div className="text-slate-500 text-xs font-mono">{appt.time?.slice(0, 5)}</div>
                      </td>
                      <td className="table-cell text-slate-400 max-w-[140px] truncate">{appt.reason || '—'}</td>
                      <td className="table-cell"><StatusBadge status={appt.status} /></td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => setDetailModal(appt)}
                            className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all" title="View">
                            <Eye size={14} />
                          </button>
                          {isStaff && appt.status === 'pending' && (
                            <button onClick={() => approveMutation.mutate(appt.id)}
                              className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-400/10 rounded-lg transition-all" title="Approve">
                              <Check size={14} />
                            </button>
                          )}
                          {(isDoctor || isAdmin) && ['pending', 'approved'].includes(appt.status) && (
                            <button onClick={() => { setRejectModal(appt); setRejectReason('') }}
                              className="p-1.5 text-slate-400 hover:text-orange-400 hover:bg-orange-400/10 rounded-lg transition-all" title="Reject">
                              <ThumbsDown size={14} />
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
                          {(isAdmin || isDoctor) && (
                            <button onClick={() => {
                              if (window.confirm('Delete this appointment permanently?')) {
                                deleteMutation.mutate(appt.id)
                              }
                            }}
                              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all" title="Delete">
                              <Trash2 size={14} />
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
          <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)}
            className="input-field resize-none" rows={3} placeholder="Reason for cancellation..." />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setCancelModal(null)} className="btn-secondary">Keep</button>
          <button onClick={() => cancelMutation.mutate({ id: cancelModal.id, reason: cancelReason })} className="btn-danger">
            Cancel Appointment
          </button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Reject Appointment" size="sm">
        <p className="text-slate-400 text-sm mb-4">
          Reject appointment for <strong className="text-slate-200">{rejectModal?.patient_name}</strong>?
        </p>
        <div className="mb-5">
          <label className="label">Reason (optional)</label>
          <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
            className="input-field resize-none" rows={3} placeholder="Reason for rejection..." />
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => setRejectModal(null)} className="btn-secondary">Back</button>
          <button onClick={() => rejectMutation.mutate({ id: rejectModal.id, reason: rejectReason })} className="btn-danger">
            Reject
          </button>
        </div>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => setDetailModal(null)} title="Appointment Details" size="lg">
        {detail && (
          <div className="space-y-5">
            {/* Patient header */}
            <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-xl">
              {detail.patient_avatar
                ? <img src={detail.patient_avatar} className="w-14 h-14 rounded-xl object-cover ring-2 ring-primary-500/30" alt="" />
                : <div className="w-14 h-14 rounded-xl bg-primary-600/30 flex items-center justify-center text-2xl font-bold text-primary-300">
                    {detail.patient_name?.[0]}
                  </div>
              }
              <div>
                <p className="font-bold text-white text-lg">{detail.patient_name}</p>
                <p className="text-slate-400 text-sm">{detail.patient_email}</p>
                {detail.patient_phone && <p className="text-slate-500 text-xs">{detail.patient_phone}</p>}
              </div>
              <div className="ml-auto"><StatusBadge status={detail.status} /></div>
            </div>

            {/* Appointment info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <PatientInfoRow label="Doctor" value={`Dr. ${detail.doctor_name}`} />
              <PatientInfoRow label="Specialization" value={detail.doctor_specialization} />
              <PatientInfoRow label="Date" value={detail.date} />
              <PatientInfoRow label="Time" value={detail.time?.slice(0, 5)} />
              <PatientInfoRow label="Blood Group" value={detail.patient_blood_group} />
              <PatientInfoRow label="Age" value={detail.patient_age ? `${detail.patient_age} years` : null} />
            </div>

            {/* Patient extra fields */}
            {(isStaff) && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-800/40 rounded-xl">
                <PatientInfoRow label="Insurance No" value={detail.patient_insurance_number} />
                <PatientInfoRow label="Emergency Contact" value={detail.patient_emergency_contact_name} />
                <PatientInfoRow label="Emergency Phone" value={detail.patient_emergency_contact_phone} />
                <PatientInfoRow label="Address" value={detail.patient_address} />
                {detail.patient_allergies && (
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 uppercase tracking-wider">Allergies</p>
                    <p className="text-sm text-amber-300 mt-0.5">{detail.patient_allergies}</p>
                  </div>
                )}
              </div>
            )}

            {detail.reason && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Reason</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{detail.reason}</p>
              </div>
            )}
            {detail.symptoms && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Symptoms</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{detail.symptoms}</p>
              </div>
            )}
            {detail.notes && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{detail.notes}</p>
              </div>
            )}
            {detail.cancellation_reason && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Cancellation Reason</p>
                <p className="text-sm text-red-300 bg-red-900/20 rounded-lg p-3">{detail.cancellation_reason}</p>
              </div>
            )}

            {/* Images */}
            <ImageGallery images={detail.images} />

            {/* Doctor actions inside modal */}
            {(isDoctor || isAdmin) && !['cancelled', 'completed'].includes(detail.status) && (
              <div className="flex gap-2 pt-2 border-t border-slate-700/50">
                {detail.status === 'pending' && (
                  <button onClick={() => { approveMutation.mutate(detail.id); setDetailModal(null) }}
                    className="btn-primary flex-1 justify-center text-sm py-2">
                    <Check size={14} /> Approve
                  </button>
                )}
                {detail.status === 'approved' && (
                  <button onClick={() => { completeMutation.mutate(detail.id); setDetailModal(null) }}
                    className="btn-primary flex-1 justify-center text-sm py-2">
                    <Check size={14} /> Complete
                  </button>
                )}
                <button onClick={() => { setRejectModal(detail); setDetailModal(null) }}
                  className="btn-secondary flex-1 justify-center text-sm py-2 text-orange-400 border-orange-500/30 hover:bg-orange-500/10">
                  <ThumbsDown size={14} /> Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
