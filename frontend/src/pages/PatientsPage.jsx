import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Eye, Phone, Mail, AlertTriangle } from 'lucide-react'
import { patientsAPI } from '../services/api'
import { SearchInput, Pagination, LoadingPage, EmptyState, Modal } from '../components/common/UI'

function PatientDetailModal({ patientId, onClose }) {
  const { data: patient, isLoading } = useQuery({
    queryKey: ['patient-detail', patientId],
    queryFn: () => patientsAPI.get(patientId).then(r => r.data),
    enabled: !!patientId,
  })

  return (
    <Modal open={!!patientId} onClose={onClose} title="Patient Details" size="md">
      {isLoading ? (
        <div className="flex justify-center py-8"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : patient ? (
        <div className="space-y-5">
          {/* Header with avatar */}
          <div className="flex items-center gap-4 p-4 bg-slate-800/60 rounded-xl">
            {patient.avatar
              ? <img src={patient.avatar} className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary-500/30" alt="" />
              : <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-2xl font-bold text-white">
                  {patient.full_name?.[0]}
                </div>
            }
            <div>
              <p className="font-bold text-white text-lg">{patient.full_name}</p>
              <p className="text-slate-400 text-sm flex items-center gap-1.5"><Mail size={12} />{patient.email}</p>
              {patient.user?.phone && <p className="text-slate-500 text-xs flex items-center gap-1.5 mt-0.5"><Phone size={12} />{patient.user.phone}</p>}
            </div>
            <div className="ml-auto">
              <span className="badge bg-red-500/15 text-red-300 border border-red-500/30 text-sm px-3 py-1">
                {patient.blood_group || '—'}
              </span>
            </div>
          </div>

          {/* Basic info */}
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Age', patient.age ? `${patient.age} years` : '—'],
              ['Date of Birth', patient.date_of_birth || '—'],
              ['Insurance No.', patient.insurance_number || '—'],
              ['Address', patient.address || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Emergency contact */}
          {(patient.emergency_contact_name || patient.emergency_contact_phone) && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Emergency Contact
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500">Name</p>
                  <p className="text-sm text-slate-200 font-medium">{patient.emergency_contact_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="text-sm text-slate-200 font-medium">{patient.emergency_contact_phone || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {patient.allergies && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Allergies</p>
              <p className="text-sm text-amber-300 bg-amber-900/20 rounded-lg p-3">{patient.allergies}</p>
            </div>
          )}
          {patient.chronic_conditions && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Chronic Conditions</p>
              <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-3">{patient.chronic_conditions}</p>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}

export default function PatientsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['patients', page, search],
    queryFn: () => patientsAPI.list({ page, search: search || undefined }).then(r => r.data),
  })

  const patients = data?.results || data || []
  const totalPages = data?.total_pages || 1

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">Patients</h1>
        <p className="section-subtitle">{data?.count ?? ''} registered patients</p>
      </div>

      <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." />

      <div className="table-wrapper">
        {isLoading ? <LoadingPage /> : patients.length === 0 ? (
          <EmptyState icon={Users} title="No patients found" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {['Name', 'Email', 'Age', 'Blood Group', 'Insurance', 'Actions'].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          {p.avatar
                            ? <img src={p.avatar} className="w-7 h-7 rounded-full object-cover" alt="" />
                            : <div className="w-7 h-7 rounded-full bg-primary-600/30 flex items-center justify-center text-xs text-primary-300 font-bold">{p.full_name?.[0]}</div>
                          }
                          <span className="font-medium text-slate-200">{p.full_name}</span>
                        </div>
                      </td>
                      <td className="table-cell text-slate-400">{p.email}</td>
                      <td className="table-cell">{p.age ? `${p.age} yrs` : '—'}</td>
                      <td className="table-cell">
                        <span className="badge bg-red-500/15 text-red-300 border border-red-500/30">{p.blood_group || '—'}</span>
                      </td>
                      <td className="table-cell text-slate-400 text-xs font-mono">{p.insurance_number || '—'}</td>
                      <td className="table-cell">
                        <button onClick={() => setSelectedId(p.id)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
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

      <PatientDetailModal patientId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
