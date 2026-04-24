// DepartmentsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil, Trash2, Users, MapPin, Phone, Stethoscope, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { departmentsAPI, doctorsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { LoadingPage, EmptyState, Modal, FormField, ConfirmDialog } from '../components/common/UI'

export function DepartmentsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [selectedDept, setSelectedDept] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsAPI.list().then(r => r.data.results || r.data),
  })

  const { data: deptDoctors, isLoading: loadingDoctors } = useQuery({
    queryKey: ['dept-doctors', selectedDept?.id],
    queryFn: () => doctorsAPI.list({ department: selectedDept.id }).then(r => r.data.results || r.data),
    enabled: !!selectedDept,
  })

  const { register, handleSubmit, reset, formState: { errors } } = useForm()

  const saveMutation = useMutation({
    mutationFn: (d) => editing
      ? departmentsAPI.update(editing.id, d)
      : departmentsAPI.create(d),
    onSuccess: () => {
      toast.success(editing ? 'Department updated' : 'Department created')
      qc.invalidateQueries(['departments'])
      setModalOpen(false); setEditing(null); reset()
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to save'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => departmentsAPI.delete(id),
    onSuccess: () => { toast.success('Department deleted'); qc.invalidateQueries(['departments']) },
  })

  const openCreate = () => { setEditing(null); reset(); setModalOpen(true) }
  const openEdit = (dept) => { setEditing(dept); reset(dept); setModalOpen(true) }

  const departments = data || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">Departments</h1>
          <p className="section-subtitle">{departments.length} departments</p>
        </div>
        {user?.role === 'admin' && (
          <button onClick={openCreate} className="btn-primary"><Plus size={16} /> Add Department</button>
        )}
      </div>

      {isLoading ? <LoadingPage /> : departments.length === 0 ? (
        <EmptyState icon={Building2} title="No departments found" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {departments.map(dept => (
            <div 
              key={dept.id} 
              onClick={() => setSelectedDept(dept)}
              className="glass-card p-5 hover:border-primary-500/30 transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center border border-blue-400/20 group-hover:scale-105 transition-transform">
                    <Building2 size={22} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-base truncate">{dept.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Users size={12} />
                        {dept.doctor_count} doktor
                      </span>
                    </div>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => openEdit(dept)} className="p-1.5 text-slate-500 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(dept)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              
              {dept.description && (
                <p className="text-sm text-slate-400 line-clamp-2 mb-3">{dept.description}</p>
              )}
              
              <div className="space-y-1.5 pt-3 border-t border-slate-700/40">
                {dept.location && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <MapPin size={13} className="flex-shrink-0" />
                    <span className="truncate">{dept.location}</span>
                  </div>
                )}
                {dept.contact_number && (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Phone size={13} className="flex-shrink-0" />
                    <span>{dept.contact_number}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Department' : 'New Department'} size="sm">
        <form onSubmit={handleSubmit(d => saveMutation.mutate(d))} className="space-y-4">
          <FormField label="Name" error={errors.name?.message} required>
            <input {...register('name', { required: 'Name is required' })} className="input-field" placeholder="Department name" />
          </FormField>
          <FormField label="Description">
            <textarea {...register('description')} className="input-field resize-none" rows={3} placeholder="Brief description..." />
          </FormField>
          <FormField label="Location">
            <input {...register('location')} className="input-field" placeholder="e.g. Floor 2, Wing B" />
          </FormField>
          <FormField label="Contact Number">
            <input {...register('contact_number')} className="input-field" placeholder="+1234567890" />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" disabled={saveMutation.isPending} className="btn-primary flex-1 justify-center">
              {saveMutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteMutation.mutate(deleteTarget.id); setDeleteTarget(null) }}
        title="Delete Department"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />

      {/* Department Detail Modal */}
      {selectedDept && (
        <Modal open={!!selectedDept} onClose={() => setSelectedDept(null)} title="Bo'lim Ma'lumotlari" size="lg">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center border border-blue-400/20 flex-shrink-0">
                <Building2 size={28} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white">{selectedDept.name}</h3>
                {selectedDept.description && (
                  <p className="text-slate-400 mt-2 text-sm leading-relaxed">{selectedDept.description}</p>
                )}
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedDept.location && (
                <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  <MapPin size={18} className="text-blue-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Joylashuv</p>
                    <p className="text-sm text-slate-200 truncate">{selectedDept.location}</p>
                  </div>
                </div>
              )}
              
              {selectedDept.contact_number && (
                <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  <Phone size={18} className="text-emerald-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Telefon</p>
                    <p className="text-sm text-slate-200">{selectedDept.contact_number}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Doctors List */}
            <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
              <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Stethoscope size={16} className="text-primary-400" />
                Doktorlar ({selectedDept.doctor_count})
              </h4>
              
              {loadingDoctors ? (
                <div className="text-center py-4 text-slate-400 text-sm">Yuklanmoqda...</div>
              ) : !deptDoctors || deptDoctors.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-sm">Bu bo'limda doktorlar yo'q</div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {deptDoctors.map(doctor => (
                    <div key={doctor.id} className="flex items-center gap-3 p-3 bg-slate-900/40 rounded-lg hover:bg-slate-900/60 transition-colors">
                      {doctor.avatar ? (
                        <img src={doctor.avatar} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt={doctor.full_name} />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center flex-shrink-0">
                          <Stethoscope size={18} className="text-primary-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{doctor.full_name}</p>
                        <p className="text-xs text-slate-400 truncate">{doctor.specialization}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-500">{doctor.experience_years} yil</p>
                        <p className="text-xs text-emerald-400">${doctor.consultation_fee}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button 
              onClick={() => setSelectedDept(null)} 
              className="btn-secondary w-full justify-center"
            >
              Yopish
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

export default DepartmentsPage
