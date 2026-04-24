import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Clock, Save, Info, CheckCircle, Calendar, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay } from 'date-fns'
import toast from 'react-hot-toast'
import { doctorsAPI } from '../services/api'
import { LoadingPage } from '../components/common/UI'

const DAYS = [
  { id: 0, name: 'Monday',    uz: 'Dushanba' },
  { id: 1, name: 'Tuesday',   uz: 'Seshanba' },
  { id: 2, name: 'Wednesday', uz: 'Chorshanba' },
  { id: 3, name: 'Thursday',  uz: 'Payshanba' },
  { id: 4, name: 'Friday',    uz: 'Juma' },
  { id: 5, name: 'Saturday',  uz: 'Shanba' },
  { id: 6, name: 'Sunday',    uz: 'Yakshanba' },
]

const MONTHS_UZ = [
  'Yanvar','Fevral','Mart','Aprel','May','Iyun',
  'Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'
]

function generateSlots(start, end, duration) {
  const slots = []
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let current = sh * 60 + sm
  const endMin = eh * 60 + em
  while (current + duration <= endMin) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += duration
  }
  return slots
}

function formatDate(date) {
  return `${date.getDate()} ${MONTHS_UZ[date.getMonth()]}`
}

export default function DoctorSchedulePage() {
  const qc = useQueryClient()
  const [schedule, setSchedule] = useState({})
  const [saved, setSaved] = useState(false)
  // Current week — Mon = index 0
  const [weekOffset, setWeekOffset] = useState(0)

  // Calculate week dates based on offset
  const today = new Date()
  const currentWeekStart = startOfWeek(
    addWeeks(today, weekOffset),
    { weekStartsOn: 1 } // Monday
  )
  const weekDates = DAYS.map((_, i) => addDays(currentWeekStart, i))

  const { data: savedSchedule, isLoading } = useQuery({
    queryKey: ['my-schedule'],
    queryFn: () => doctorsAPI.getMySchedule().then(r => r.data),
  })

  useEffect(() => {
    if (savedSchedule) {
      const map = {}
      savedSchedule.forEach(s => {
        map[s.day_of_week] = {
          active: s.is_active,
          start: s.start_time?.slice(0, 5) || '09:00',
          end: s.end_time?.slice(0, 5) || '18:00',
          slot_duration: s.slot_duration || 30,
        }
      })
      setSchedule(map)
    }
  }, [savedSchedule])

  const saveMutation = useMutation({
    mutationFn: (data) => doctorsAPI.saveMySchedule(data),
    onSuccess: (res) => {
      toast.success('Jadval muvaffaqiyatli saqlandi!')
      qc.invalidateQueries(['my-schedule'])
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
    onError: (err) => {
      // Don't show generic error if data was saved (backend bug workaround)
      const serverMsg = err.response?.data?.message
      const details = err.response?.data?.details
      if (details && Array.isArray(details) && details.length > 0) {
        toast.error(`Validatsiya xatosi: ${details[0].message}`)
      } else if (serverMsg && serverMsg !== 'An unexpected error occurred. Please try again later.') {
        toast.error(serverMsg)
      } else {
        // Refresh anyway in case data was partially saved
        qc.invalidateQueries(['my-schedule'])
        toast.error('Jadval saqlanishida muammo yuz berdi. Sahifani yangilang.')
      }
    },
  })

  const deleteDayMutation = useMutation({
    mutationFn: (dayId) => doctorsAPI.deleteScheduleDay(dayId),
    onSuccess: (_, dayId) => {
      toast.success("Kun jadvali o'chirildi")
      setSchedule(prev => {
        const next = { ...prev }
        delete next[dayId]
        return next
      })
      qc.invalidateQueries(['my-schedule'])
    },
    onError: () => toast.error("O'chirishda xato yuz berdi"),
  })

  const toggleDay = (dayId) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: prev[dayId]
        ? { ...prev[dayId], active: !prev[dayId].active }
        : { active: true, start: '09:00', end: '18:00', slot_duration: 30 }
    }))
  }

  const updateDay = (dayId, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [dayId]: { ...prev[dayId], [field]: value }
    }))
  }

  const handleSave = () => {
    const data = Object.entries(schedule)
      .filter(([_, val]) => val)
      .map(([dayId, val]) => ({
        day_of_week: parseInt(dayId),
        start_time: val.start + ':00',
        end_time: val.end + ':00',
        is_active: val.active ?? true,
        slot_duration: val.slot_duration || 30,
      }))
    saveMutation.mutate(data)
  }

  const activeDays = Object.entries(schedule).filter(([_, v]) => v?.active).length
  const totalSlots = Object.entries(schedule)
    .filter(([_, v]) => v?.active && v?.start && v?.end)
    .reduce((acc, [_, v]) => acc + generateSlots(v.start, v.end, v.slot_duration || 30).length, 0)

  // Week label
  const weekStart = weekDates[0]
  const weekEnd = weekDates[6]
  const weekLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${weekStart.getDate()} — ${weekEnd.getDate()} ${MONTHS_UZ[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`
    : `${weekStart.getDate()} ${MONTHS_UZ[weekStart.getMonth()]} — ${weekEnd.getDate()} ${MONTHS_UZ[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`

  const isThisWeek = weekOffset === 0

  if (isLoading) return <LoadingPage />

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between page-header mb-0">
        <div>
          <h1 className="section-title">Mening Jadvalim</h1>
          <p className="section-subtitle">Haftalik ish vaqtlarini belgilang — bemorlar shu jadvalga qarab band qiladi</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={`btn-primary transition-all ${saved ? '!bg-emerald-600' : ''}`}
        >
          {saved ? <CheckCircle size={15} /> : <Save size={15} />}
          {saveMutation.isPending ? 'Saqlanmoqda...' : saved ? 'Saqlandi!' : 'Saqlash'}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-display font-bold text-white">{activeDays}</p>
          <p className="text-xs text-slate-500 mt-1">Faol kun</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-display font-bold text-primary-400">{totalSlots}</p>
          <p className="text-xs text-slate-500 mt-1">Haftalik slot</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-display font-bold text-emerald-400">
            {activeDays > 0 ? Math.round(totalSlots / activeDays) : 0}
          </p>
          <p className="text-xs text-slate-500 mt-1">Kunlik o'rtacha</p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Info size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-blue-300">
          Jadval <strong>haftalik takrorlanadi</strong> — ya'ni "Dushanba" deb belgilasangiz har haftaning dushanbalarida ishlaysiz. Quyida joriy haftadagi aniq sanalar ko'rsatilgan.
        </p>
      </div>

      {/* Week Navigator */}
      <div className="glass-card p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-center">
            <p className="text-white font-semibold text-sm">{weekLabel}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {isThisWeek ? '📅 Joriy hafta' : weekOffset > 0 ? `+${weekOffset} hafta keyingi` : `${Math.abs(weekOffset)} hafta oldingi`}
            </p>
          </div>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Week days mini calendar */}
        <div className="grid grid-cols-7 gap-1 mt-4">
          {DAYS.map((day, i) => {
            const date = weekDates[i]
            const dayData = schedule[day.id]
            const isActive = dayData?.active
            const isToday = isSameDay(date, today)
            return (
              <div
                key={day.id}
                onClick={() => toggleDay(day.id)}
                className={`cursor-pointer rounded-xl p-2 text-center transition-all border ${
                  isActive
                    ? 'bg-primary-600/20 border-primary-500/50'
                    : 'bg-slate-800/40 border-slate-700/30 hover:border-slate-600'
                } ${isToday ? 'ring-2 ring-amber-400/60' : ''}`}
              >
                <p className={`text-[10px] font-medium uppercase tracking-wider ${isActive ? 'text-primary-300' : 'text-slate-500'}`}>
                  {day.uz.slice(0, 3)}
                </p>
                <p className={`text-base font-bold mt-0.5 ${isToday ? 'text-amber-300' : isActive ? 'text-white' : 'text-slate-500'}`}>
                  {date.getDate()}
                </p>
                <p className={`text-[9px] mt-0.5 ${isActive ? 'text-primary-400' : 'text-slate-600'}`}>
                  {MONTHS_UZ[date.getMonth()].slice(0,3)}
                </p>
                {isActive && (
                  <div className="w-1.5 h-1.5 bg-primary-400 rounded-full mx-auto mt-1" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day rows */}
      <div className="space-y-3">
        {DAYS.map((day, i) => {
          const date = weekDates[i]
          const dayData = schedule[day.id]
          const isActive = dayData?.active ?? false
          const isToday = isSameDay(date, today)
          const slots = isActive && dayData?.start && dayData?.end
            ? generateSlots(dayData.start, dayData.end, dayData.slot_duration || 30)
            : []

          return (
            <div
              key={day.id}
              className={`glass-card transition-all duration-300 overflow-hidden ${
                isActive
                  ? 'border-primary-500/30 shadow-lg shadow-primary-500/5'
                  : 'opacity-60'
              } ${isToday ? 'ring-1 ring-amber-400/30' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">

                  {/* Left: toggle + day info */}
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <button
                      onClick={() => toggleDay(day.id)}
                      className={`w-12 h-6 rounded-full transition-all relative flex-shrink-0 ${
                        isActive ? 'bg-primary-600' : 'bg-slate-700'
                      }`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${
                        isActive ? 'left-6' : 'left-0.5'
                      }`} />
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold text-sm">{day.uz}</p>
                        {isToday && (
                          <span className="text-[9px] bg-amber-400/20 text-amber-300 border border-amber-400/30 px-1.5 py-0.5 rounded-full font-medium">
                            Bugun
                          </span>
                        )}
                      </div>
                      {/* Concrete date for this week */}
                      <p className="text-slate-400 text-xs mt-0.5 flex items-center gap-1">
                        <Calendar size={10} />
                        {formatDate(date)}, {date.getFullYear()}
                        <span className="text-slate-600">·</span>
                        <span className="text-slate-500">{day.name}</span>
                      </p>
                    </div>
                  </div>

                  {/* Right: time inputs */}
                  {isActive ? (
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        type="button"
                        title="Bu kunni o'chirish"
                        onClick={(e) => { e.stopPropagation(); deleteDayMutation.mutate(day.id) }}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                      <div className="flex items-center gap-2">
                        <Clock size={13} className="text-slate-500" />
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] text-slate-600 uppercase tracking-wider">Boshlanish</span>
                          <input
                            type="time"
                            value={dayData?.start || '09:00'}
                            onChange={e => updateDay(day.id, 'start', e.target.value)}
                            className="input-field py-1.5 px-2 text-xs w-28 mt-0.5"
                          />
                        </div>
                        <span className="text-slate-500 text-sm font-bold">—</span>
                        <div className="flex flex-col items-start">
                          <span className="text-[9px] text-slate-600 uppercase tracking-wider">Tugash</span>
                          <input
                            type="time"
                            value={dayData?.end || '18:00'}
                            onChange={e => updateDay(day.id, 'end', e.target.value)}
                            className="input-field py-1.5 px-2 text-xs w-28 mt-0.5"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col items-start">
                        <span className="text-[9px] text-slate-600 uppercase tracking-wider">Slot</span>
                        <select
                          value={dayData?.slot_duration || 30}
                          onChange={e => updateDay(day.id, 'slot_duration', parseInt(e.target.value))}
                          className="input-field py-1.5 px-2 text-xs w-24 mt-0.5"
                        >
                          <option value={15}>15 daq</option>
                          <option value={20}>20 daq</option>
                          <option value={30}>30 daq</option>
                          <option value={45}>45 daq</option>
                          <option value={60}>1 soat</option>
                        </select>
                      </div>

                      {slots.length > 0 && (
                        <div className="bg-primary-500/15 border border-primary-500/30 rounded-lg px-2.5 py-1.5 text-center min-w-[44px]">
                          <p className="text-primary-300 font-bold text-sm">{slots.length}</p>
                          <p className="text-[9px] text-primary-400/70">slot</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs italic">Dam olish kuni</span>
                  )}
                </div>

                {/* Slots preview */}
                {isActive && slots.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-700/40">
                    <p className="text-[11px] text-slate-500 mb-2">
                      {formatDate(date)} — {slots.length} ta slot ({dayData.slot_duration || 30} daqiqalik) · {dayData?.start} — {dayData?.end}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {slots.map(slot => (
                        <span
                          key={slot}
                          className="badge bg-slate-700/60 text-slate-400 text-[10px] border border-slate-600/40 font-mono"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-end pb-4">
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className={`btn-primary px-8 py-3 transition-all ${saved ? '!bg-emerald-600' : ''}`}
        >
          {saved
            ? <><CheckCircle size={15} /> Saqlandi!</>
            : <><Save size={15} /> Jadvalni Saqlash</>
          }
        </button>
      </div>
    </div>
  )
}