// DepartmentsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Building2, Plus, Pencil, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { departmentsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { LoadingPage, EmptyState, Modal, FormField, ConfirmDialog } from '../components/common/UI'

export function DepartmentsPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsAPI.list().then(r => r.data.results || r.data),
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
            <div key={dept.id} className="glass-card p-5 hover:border-slate-600/60 transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center border border-blue-500/20">
                    <Building2 size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">{dept.name}</p>
                    <p className="text-xs text-slate-500">{dept.doctor_count} doctors</p>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(dept)} className="p-1.5 text-slate-500 hover:text-primary-400 hover:bg-primary-400/10 rounded-lg transition-all">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => setDeleteTarget(dept)} className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all">
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
              {dept.description && <p className="text-sm text-slate-400 line-clamp-2">{dept.description}</p>}
              {dept.location && <p className="text-xs text-slate-500 mt-2">📍 {dept.location}</p>}
              {dept.head_doctor_name && <p className="text-xs text-primary-400 mt-1">Head: {dept.head_doctor_name}</p>}
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
    </div>
  )
}

export default DepartmentsPage
