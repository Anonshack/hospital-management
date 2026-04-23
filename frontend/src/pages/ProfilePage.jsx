import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { User, Lock, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { usersAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { FormField } from '../components/common/UI'

const roleColors = {
  admin: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  doctor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  nurse: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  receptionist: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  patient: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
}

export default function ProfilePage() {
  const { user, updateUser } = useAuthStore()
  const [tab, setTab] = useState('profile')

  const { register: regProfile, handleSubmit: handleProfile } = useForm({ defaultValues: user || {} })
  const { register: regPwd, handleSubmit: handlePwd, reset: resetPwd, formState: { errors: pwdErrors } } = useForm()

  const profileMutation = useMutation({
    mutationFn: (d) => usersAPI.updateMe(d),
    onSuccess: ({ data }) => {
      updateUser(data)
      toast.success('Profile updated successfully')
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to update profile'),
  })

  const pwdMutation = useMutation({
    mutationFn: (d) => usersAPI.changePassword(d),
    onSuccess: () => { toast.success('Password changed successfully'); resetPwd() },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to change password'),
  })

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="page-header">
        <h1 className="section-title">My Profile</h1>
        <p className="section-subtitle">Manage your account settings</p>
      </div>

      {/* Profile header card */}
      <div className="glass-card p-6 mb-6 flex items-center gap-5">
        <div className="w-20 h-20 bg-primary-600/20 rounded-2xl flex items-center justify-center border border-primary-500/20 flex-shrink-0">
          <User size={32} className="text-primary-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-display font-bold text-white">{user?.full_name}</h2>
          <p className="text-slate-400 text-sm">{user?.email}</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`badge border text-xs ${roleColors[user?.role]}`}>{user?.role}</span>
            {user?.is_verified && (
              <span className="badge bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs">Verified</span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl mb-6">
        {[
          { key: 'profile', label: 'Profile Info', icon: User },
          { key: 'password', label: 'Change Password', icon: Lock },
        ].map(({ key, label, icon: Icon }) => (
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

      {tab === 'profile' ? (
        <div className="glass-card p-6">
          <form onSubmit={handleProfile(d => profileMutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="First Name">
                <input {...regProfile('first_name')} className="input-field" />
              </FormField>
              <FormField label="Last Name">
                <input {...regProfile('last_name')} className="input-field" />
              </FormField>
            </div>
            <FormField label="Email">
              <input type="email" {...regProfile('email')} className="input-field" disabled />
            </FormField>
            <FormField label="Phone">
              <input {...regProfile('phone')} className="input-field" placeholder="+1234567890" />
            </FormField>
            <button type="submit" disabled={profileMutation.isPending} className="btn-primary">
              <Save size={15} /> {profileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-card p-6">
          <form onSubmit={handlePwd(d => pwdMutation.mutate(d))} className="space-y-4">
            <FormField label="Current Password" error={pwdErrors.old_password?.message}>
              <input type="password" {...regPwd('old_password', { required: 'Current password required' })} className="input-field" />
            </FormField>
            <FormField label="New Password" error={pwdErrors.new_password?.message}>
              <input type="password" {...regPwd('new_password', { required: 'New password required', minLength: { value: 8, message: 'Minimum 8 characters' } })} className="input-field" />
            </FormField>
            <FormField label="Confirm New Password" error={pwdErrors.new_password_confirm?.message}>
              <input type="password" {...regPwd('new_password_confirm', { required: 'Please confirm password' })} className="input-field" />
            </FormField>
            <button type="submit" disabled={pwdMutation.isPending} className="btn-primary">
              <Lock size={15} /> {pwdMutation.isPending ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
