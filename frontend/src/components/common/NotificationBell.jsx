import { useState } from 'react'
import { Bell, X, Check } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsAPI } from '../../services/api'
import { formatDistanceToNow } from 'date-fns'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsAPI.unreadCount().then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.list().then(r => r.data.results || r.data),
    enabled: open,
  })

  const markAllRead = useMutation({
    mutationFn: () => notificationsAPI.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries(['notifications'])
    }
  })

  const unreadCount = countData?.unread_count || 0

  const typeColors = {
    appointment_booked: 'bg-blue-500/20 text-blue-300',
    appointment_approved: 'bg-emerald-500/20 text-emerald-300',
    appointment_cancelled: 'bg-red-500/20 text-red-300',
    bill_generated: 'bg-amber-500/20 text-amber-300',
    general: 'bg-slate-500/20 text-slate-300',
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 glass-card z-50 shadow-2xl animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50">
              <h3 className="text-sm font-semibold text-white">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-slate-700/30">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell size={24} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-sm text-slate-500">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div key={n.id} className={`px-4 py-3 transition-colors ${!n.is_read ? 'bg-primary-900/10' : ''}`}>
                    <div className="flex items-start gap-3">
                      <span className={`badge text-[10px] mt-0.5 flex-shrink-0 ${typeColors[n.notification_type] || typeColors.general}`}>
                        {n.notification_type?.replace(/_/g, ' ')}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200">{n.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-primary-400 flex-shrink-0 mt-1" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
