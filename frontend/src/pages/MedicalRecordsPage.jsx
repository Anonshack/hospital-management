import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Eye, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { medicalRecordsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { SearchInput, Pagination, LoadingPage, EmptyState, Modal } from '../components/common/UI'

export default function MedicalRecordsPage() {
  const { user } = useAuthStore()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['medical-records', page, search],
    queryFn: () => medicalRecordsAPI.list({ page, search: search || undefined }).then(r => r.data),
  })

  const records = data?.results || data || []
  const totalPages = data?.total_pages || 1

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="section-title">Medical Records</h1>
          <p className="section-subtitle">Patient health history and diagnoses</p>
        </div>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search by diagnosis or patient..." />

      <div className="table-wrapper">
        {isLoading ? <LoadingPage /> : records.length === 0 ? (
          <EmptyState icon={FileText} title="No medical records found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Patient', 'Doctor', 'Diagnosis', 'Follow-up', 'Date', 'Actions'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className="table-row">
                      <td className="table-cell font-medium text-slate-200">{r.patient_name}</td>
                      <td className="table-cell text-slate-400">{r.doctor_name ? `Dr. ${r.doctor_name}` : '—'}</td>
                      <td className="table-cell text-slate-300 max-w-[200px] truncate">{r.diagnosis}</td>
                      <td className="table-cell">{r.follow_up_date || '—'}</td>
                      <td className="table-cell text-slate-500 text-xs">
                        {r.created_at ? format(new Date(r.created_at), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="table-cell">
                        <button onClick={() => setDetail(r)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
                          <Eye size={14} />
                        </button>
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Medical Record Details" size="lg">
        {detail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Patient', detail.patient_name],
                ['Doctor', detail.doctor_name ? `Dr. ${detail.doctor_name}` : '—'],
                ['Date', detail.created_at ? format(new Date(detail.created_at), 'MMMM d, yyyy') : '—'],
                ['Follow-up Date', detail.follow_up_date || 'None'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Diagnosis</p>
              <p className="text-sm text-slate-200 bg-slate-800/60 rounded-lg p-3 leading-relaxed">{detail.diagnosis}</p>
            </div>

            {detail.chief_complaint && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Chief Complaint</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{detail.chief_complaint}</p>
              </div>
            )}

            {detail.vital_signs && Object.keys(detail.vital_signs).length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Vital Signs</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(detail.vital_signs).map(([key, val]) => (
                    <div key={key} className="bg-slate-800/60 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-slate-500 capitalize">{key}</p>
                      <p className="text-sm text-slate-200 font-medium font-mono mt-0.5">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.prescriptions?.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Prescriptions ({detail.prescriptions.length})</p>
                <div className="space-y-2">
                  {detail.prescriptions.map((p, i) => (
                    <div key={i} className="bg-slate-800/60 rounded-lg p-3 flex items-start gap-3">
                      <div className="w-6 h-6 bg-blue-500/20 rounded-full flex items-center justify-center text-xs text-blue-400 font-bold flex-shrink-0">{i + 1}</div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-200">{p.medicine_name} — <span className="text-slate-400">{p.dosage}</span></p>
                        <p className="text-xs text-slate-500 mt-0.5">{p.frequency} · {p.duration}</p>
                        {p.instructions && <p className="text-xs text-amber-400 mt-1">{p.instructions}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {detail.notes && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3 leading-relaxed">{detail.notes}</p>
              </div>
            )}

            {detail.report_file_url && (
              <a href={detail.report_file_url} target="_blank" rel="noreferrer"
                className="btn-secondary w-full justify-center">
                <FileText size={14} /> Download Report
              </a>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
