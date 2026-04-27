import { useState, useRef } from 'react'
import useLanguageStore from '../store/languageStore'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  UserCheck, Plus, ToggleLeft, ToggleRight, Upload,
  Eye, EyeOff, Copy, CheckCircle2, Key, X, Camera, Edit2, Trash2
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usersAPI, departmentsAPI } from '../services/api'
import { SearchInput, Pagination, LoadingPage, EmptyState, Modal, FormField } from '../components/common/UI'

const roleColors = {
  admin: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  doctor: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  nurse: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  receptionist: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  patient: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
}

const SPECIALIZATIONS = [
  'General Medicine', 'Cardiology', 'Neurology', 'Pediatrics',
  'Orthopedics', 'Dermatology', 'Gynecology', 'Ophthalmology',
  'Dentistry', 'Psychiatry', 'Surgery', 'ENT (Quloq-Burun-Tomoq)',
  'Urology', 'Endocrinology', 'Pulmonology', 'Gastroenterology',
  'Oncology', 'Rheumatology', 'Nephrology', 'Hematology',
]

function PasswordDisplay({ password, onClose }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(password)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm glass-card p-6 shadow-2xl animate-slide-up">
        <div className="text-center mb-5">
          <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500/30">
            <Key size={24} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-display font-semibold text-white">Hisob Yaratildi!</h3>
          <p className="text-slate-400 text-sm mt-1">Quyidagi parolni doktorgа bering</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-600/40 rounded-xl p-4 mb-4">
          <p className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Login Paroli</p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-emerald-300 font-mono text-xl font-bold tracking-widest">{password}</p>
            <button onClick={copy} className={`p-2 rounded-lg transition-all ${copied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/60 text-slate-400 hover:text-white'}`}>
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
            </button>
          </div>
        </div>
        <p className="text-xs text-amber-400/80 text-center mb-4">⚠️ Bu parolni xavfsiz joyga yozing. Keyinchalik ko'rsatilmaydi!</p>
        <button onClick={onClose} className="btn-primary w-full justify-center">Tushunarli</button>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const t = useLanguageStore(state => state.t)
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editUser, setEditUser] = useState(null)  // null = create, object = edit
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState(null)
  const [generatedPassword, setGeneratedPassword] = useState(null)
  const avatarRef = useRef()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm()
  const watchedRole = watch('role', '')

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search, roleFilter],
    queryFn: () => usersAPI.list({ page, search: search || undefined, role: roleFilter || undefined }).then(r => r.data),
  })

  const { data: departments = [] } = useQuery({
    queryKey: ['departments-list'],
    queryFn: () => departmentsAPI.list().then(r => r.data.results || r.data),
  })

  const createMutation = useMutation({
    mutationFn: (formData) => usersAPI.create(formData),
    onSuccess: (res) => {
      toast.success('Hisob muvaffaqiyatli yaratildi!')
      qc.invalidateQueries(['users'])
      setModalOpen(false)
      reset()
      setAvatarPreview(null)
    },
    onError: (e) => {
      const errorData = e.response?.data
      if (errorData?.email) {
        toast.error(`Email xatosi: ${errorData.email}`)
      } else if (errorData?.username) {
        toast.error(`Username xatosi: ${errorData.username}`)
      } else if (errorData?.detail) {
        toast.error(errorData.detail)
      } else {
        toast.error('Xatolik yuz berdi. Iltimos qaytadan urinib ko\'ring.')
      }
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => usersAPI.update(id, data),
    onSuccess: () => {
      toast.success('Foydalanuvchi yangilandi!')
      qc.invalidateQueries(['users'])
      setModalOpen(false)
      setEditUser(null)
      reset()
      setAvatarPreview(null)
    },
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Xato yuz berdi'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => usersAPI.delete(id),
    onSuccess: () => { toast.success('Foydalanuvchi o\'chirildi'); qc.invalidateQueries(['users']) },
    onError: (e) => toast.error(e.response?.data?.message || 'O\'chirishda xato'),
  })

  const activateMutation = useMutation({
    mutationFn: (id) => usersAPI.activate(id),
    onSuccess: () => { toast.success('Holat yangilandi'); qc.invalidateQueries(['users']) },
  })

  const verifyMutation = useMutation({
    mutationFn: (id) => usersAPI.verify(id),
    onSuccess: () => { toast.success('Tasdiqlash holati yangilandi'); qc.invalidateQueries(['users']) },
  })

  const promoteToAdminMutation = useMutation({
    mutationFn: (id) => usersAPI.promoteToAdmin(id),
    onSuccess: () => { toast.success('Admin qilib tayinlandi!'); qc.invalidateQueries(['users']) },
    onError: (e) => toast.error(e.response?.data?.error || 'Xatolik yuz berdi'),
  })

  const users = data?.results || data || []
  const totalPages = data?.total_pages || 1

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setAvatarPreview(URL.createObjectURL(file))
    setValue('avatar_file', file)
  }

  const openEdit = (u) => {
    setEditUser(u)
    const formData = {
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email || '',
      phone: u.phone || '',
      role: u.role || '',
      gender: u.gender || 'male',
      username: u.username || '',
    }
    
    // Add doctor profile data if exists
    if (u.role === 'doctor' && u.doctor_profile) {
      formData.specialization = u.doctor_profile.specialization || ''
      formData.experience_years = u.doctor_profile.experience_years || 0
      formData.consultation_fee = u.doctor_profile.consultation_fee || 0
      formData.license_number = u.doctor_profile.license_number || ''
      formData.bio = u.doctor_profile.bio || ''
      formData.department = u.doctor_profile.department || ''
    }
    
    reset(formData)
    setAvatarPreview(u.avatar || null)
    setModalOpen(true)
  }

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#'
    let pwd = ''
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    setValue('password', pwd)
    setValue('password_confirm', pwd)
  }

  const onSubmit = (data) => {
    // Prevent double submission
    if (createMutation.isPending || updateMutation.isPending) {
      return
    }

    if (!editUser && data.password !== data.password_confirm) {
      toast.error('Parollar mos kelmadi!')
      return
    }

    const formData = new FormData()
    formData.append('email', data.email)
    formData.append('username', data.username || data.email.split('@')[0])
    formData.append('first_name', data.first_name)
    formData.append('last_name', data.last_name)
    formData.append('role', data.role)
    formData.append('phone', data.phone || '')
    formData.append('gender', data.gender || 'male')
    if (data.avatar_file) formData.append('avatar', data.avatar_file)

    if (editUser) {
      // Add doctor fields for edit mode too
      if (data.role === 'doctor') {
        formData.append('specialization', data.specialization || '')
        formData.append('experience_years', data.experience_years || 0)
        formData.append('consultation_fee', data.consultation_fee || 0)
        formData.append('license_number', data.license_number || '')
        formData.append('bio', data.bio || '')
        if (data.department) formData.append('department', data.department)
      }
      updateMutation.mutate({ id: editUser.id, data: formData })
      return
    }

    if (data.age) formData.append('age', data.age)
    formData.append('password', data.password)

    if (data.role === 'doctor') {
      formData.append('specialization', data.specialization || '')
      formData.append('experience_years', data.experience_years || 0)
      formData.append('consultation_fee', data.consultation_fee || 0)
      formData.append('license_number', data.license_number || '')
      formData.append('bio', data.bio || '')
      if (data.department) formData.append('department', data.department)
    }

    createMutation.mutate(formData)
    setGeneratedPassword(data.password)
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">{t('userManagement')}</h1>
          <p className="section-subtitle">{t('allStaff')}</p>
        </div>
        <button onClick={() => { reset(); setAvatarPreview(null); setEditUser(null); setModalOpen(true) }} className="btn-primary">
          <Plus size={16} /> {t('newEmployee')}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder={t('searchByNameOrEmail')} />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="input-field sm:w-44">
          <option value="">{t('allRoles')}</option>
          <option value="doctor">{t('doctor')}</option>
          <option value="nurse">{t('nurse')}</option>
          <option value="receptionist">{t('receptionist')}</option>
          <option value="patient">{t('patient')}</option>
        </select>
      </div>

      <div className="table-wrapper">
        {isLoading ? <LoadingPage /> : users.length === 0 ? (
          <EmptyState icon={UserCheck} title={t('noData')} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    {[t('username'), t('email'), t('role'), t('phone'), t('verified'), t('active'), t('createdAt'), t('actions')].map(h => (
                      <th key={h} className="table-header">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="table-row">
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          {u.avatar
                            ? <img src={u.avatar} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
                            : <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-400">
                                {u.first_name?.[0]}{u.last_name?.[0]}
                              </div>
                          }
                          <span className="font-medium text-slate-200 text-sm">{u.full_name}</span>
                        </div>
                      </td>
                      <td className="table-cell text-slate-400 text-xs">{u.email}</td>
                      <td className="table-cell">
                        <span className={`badge border text-[10px] font-semibold ${roleColors[u.role] || ''}`}>{u.role}</span>
                      </td>
                      <td className="table-cell text-slate-500 text-xs">{u.phone || '—'}</td>
                      <td className="table-cell">
                        <button onClick={() => verifyMutation.mutate(u.id)} className={`badge border text-[10px] cursor-pointer hover:opacity-80 transition-opacity ${u.is_verified ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' : 'bg-slate-500/15 text-slate-400 border-slate-500/30'}`}>
                          {u.is_verified ? `✓ ${t('verified')}` : t('noData')}
                        </button>
                      </td>
                      <td className="table-cell">
                        <button onClick={() => activateMutation.mutate(u.id)} className="text-slate-400 hover:text-primary-400 transition-colors">
                          {u.is_active ? <ToggleRight size={22} className="text-emerald-400" /> : <ToggleLeft size={22} />}
                        </button>
                      </td>
                      <td className="table-cell text-slate-500 text-xs">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          {u.role !== 'admin' && (
                            <button
                              onClick={() => {
                                if (window.confirm(`"${u.full_name}" ${t('confirmPromoteAdmin')}`))
                                  promoteToAdminMutation.mutate(u.id)
                              }}
                              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-400/10 rounded-lg transition-all"
                              title={t('promoteToAdmin')}
                            >
                              👑
                            </button>
                          )}
                          <button onClick={() => openEdit(u)} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-all" title={t('edit')}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => {
                            if (window.confirm(`"${u.full_name}" ${t('confirmDeleteUser')}`)) deleteMutation.mutate(u.id)
                          }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all" title={t('delete')}>
                            <Trash2 size={14} />
                          </button>
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

      {/* Create User Modal */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setAvatarPreview(null); setEditUser(null) }} title={editUser ? t('editUser') : t('newEmployee')} size="xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

          {/* Rol */}
          <FormField label={t('role')} error={errors.role?.message} required>
            <select {...register('role', { required: t('required') })} className="input-field" disabled={!!editUser}>
              <option value="">{t('role')}...</option>
              <option value="admin">👑 {t('admin')}</option>
              <option value="doctor">👨‍⚕️ {t('doctor')}</option>
              <option value="nurse">👩‍⚕️ {t('nurse')}</option>
              <option value="receptionist">💼 {t('receptionist')}</option>
            </select>
          </FormField>

          {/* Avatar */}
          <div className="flex items-center gap-5">
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-600 flex items-center justify-center overflow-hidden">
                {avatarPreview
                  ? <img src={avatarPreview} className="w-full h-full object-cover" alt="" />
                  : <Camera size={24} className="text-slate-600" />
                }
              </div>
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center border-2 border-slate-900 hover:bg-primary-500 transition-colors"
              >
                <Upload size={12} className="text-white" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </div>
            <div className="text-sm text-slate-400">
              <p className="font-medium text-slate-300 mb-1">{t('profileImage')}</p>
              <p className="text-xs">JPG, PNG, GIF — max 5MB</p>
              <p className="text-xs text-slate-500">{t('imageOptional')}</p>
            </div>
          </div>

          {/* Asosiy ma'lumotlar */}
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Ism" error={errors.first_name?.message} required>
              <input {...register('first_name', { required: 'Ism kiriting' })} className="input-field" placeholder="Dilshod" />
            </FormField>
            <FormField label="Familiya" error={errors.last_name?.message} required>
              <input {...register('last_name', { required: 'Familiya kiriting' })} className="input-field" placeholder="Yusupov" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Email" error={errors.email?.message} required>
              <input type="email" {...register('email', { required: 'Email kiriting' })} className="input-field" placeholder="doctor@klinika.uz" />
            </FormField>
            <FormField label="Telefon" error={errors.phone?.message} required>
              <input {...register('phone', { required: 'Telefon kiriting' })} className="input-field" placeholder="+998901234567" />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Yosh">
              <input type="number" min="18" max="80" {...register('age')} className="input-field" placeholder="35" />
            </FormField>
            <FormField label="Jins" required={!editUser}>
              <select {...register('gender', { required: !editUser ? 'Jins tanlang' : false })} className="input-field" disabled={!!editUser}>
                <option value="">Tanlang...</option>
                <option value="male">Erkak</option>
                <option value="female">Ayol</option>
              </select>
            </FormField>
          </div>

          <FormField label="Username">
            <input {...register('username')} className="input-field" placeholder="Avtomatik email dan" />
          </FormField>

          {/* Doctor uchun qo'shimcha */}
          {watchedRole === 'doctor' && (
            <div className="border border-blue-500/20 rounded-2xl p-5 bg-blue-500/5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <span className="text-xs">👨‍⚕️</span>
                </div>
                <p className="text-xs font-bold text-blue-400 uppercase tracking-wider">Doktor Ma'lumotlari</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Mutaxassislik" error={errors.specialization?.message} required>
                  <select {...register('specialization', { required: watchedRole === 'doctor' ? 'Mutaxassislik tanlang' : false })} className="input-field">
                    <option value="">Tanlang...</option>
                    {SPECIALIZATIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </FormField>
                <FormField label="Bo'lim (Department)">
                  <select {...register('department')} className="input-field">
                    <option value="">Bo'lim tanlang...</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Tajriba (yil)">
                  <input type="number" min="0" max="60" {...register('experience_years')} className="input-field" placeholder="5" />
                </FormField>
                <FormField label="Konsultatsiya ($)">
                  <input type="number" min="0" {...register('consultation_fee')} className="input-field" placeholder="50" />
                </FormField>
                <FormField label="Litsenziya">
                  <input {...register('license_number')} className="input-field" placeholder="LIC-12345" />
                </FormField>
              </div>

              <FormField label="Malumot / Bio">
                <textarea
                  {...register('bio')}
                  className="input-field resize-none"
                  rows={3}
                  placeholder="Doktor haqida qisqa ma'lumot, ixtisoslik yo'nalishlari..."
                />
              </FormField>
            </div>
          )}

          {/* Parol */}
          {!editUser && (
          <div className="border border-slate-700/40 rounded-2xl p-5 bg-slate-800/30 space-y-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Key size={13} /> Login Paroli
              </p>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-primary-400 hover:text-primary-300 transition-colors flex items-center gap-1"
              >
                🎲 Avtomatik yaratish
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Parol" error={errors.password?.message} required>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    {...register('password', {
                      required: 'Parol kiriting',
                      minLength: { value: 8, message: 'Minimum 8 ta belgi' }
                    })}
                    className="input-field pr-10"
                    placeholder="Min 8 ta belgi"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>
              <FormField label="Parolni tasdiqlang" error={errors.password_confirm?.message} required>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    {...register('password_confirm', { required: 'Parolni tasdiqlang' })}
                    className="input-field pr-10"
                    placeholder="Takrorlang"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
              <p className="text-xs text-amber-400">💡 Bu parolni doktorgа bering — tizimga kirish uchun ishlatadi. Keyinchalik ko'rsatilmaydi!</p>
            </div>
          </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModalOpen(false); setAvatarPreview(null); setEditUser(null) }} className="btn-secondary flex-1 justify-center">
              Bekor qilish
            </button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary flex-1 justify-center">
              {(createMutation.isPending || updateMutation.isPending) ? 'Saqlanmoqda...' : (editUser ? 'Saqlash' : 'Hisob Yaratish')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Password Display Modal */}
      {generatedPassword && (
        <PasswordDisplay password={generatedPassword} onClose={() => setGeneratedPassword(null)} />
      )}
    </div>
  )
}