import { Link } from 'react-router-dom'
import { Activity, ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 bg-primary-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl shadow-primary-900/50">
        <Activity size={36} className="text-white" />
      </div>
      <h1 className="text-7xl font-display font-black text-white mb-4">404</h1>
      <p className="text-xl text-slate-400 mb-2">Page not found</p>
      <p className="text-slate-500 text-sm mb-8">The page you're looking for doesn't exist or you don't have access.</p>
      <Link to="/dashboard" className="btn-primary">
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
    </div>
  )
}
