import { Loader2, ChevronLeft, ChevronRight, Search, AlertCircle } from 'lucide-react'

// ─── Loading Spinner ──────────────────────────────────────────────────────────
export function Spinner({ size = 20, className = '' }) {
  return <Loader2 size={size} className={`animate-spin text-primary-400 ${className}`} />
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Spinner size={32} className="mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────────────────────
export function ErrorState({ message = 'Something went wrong', onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <AlertCircle size={32} className="text-red-400 mb-3" />
      <p className="text-slate-300 font-medium">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 btn-secondary text-sm px-4 py-2">
          Try Again
        </button>
      )}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon size={40} className="text-slate-600 mb-4" />}
      <p className="text-slate-300 font-semibold text-lg">{title}</p>
      {description && <p className="text-slate-500 text-sm mt-1">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const statusConfig = {
  pending:    { label: 'Pending',    cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  approved:   { label: 'Approved',   cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  completed:  { label: 'Completed',  cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  cancelled:  { label: 'Cancelled',  cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  no_show:    { label: 'No Show',    cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  paid:       { label: 'Paid',       cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  unpaid:     { label: 'Unpaid',     cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  partially_paid: { label: 'Partial', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  refunded:   { label: 'Refunded',   cls: 'bg-purple-500/15 text-purple-300 border-purple-500/30' },
  active:     { label: 'Active',     cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  inactive:   { label: 'Inactive',   cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
}

export function StatusBadge({ status }) {
  const config = statusConfig[status] || { label: status, cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
  return (
    <span className={`badge border text-[11px] font-semibold ${config.cls}`}>
      {config.label}
    </span>
  )
}

// ─── Search Input ─────────────────────────────────────────────────────────────
export function SearchInput({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pl-9 py-2.5 text-sm"
      />
    </div>
  )
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-700/40">
      <p className="text-sm text-slate-500">Page {page} of {totalPages}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 
                     disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 
                     disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, size = 'md' }) {
  if (!open) return null
  const sizes = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${sizes[size]} glass-card p-6 shadow-2xl animate-slide-up`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/60 transition-all">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
export function StatCard({ label, value, icon: Icon, trend, color = 'blue', subvalue }) {
  const colors = {
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-400', border: 'border-blue-500/20' },
    green: { bg: 'bg-emerald-500/10', icon: 'text-emerald-400', border: 'border-emerald-500/20' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-400', border: 'border-amber-500/20' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400', border: 'border-purple-500/20' },
    red: { bg: 'bg-red-500/10', icon: 'text-red-400', border: 'border-red-500/20' },
  }
  const c = colors[color]
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl border ${c.bg} ${c.border}`}>
          <Icon size={18} className={c.icon} />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-white">{value}</p>
        {subvalue && <p className="text-xs text-slate-500 mt-0.5">{subvalue}</p>}
        <p className="text-sm text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  )
}

// ─── Form Field ───────────────────────────────────────────────────────────────
export function FormField({ label, error, children, required }) {
  return (
    <div>
      {label && (
        <label className="label">
          {label} {required && <span className="text-red-400">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
    </div>
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ children, className = '', ...props }) {
  return (
    <select
      {...props}
      className={`input-field ${className}`}
    >
      {children}
    </select>
  )
}

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger' }) {
  if (!open) return null
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-slate-400 text-sm mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button onClick={onClose} className="btn-secondary">Cancel</button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}