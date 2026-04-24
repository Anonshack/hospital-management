import { useState, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  User, Lock, Save, Camera, Stethoscope, Heart,
  Mail, Phone, Award, FileText, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { usersAPI, doctorsAPI, patientsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { FormField } from '../components/common/UI'

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  doctor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  nurse: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  receptionist: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  patient: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']

function AvatarUpload({ currentAvatar, onUpload, loading }) {
  const fileRef = useRef()
  const [preview, setPreview] = useState(null)

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Rasm 5MB dan kichik bo'lishi kerak")
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    onUpload(file)
  }

  const src = preview || currentAvatar

  return (
    <div className="relative group w-24 h-24 flex-shrink-0">
      <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-600/50 group-hover:border-primary-500/50 transition-all">
        {src ? (
          <img src={src} alt="avatar" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-primary-600/20 flex items-center justify-center">
            <User size={36} className="text-primary-400" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-2xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
      >
        <Camera size={22} className="text-white" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  )
}

function DoctorProfileTab({ user }) {
  const qc = useQueryClient()
  const { updateUser } = useAuthStore()
  const [avatarFile, setAvatarFile] = useState(null)

  const { data: doctorData } = useQuery({
    queryKey: ['doctor-me'],
    queryFn: () => doctorsAPI.getMe().then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      specialization: '',
      qualification: '',
      experience_years: 0,
      consultation_fee: 0,
      bio: '',
      license_number: '',
    },
    values: doctorData ? {
      first_name: doctorData.user?.first_name || '',
      last_name: doctorData.user?.last_name || '',
      phone: doctorData.phone || '',
      specialization: doctorData.specialization || '',
      qualification: doctorData.qualification || '',
      experience_years: doctorData.experience_years || 0,
      consultation_fee: doctorData.consultation_fee || 0,
      bio: doctorData.bio || '',
      license_number: doctorData.license_number || '',
    } : undefined,
  })

  const mutation = useMutation({
    mutationFn: (fd) => doctorsAPI.updateMe(fd),
    onSuccess: ({ data }) => {
      toast.success("Profil yangilandi!")
      qc.invalidateQueries(['doctor-me'])
      // Sync avatar and name to auth store so header updates immediately
      if (data.avatar) updateUser({ avatar: data.avatar })
      if (data.full_name) updateUser({ full_name: data.full_name })
    },
    onError: (e) => {
      const msg = e.response?.data?.message || e.response?.data?.detail || 'Xato yuz berdi'
      toast.error(msg)
    },
  })

  const onSubmit = (formData) => {
    const fd = new FormData()
    if (avatarFile) fd.append('avatar', avatarFile)
    fd.append('first_name', formData.first_name)
    fd.append('last_name', formData.last_name)
    if (formData.phone) fd.append('phone', formData.phone)
    fd.append('specialization', formData.specialization)
    fd.append('qualification', formData.qualification)
    fd.append('experience_years', formData.experience_years)
    fd.append('consultation_fee', formData.consultation_fee)
    fd.append('bio', formData.bio)
    fd.append('license_number', formData.license_number)
    mutation.mutate(fd)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Avatar + Name */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <User size={14} /> Shaxsiy Ma'lumotlar
        </h3>
        <div className="flex items-start gap-5">
          <AvatarUpload
            currentAvatar={doctorData?.avatar}
            onUpload={setAvatarFile}
            loading={mutation.isPending}
          />
          <div className="flex-1 grid grid-cols-2 gap-3">
            <FormField label="Ism" error={errors.first_name?.message}>
              <input {...register('first_name', { required: 'Ism kiritilishi shart' })} className="input-field" />
            </FormField>
            <FormField label="Familiya" error={errors.last_name?.message}>
              <input {...register('last_name', { required: 'Familiya kiritilishi shart' })} className="input-field" />
            </FormField>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <FormField label="Email (o'zgartirib bo'lmaydi)">
            <div className="input-field opacity-60 cursor-not-allowed flex items-center gap-2 text-slate-400">
              <Mail size={14} /> {doctorData?.email || user?.email}
            </div>
          </FormField>
          <FormField label="Telefon">
            <input {...register('phone')} className="input-field" placeholder="+998901234567" />
          </FormField>
        </div>
      </div>

      {/* Doctor Info */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Stethoscope size={14} /> Shifokor Ma'lumotlari
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Mutaxassislik" error={errors.specialization?.message}>
            <input
              {...register('specialization', { required: 'Mutaxassislik kiritilishi shart' })}
              className="input-field"
              placeholder="Kardiolog, Nevrolog..."
            />
          </FormField>
          <FormField label="Malaka">
            <input {...register('qualification')} className="input-field" placeholder="MD, PhD..." />
          </FormField>
          <FormField label="Tajriba (yil)">
            <input
              type="number"
              min="0"
              {...register('experience_years')}
              className="input-field"
            />
          </FormField>
          <FormField label="Konsultatsiya narxi ($)">
            <input
              type="number"
              min="0"
              step="0.01"
              {...register('consultation_fee')}
              className="input-field"
            />
          </FormField>
          <FormField label="Litsenziya raqami" className="col-span-2">
            <input {...register('license_number')} className="input-field" placeholder="MED-XXXXX" />
          </FormField>
        </div>
        <FormField label="Bio" className="mt-3">
          <textarea
            {...register('bio')}
            rows={4}
            className="input-field resize-none"
            placeholder="O'zingiz haqingizda qisqacha yozing..."
          />
        </FormField>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="btn-primary w-full justify-center py-3"
      >
        <Save size={15} />
        {mutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </form>
  )
}

function PatientProfileTab({ user }) {
  const qc = useQueryClient()
  const { updateUser } = useAuthStore()
  const [avatarFile, setAvatarFile] = useState(null)

  const { data: patientData } = useQuery({
    queryKey: ['patient-me'],
    queryFn: () => patientsAPI.getMe().then(r => r.data),
  })

  const { register, handleSubmit, formState: { errors } } = useForm({
    values: patientData ? {
      first_name: patientData.user?.first_name || '',
      last_name: patientData.user?.last_name || '',
      phone: patientData.user?.phone || '',
      blood_group: patientData.blood_group || 'Unknown',
      date_of_birth: patientData.date_of_birth || '',
      address: patientData.address || '',
      allergies: patientData.allergies || '',
      chronic_conditions: patientData.chronic_conditions || '',
      emergency_contact_name: patientData.emergency_contact_name || '',
      emergency_contact_phone: patientData.emergency_contact_phone || '',
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (fd) => patientsAPI.updateMe(fd),
    onSuccess: ({ data }) => {
      toast.success("Profil yangilandi!")
      qc.invalidateQueries(['patient-me'])
      if (data.avatar) updateUser({ avatar: data.avatar })
    },
    onError: (e) => {
      toast.error(e.response?.data?.message || 'Xato yuz berdi')
    },
  })

  const onSubmit = (formData) => {
    const fd = new FormData()
    if (avatarFile) fd.append('avatar', avatarFile)
    fd.append('first_name', formData.first_name)
    fd.append('last_name', formData.last_name)
    if (formData.phone) fd.append('phone', formData.phone)
    fd.append('blood_group', formData.blood_group)
    if (formData.date_of_birth) fd.append('date_of_birth', formData.date_of_birth)
    fd.append('address', formData.address)
    fd.append('allergies', formData.allergies)
    fd.append('chronic_conditions', formData.chronic_conditions)
    fd.append('emergency_contact_name', formData.emergency_contact_name)
    fd.append('emergency_contact_phone', formData.emergency_contact_phone)
    mutation.mutate(fd)
  }

  const avatar = patientData?.user?.avatar_url || patientData?.user?.avatar

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <User size={14} /> Shaxsiy Ma'lumotlar
        </h3>
        <div className="flex items-start gap-5">
          <AvatarUpload
            currentAvatar={avatar}
            onUpload={setAvatarFile}
            loading={mutation.isPending}
          />
          <div className="flex-1 grid grid-cols-2 gap-3">
            <FormField label="Ism">
              <input {...register('first_name')} className="input-field" />
            </FormField>
            <FormField label="Familiya">
              <input {...register('last_name')} className="input-field" />
            </FormField>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-3">
          <FormField label="Email (o'zgartirib bo'lmaydi)">
            <div className="input-field opacity-60 cursor-not-allowed flex items-center gap-2 text-slate-400">
              <Mail size={14} /> {patientData?.email || user?.email}
            </div>
          </FormField>
          <FormField label="Telefon">
            <input {...register('phone')} className="input-field" placeholder="+998901234567" />
          </FormField>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Heart size={14} /> Tibbiy Ma'lumotlar
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Qon guruhi">
            <select {...register('blood_group')} className="input-field">
              {BLOOD_GROUPS.map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Tug'ilgan sana">
            <input type="date" {...register('date_of_birth')} className="input-field" />
          </FormField>
          <FormField label="Manzil" className="col-span-2">
            <input {...register('address')} className="input-field" placeholder="Shahar, ko'cha, uy..." />
          </FormField>
          <FormField label="Allergiyalar">
            <textarea {...register('allergies')} rows={2} className="input-field resize-none" placeholder="Dori yoki ovqat allergiyalari..." />
          </FormField>
          <FormField label="Surunkali kasalliklar">
            <textarea {...register('chronic_conditions')} rows={2} className="input-field resize-none" placeholder="Diabet, gipertoniya..." />
          </FormField>
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <AlertCircle size={14} /> Favqulodda Aloqa
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Ism familiya">
            <input {...register('emergency_contact_name')} className="input-field" placeholder="Yaqin kishingiz ismi..." />
          </FormField>
          <FormField label="Telefon">
            <input {...register('emergency_contact_phone')} className="input-field" placeholder="+998..." />
          </FormField>
        </div>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="btn-primary w-full justify-center py-3"
      >
        <Save size={15} />
        {mutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </form>
  )
}

function GeneralProfileTab({ user }) {
  const { updateUser } = useAuthStore()
  const [avatarFile, setAvatarFile] = useState(null)

  const { register, handleSubmit } = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
    },
  })

  const mutation = useMutation({
    mutationFn: (fd) => usersAPI.updateMe(fd),
    onSuccess: ({ data }) => {
      updateUser(data)
      toast.success("Profil yangilandi!")
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Xato yuz berdi'),
  })

  const onSubmit = (formData) => {
    const fd = new FormData()
    if (avatarFile) fd.append('avatar', avatarFile)
    fd.append('first_name', formData.first_name)
    fd.append('last_name', formData.last_name)
    if (formData.phone) fd.append('phone', formData.phone)
    mutation.mutate(fd)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="glass-card p-6 space-y-4">
      <div className="flex items-start gap-5 mb-2">
        <AvatarUpload
          currentAvatar={user?.avatar}
          onUpload={setAvatarFile}
          loading={mutation.isPending}
        />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <FormField label="Ism">
            <input {...register('first_name')} className="input-field" />
          </FormField>
          <FormField label="Familiya">
            <input {...register('last_name')} className="input-field" />
          </FormField>
        </div>
      </div>
      <FormField label="Email (o'zgartirib bo'lmaydi)">
        <div className="input-field opacity-60 cursor-not-allowed flex items-center gap-2 text-slate-400">
          <Mail size={14} /> {user?.email}
        </div>
      </FormField>
      <FormField label="Telefon">
        <input {...register('phone')} className="input-field" placeholder="+998901234567" />
      </FormField>
      <button type="submit" disabled={mutation.isPending} className="btn-primary">
        <Save size={15} /> {mutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
      </button>
    </form>
  )
}

export default function ProfilePage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('profile')

  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm()

  const pwdMutation = useMutation({
    mutationFn: (d) => usersAPI.changePassword(d),
    onSuccess: () => { toast.success("Parol muvaffaqiyatli o'zgartirildi!"); resetPwd() },
    onError: (e) => toast.error(e.response?.data?.message || "Parolni o'zgartirishda xato"),
  })

  const tabs = [
    { key: 'profile', label: 'Profil', icon: User },
    { key: 'password', label: 'Parol', icon: Lock },
  ]

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">Mening Profilim</h1>
        <p className="section-subtitle">Shaxsiy ma'lumotlarni boshqaring</p>
      </div>

      {/* Profile header */}
      <div className="glass-card p-5 mb-6 flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden border border-slate-600/40 flex-shrink-0">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-primary-600/20 flex items-center justify-center">
              <User size={28} className="text-primary-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-display font-bold text-white">{user?.full_name}</h2>
          <p className="text-slate-400 text-sm">{user?.email}</p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap">
            <span className={`badge border text-xs ${roleColors[user?.role]}`}>{user?.role}</span>
            {user?.is_verified && (
              <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs">Tasdiqlangan</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl mb-6">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all
              ${tab === key ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <>
          {user?.role === 'doctor' && <DoctorProfileTab user={user} />}
          {user?.role === 'patient' && <PatientProfileTab user={user} />}
          {!['doctor', 'patient'].includes(user?.role) && <GeneralProfileTab user={user} />}
        </>
      )}

      {tab === 'password' && (
        <div className="glass-card p-6">
          <form onSubmit={handlePwd(d => pwdMutation.mutate(d))} className="space-y-4">
            <FormField label="Joriy parol" error={pwdErrors.old_password?.message}>
              <input
                type="password"
                {...regPwd('old_password', { required: 'Joriy parol kiritilishi shart' })}
                className="input-field"
              />
            </FormField>
            <FormField label="Yangi parol" error={pwdErrors.new_password?.message}>
              <input
                type="password"
                {...regPwd('new_password', {
                  required: 'Yangi parol kiritilishi shart',
                  minLength: { value: 8, message: 'Kamida 8 ta belgi' }
                })}
                className="input-field"
              />
            </FormField>
            <FormField label="Yangi parolni tasdiqlang" error={pwdErrors.new_password_confirm?.message}>
              <input
                type="password"
                {...regPwd('new_password_confirm', { required: 'Parolni tasdiqlang' })}
                className="input-field"
              />
            </FormField>
            <button type="submit" disabled={pwdMutation.isPending} className="btn-primary">
              <Lock size={15} /> {pwdMutation.isPending ? "O'zgartirilmoqda..." : "Parolni O'zgartirish"}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
