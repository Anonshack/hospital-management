import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, Eye } from 'lucide-react'
import { patientsAPI } from '../services/api'
import { SearchInput, Pagination, LoadingPage, EmptyState, Modal, StatusBadge } from '../components/common/UI'

export default function PatientsPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState(null)

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
                      <td className="table-cell font-medium text-slate-200">{p.full_name}</td>
                      <td className="table-cell text-slate-400">{p.email}</td>
                      <td className="table-cell">{p.age ? `${p.age} yrs` : '—'}</td>
                      <td className="table-cell">
                        <span className="badge bg-red-500/15 text-red-300 border border-red-500/30">
                          {p.blood_group || '—'}
                        </span>
                      </td>
                      <td className="table-cell text-slate-400 text-xs font-mono">{p.insurance_number || '—'}</td>
                      <td className="table-cell">
                        <button onClick={() => setDetail(p)} className="p-1.5 text-slate-400 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Patient Details" size="md">
        {detail && (
          <div className="grid grid-cols-2 gap-4">
            {[
              ['Full Name', detail.full_name],
              ['Email', detail.email],
              ['Age', detail.age ? `${detail.age} years` : '—'],
              ['Blood Group', detail.blood_group || '—'],
              ['Insurance No.', detail.insurance_number || '—'],
              ['Emergency Contact', detail.emergency_contact_name || '—'],
              ['Emergency Phone', detail.emergency_contact_phone || '—'],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-slate-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-slate-200 font-medium mt-0.5">{value}</p>
              </div>
            ))}
            {detail.allergies && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Allergies</p>
                <p className="text-sm text-amber-300 bg-amber-900/20 rounded-lg p-2">{detail.allergies}</p>
              </div>
            )}
            {detail.chronic_conditions && (
              <div className="col-span-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Chronic Conditions</p>
                <p className="text-sm text-slate-300 bg-slate-800/60 rounded-lg p-2">{detail.chronic_conditions}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
