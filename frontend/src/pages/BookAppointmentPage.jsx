import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import {
  Calendar, Clock, ArrowLeft, CheckCircle, Star,
  Stethoscope, DollarSign, Award, User, ChevronRight,
  Phone, Mail, Building2, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { doctorsAPI, patientsAPI, appointmentsAPI } from '../services/api'
import useAuthStore from '../store/authStore'
import { LoadingPage, FormField, Spinner } from '../components/common/UI'

const DAYS_UZ = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba']

function DoctorCard({ doctor, selected, onSelect }) {
  return (
    <div
      onClick={onSelect}
      className={`glass-card p-4 cursor-pointer transition-all hover:border-primary-500/40 group ${
        selected ? 'border-primary-500/60 bg-primary-500/5 shadow-lg shadow-primary-500/10' : ''
      }`}
    >
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {doctor.avatar
            ? <img src={doctor.avatar} className="w-14 h-14 rounded-xl object-cover ring-2 ring-primary-500/20" alt="" />
            : <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-2xl">
                👨‍⚕️
              </div>
          }
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-white font-semibold text-base leading-tight">{doctor.full_name}</p>
              <p className="text-primary-400 text-sm font-medium mt-0.5">{doctor.specialization}</p>
              {doctor.department_name && (
                <p className="text-slate-500 text-xs mt-0.5 flex items-center gap-1">
                  <Building2 size={10} /> {doctor.department_name}
                </p>
              )}
            </div>
            {selected && (
              <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center flex-shrink-0">
                <CheckCircle size={14} className="text-white" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3 mt-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Award size={11} className="text-amber-400" />
              <span>{doctor.experience_years || 0} yil tajriba</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
              <DollarSign size={11} />
              <span>${doctor.consultation_fee || 0} konsultatsiya</span>
            </div>
            <div className={`flex items-center gap-1.5 text-xs font-medium ${doctor.is_available ? 'text-emerald-400' : 'text-red-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${doctor.is_available ? 'bg-emerald-400' : 'bg-red-400'}`} />
              {doctor.is_available ? 'Mavjud' : 'Band'}
            </div>
          </div>

          {/* Schedule preview */}
          {doctor.schedules?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {[0,1,2,3,4,5,6].map(dayIdx => {
                const s = doctor.schedules?.find(sc => sc.day_of_week === dayIdx && sc.is_active)
                return (
                  <span key={dayIdx} className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                    s
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-slate-700/30 text-slate-600 border-slate-700/20'
                  }`}>
                    {DAYS_UZ[dayIdx].slice(0, 3)}
                    {s ? ` ${s.start_time?.slice(0,5)}-${s.end_time?.slice(0,5)}` : ''}
                  </span>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DoctorDetailPanel({ doctor }) {
  if (!doctor) return null
  return (
    <div className="bg-primary-900/20 border border-primary-500/25 rounded-2xl p-5 space-y-4">
      <div className="flex items-start gap-4">
        {doctor.avatar
          ? <img src={doctor.avatar} className="w-16 h-16 rounded-xl object-cover ring-2 ring-primary-400/30 flex-shrink-0" alt="" />
          : <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-600 to-primary-800 flex items-center justify-center text-3xl flex-shrink-0">👨‍⚕️</div>
        }
        <div>
          <p className="text-white font-bold text-lg">{doctor.full_name}</p>
          <p className="text-primary-300 font-medium">{doctor.specialization}</p>
          {doctor.department_name && <p className="text-slate-500 text-sm mt-0.5">📍 {doctor.department_name}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
          <p className="text-white font-bold text-lg">{doctor.experience_years || 0}</p>
          <p className="text-slate-500 text-[10px] mt-0.5">Yil tajriba</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
          <p className="text-emerald-400 font-bold text-lg">${doctor.consultation_fee || 0}</p>
          <p className="text-slate-500 text-[10px] mt-0.5">Konsultatsiya</p>
        </div>
        <div className="bg-slate-800/60 rounded-xl p-3 text-center">
          <p className={`font-bold text-sm ${doctor.is_available ? 'text-emerald-400' : 'text-red-400'}`}>
            {doctor.is_available ? '✓ Mavjud' : '✗ Band'}
          </p>
          <p className="text-slate-500 text-[10px] mt-0.5">Holat</p>
        </div>
      </div>

      {doctor.bio && (
        <div className="bg-slate-800/40 rounded-xl p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Haqida</p>
          <p className="text-slate-300 text-sm leading-relaxed">{doctor.bio}</p>
        </div>
      )}

      {doctor.email && (
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5 text-xs text-slate-400">
            <Mail size={11} /> {doctor.email}
          </span>
          {doctor.user?.phone && (
            <span className="flex items-center gap-1.5 text-xs text-slate-400">
              <Phone size={11} /> {doctor.user.phone}
            </span>
          )}
        </div>
      )}

      {/* Haftalik jadval */}
      {doctor.schedules?.filter(s => s.is_active).length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Haftalik ish vaqti</p>
          <div className="space-y-1.5">
            {[0,1,2,3,4,5,6].map(dayIdx => {
              const s = doctor.schedules?.find(sc => sc.day_of_week === dayIdx && sc.is_active)
              if (!s) return null
              return (
                <div key={dayIdx} className="flex items-center justify-between text-xs py-1.5 px-3 bg-slate-800/40 rounded-lg">
                  <span className="text-slate-300 font-medium">{DAYS_UZ[dayIdx]}</span>
                  <span className="text-primary-300 font-mono">
                    {s.start_time?.slice(0,5)} — {s.end_time?.slice(0,5)}
                    <span className="text-slate-600 ml-2">({s.slot_duration || 30} min)</span>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BookAppointmentPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [step, setStep] = useState(1) // 1=doctor, 2=datetime, 3=details
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [slotsData, setSlotsData] = useState(null)
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [booked, setBooked] = useState(false)
  const [searchDoc, setSearchDoc] = useState('')

  const { register, handleSubmit, formState: { errors } } = useForm()

  const { data: doctors = [], isLoading: doctorsLoading } = useQuery({
    queryKey: ['doctors-list'],
    queryFn: () => doctorsAPI.list({ is_available: true }).then(r => r.data.results || r.data),
  })

  const { data: patients = [] } = useQuery({
    queryKey: ['patients-list'],
    queryFn: () => patientsAPI.list().then(r => r.data.results || r.data),
    enabled: user?.role !== 'patient',
  })

  const filteredDoctors = doctors.filter(d =>
    !searchDoc ||
    d.full_name?.toLowerCase().includes(searchDoc.toLowerCase()) ||
    d.specialization?.toLowerCase().includes(searchDoc.toLowerCase())
  )

  const selectDoctor = async (doc) => {
    setSelectedDoctor(doc)
    setSelectedDate('')
    setSelectedTime('')
    setSlotsData(null)
    setStep(2)
  }

  const loadSlots = async (date) => {
    if (!selectedDoctor || !date) return
    setLoadingSlots(true)
    setSelectedTime('')
    try {
      const res = await doctorsAPI.getAvailableSlots(selectedDoctor.id, date)
      setSlotsData(res.data)
    } catch {
      setSlotsData({ available: false, message: "Slotlarni yuklashda xato" })
    }
    setLoadingSlots(false)
  }

  const bookMutation = useMutation({
    mutationFn: (data) => appointmentsAPI.create(data),
    onSuccess: () => setBooked(true),
    onError: (e) => toast.error(e.response?.data?.message || e.response?.data?.detail || 'Xato yuz berdi'),
  })

  const onSubmit = (formData) => {
    if (!selectedTime) { toast.error('Vaqt slotini tanlang'); return }
    if (slotsData && !slotsData.available) { toast.error(slotsData.message); return }
    bookMutation.mutate({
      doctor: selectedDoctor.id,
      patient: user?.role === 'patient' ? undefined : formData.patient,
      date: selectedDate,
      time: selectedTime + ':00',
      reason: formData.reason,
      symptoms: formData.symptoms,
    })
  }

  // Today minimum date
  const minDate = new Date().toISOString().split('T')[0]

  if (booked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 border border-emerald-500/30 shadow-xl shadow-emerald-500/10">
          <CheckCircle size={44} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">Qabul Belgilandi! 🎉</h2>
        <p className="text-slate-400 mb-2">Dr. {selectedDoctor?.full_name} — {selectedDate} soat {selectedTime}</p>
        <p className="text-slate-500 text-sm mb-8">Qabulingiz tasdiqlash kutilmoqda.</p>
        <div className="flex gap-3">
          <button onClick={() => navigate('/appointments')} className="btn-primary">Qabullarim</button>
          <button onClick={() => { setBooked(false); setStep(1); setSelectedDoctor(null); setSelectedDate(''); setSelectedTime(''); setSlotsData(null) }} className="btn-secondary">
            Yana belgilash
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition-all">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="section-title">Qabul Belgilash</h1>
          <p className="section-subtitle">Shifokor bilan qabul vaqtini tanlang</p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        {['Shifokor', 'Vaqt', 'Ma\'lumot'].map((label, i) => (
          <div key={i} className="flex items-center gap-2 flex-1">
            <div className={`flex items-center gap-2 ${i < step - 1 ? 'text-emerald-400' : i === step - 1 ? 'text-primary-400' : 'text-slate-600'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
                i < step - 1 ? 'bg-emerald-500/20 border-emerald-500' :
                i === step - 1 ? 'bg-primary-500/20 border-primary-500' :
                'bg-slate-800 border-slate-700'
              }`}>
                {i < step - 1 ? '✓' : i + 1}
              </div>
              <span className="text-xs font-medium hidden sm:inline">{label}</span>
            </div>
            {i < 2 && <div className={`flex-1 h-px ${i < step - 1 ? 'bg-emerald-500/40' : 'bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      {/* Step 1: Doctor Selection */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="relative">
            <Stethoscope size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Shifokor ism yoki mutaxassislik bo'yicha qidirish..."
              value={searchDoc}
              onChange={e => setSearchDoc(e.target.value)}
              className="input-field pl-9"
            />
          </div>

          {doctorsLoading ? <LoadingPage /> : (
            <div className="space-y-3">
              {filteredDoctors.length === 0 ? (
                <div className="glass-card p-12 text-center">
                  <Stethoscope size={40} className="mx-auto text-slate-600 mb-3" />
                  <p className="text-slate-400">Shifokor topilmadi</p>
                </div>
              ) : filteredDoctors.map(doc => (
                <DoctorCard
                  key={doc.id}
                  doctor={doc}
                  selected={selectedDoctor?.id === doc.id}
                  onSelect={() => selectDoctor(doc)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 2 && selectedDoctor && (
        <div className="space-y-4">
          <DoctorDetailPanel doctor={selectedDoctor} />

          {/* Date picker */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Calendar size={16} className="text-primary-400" /> Sana tanlang
            </h3>
            <div className="relative">
              <Calendar size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="date"
                min={minDate}
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); loadSlots(e.target.value) }}
                className="input-field pl-9"
              />
            </div>

            {/* Slots */}
            {selectedDate && (
              <div>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
                  <Clock size={16} className="text-primary-400" /> Vaqt tanlang
                </h3>

                {loadingSlots && (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Spinner size={14} /> Bo'sh vaqtlar yuklanmoqda...
                  </div>
                )}

                {!loadingSlots && slotsData && !slotsData.available && (
                  <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-300 font-medium text-sm">Ushbu kunda qabul mavjud emas</p>
                      <p className="text-red-400/70 text-xs mt-0.5">{slotsData.message}</p>
                    </div>
                  </div>
                )}

                {!loadingSlots && slotsData?.available && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500">
                      <span>📅 {slotsData.day}</span>
                      <span>⏰ {slotsData.working_hours}</span>
                      <span className="text-emerald-400">✓ {slotsData.free_slots?.length} bo'sh slot</span>
                      {slotsData.booked_slots?.length > 0 && (
                        <span className="text-red-400">✗ {slotsData.booked_slots?.length} band</span>
                      )}
                    </div>

                    <div className="grid grid-cols-5 sm:grid-cols-7 gap-2">
                      {slotsData.free_slots?.map(slot => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={`py-2.5 px-1 rounded-xl text-xs font-mono font-semibold border transition-all ${
                            selectedTime === slot
                              ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-500/25'
                              : 'bg-slate-800/60 border-slate-600/40 text-slate-400 hover:border-primary-500/50 hover:text-white hover:bg-slate-700/60'
                          }`}
                        >
                          {slot}
                        </button>
                      ))}
                      {slotsData.booked_slots?.map(slot => (
                        <button key={slot} disabled
                          className="py-2.5 px-1 rounded-xl text-xs font-mono border bg-red-500/10 border-red-500/20 text-red-500/40 cursor-not-allowed line-through">
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!loadingSlots && !slotsData && (
                  <p className="text-slate-500 text-sm">Sana tanlanishini kutmoqda...</p>
                )}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              if (!selectedDate) { toast.error('Sana tanlang'); return }
              if (!selectedTime) { toast.error('Vaqt tanlang'); return }
              setStep(3)
            }}
            disabled={!selectedDate || !selectedTime}
            className="btn-primary w-full justify-center py-3 disabled:opacity-40"
          >
            Davom etish <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Step 3: Details */}
      {step === 3 && (
        <div className="glass-card p-6 space-y-5">
          {/* Booking summary */}
          <div className="bg-primary-900/30 border border-primary-500/25 rounded-xl p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Qabul ma'lumotlari</p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Shifokor</p>
                <p className="text-white font-medium mt-0.5">{selectedDoctor?.full_name}</p>
                <p className="text-primary-400 text-xs">{selectedDoctor?.specialization}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Vaqt</p>
                <p className="text-white font-medium mt-0.5">{selectedDate}</p>
                <p className="text-emerald-400 font-mono font-semibold text-sm">{selectedTime}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Narx</p>
                <p className="text-emerald-400 font-bold">${selectedDoctor?.consultation_fee || 0}</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {user?.role !== 'patient' && (
              <FormField label="Bemor" error={errors.patient?.message} required>
                <select {...register('patient', { required: 'Bemor tanlang' })} className="input-field">
                  <option value="">Bemor tanlang...</option>
                  {patients.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name} ({p.email})</option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="Tashrif sababi" error={errors.reason?.message} required>
              <textarea
                {...register('reason', { required: 'Sabab kiriting' })}
                className="input-field resize-none"
                rows={3}
                placeholder="Kasallik yoki muammo haqida qisqacha..."
              />
            </FormField>

            <FormField label="Belgilar (ixtiyoriy)">
              <textarea
                {...register('symptoms')}
                className="input-field resize-none"
                rows={2}
                placeholder="Sezayotgan belgilaringizni yozing..."
              />
            </FormField>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setStep(2)} className="btn-secondary flex-1 justify-center">
                Orqaga
              </button>
              <button
                type="submit"
                disabled={bookMutation.isPending}
                className="btn-primary flex-1 justify-center py-3"
              >
                {bookMutation.isPending
                  ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saqlanmoqda...</>
                  : <><Calendar size={16} /> Qabulni Tasdiqlash</>
                }
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}