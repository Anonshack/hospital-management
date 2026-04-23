import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Activity, Lock, Mail } from 'lucide-react'
import useAuthStore from '../store/authStore'

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const { login, isLoading } = useAuthStore()
  const navigate = useNavigate()

  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async (data) => {
    const result = await login(data.email, data.password)
    if (result.success) navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-gradient-to-br from-primary-900/40 via-slate-900 to-slate-950 items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-primary-600/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 max-w-md px-12 text-center">
          <div className="w-20 h-20 bg-primary-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-primary-900/50">
            <Activity size={36} className="text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold text-white mb-4">MediCore HMS</h1>
          <p className="text-slate-400 text-lg leading-relaxed">
            A comprehensive hospital management system. Streamline operations, improve patient care.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4 text-center">
            {[
              { label: 'Patients', val: '10K+' },
              { label: 'Doctors', val: '500+' },
              { label: 'Departments', val: '30+' },
            ].map(({ label, val }) => (
              <div key={label} className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <p className="text-2xl font-display font-bold text-primary-300">{val}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-display font-bold text-lg">MediCore HMS</h1>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold text-white">Welcome back</h2>
            <p className="text-slate-400 mt-2">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  {...register('email', { required: 'Email is required' })}
                  className="input-field pl-10"
                  placeholder="doctor@hospital.com"
                />
              </div>
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  {...register('password', { required: 'Password is required' })}
                  className="input-field pl-10 pr-10"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password.message}</p>}
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" className="text-sm text-primary-400 hover:text-primary-300">
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center py-3">
              {isLoading ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Signing in...</>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm mt-8">
            New patient?{' '}
            <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">
              Create an account
            </Link>
          </p>

          {/* Demo credentials */}
          <div className="mt-8 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-xs font-semibold text-slate-400 mb-2">Demo Credentials</p>
            <p className="text-xs text-slate-500">Admin: <span className="text-slate-300 font-mono">admin@hospital.com / Admin@12345</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}
