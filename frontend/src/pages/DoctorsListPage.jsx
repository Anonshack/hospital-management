import { useState } from 'react'
import useLanguageStore from '../store/languageStore'
import { useQuery } from '@tanstack/react-query'
import { Stethoscope, MapPin, DollarSign, Award, Mail, Phone, X, Calendar, Clock } from 'lucide-react'
import { doctorsAPI } from '../services/api'
import { SearchInput, Pagination, LoadingPage, EmptyState, Modal } from '../components/common/UI'

export default function DoctorsListPage() {
  const t = useLanguageStore(state => state.t)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['doctors-list', page, search],
    queryFn: () => doctorsAPI.list({ page, search: search || undefined }).then(r => r.data),
  })

  const doctors = data?.results || data || []
  const totalPages = data?.total_pages || 1

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="section-title">{t('doctorsList')}</h1>
          <p className="section-subtitle">{t('doctorsListFull')}</p>
        </div>
      </div>

      <SearchInput 
        value={search} 
        onChange={setSearch} 
        placeholder={t('searchPlaceholder')}
      />

      {isLoading ? (
        <LoadingPage />
      ) : doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t('noRecordsFound')} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {doctors.map(doctor => (
              <div 
                key={doctor.id} 
                onClick={() => setSelectedDoctor(doctor)}
                className="glass-card p-5 hover:border-primary-500/30 transition-all cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  {doctor.avatar ? (
                    <img 
                      src={doctor.avatar} 
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0" 
                      alt={doctor.full_name} 
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0">
                      <Stethoscope size={28} className="text-white" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">
                      {doctor.full_name}
                    </h3>
                    <p className="text-sm text-primary-400 mt-0.5">{doctor.specialization}</p>
                    
                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-2">
                      <Award size={12} />
                      <span>{doctor.experience_years} {t('yearsExperience')}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-700/40 space-y-2">
                  {doctor.department_name && (
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <MapPin size={13} className="flex-shrink-0" />
                      <span className="truncate">{doctor.department_name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <DollarSign size={13} className="flex-shrink-0" />
                    <span>{t('consultation')}: ${doctor.consultation_fee}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className={`px-2 py-1 rounded-lg font-medium ${
                      doctor.is_available 
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-slate-500/15 text-slate-400 border border-slate-500/30'
                    }`}>
                      {doctor.is_available ? `✓ ${t('available')}` : t('notAvailable')}
                    </span>
                  </div>
                </div>

                {doctor.bio && (
                  <p className="text-xs text-slate-500 mt-3 line-clamp-2">{doctor.bio}</p>
                )}
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      {/* Doctor Detail Modal */}
      {selectedDoctor && (
        <Modal open={!!selectedDoctor} onClose={() => setSelectedDoctor(null)} title={t('doctorInfo')} size="lg">
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start gap-4">
              {selectedDoctor.avatar ? (
                <img 
                  src={selectedDoctor.avatar} 
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0" 
                  alt={selectedDoctor.full_name} 
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-primary-600 to-primary-700 flex items-center justify-center flex-shrink-0">
                  <Stethoscope size={32} className="text-white" />
                </div>
              )}
              
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white">{selectedDoctor.full_name}</h3>
                <p className="text-primary-400 mt-1">{selectedDoctor.specialization}</p>
                {selectedDoctor.qualification && (
                  <p className="text-sm text-slate-400 mt-1">{selectedDoctor.qualification}</p>
                )}
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <Mail size={18} className="text-primary-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="text-sm text-slate-200 truncate">{selectedDoctor.email}</p>
                </div>
              </div>
              
              {selectedDoctor.phone && (
                <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                  <Phone size={18} className="text-primary-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Telefon</p>
                    <p className="text-sm text-slate-200">{selectedDoctor.phone}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <Award size={20} className="text-amber-400 mx-auto mb-1" />
                <p className="text-lg font-semibold text-white">{selectedDoctor.experience_years}</p>
                <p className="text-xs text-slate-400">Yil tajriba</p>
              </div>
              
              <div className="text-center p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <DollarSign size={20} className="text-emerald-400 mx-auto mb-1" />
                <p className="text-lg font-semibold text-white">${selectedDoctor.consultation_fee}</p>
                <p className="text-xs text-slate-400">Konsultatsiya</p>
              </div>
              
              <div className="text-center p-3 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <MapPin size={20} className="text-blue-400 mx-auto mb-1" />
                <p className="text-sm font-semibold text-white truncate">{selectedDoctor.department_name || '—'}</p>
                <p className="text-xs text-slate-400">Bo'lim</p>
              </div>
            </div>

            {/* Bio */}
            {selectedDoctor.bio && (
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <h4 className="text-sm font-semibold text-white mb-2">Haqida</h4>
                <p className="text-sm text-slate-300 leading-relaxed">{selectedDoctor.bio}</p>
              </div>
            )}

            {/* Schedule */}
            {selectedDoctor.schedules && selectedDoctor.schedules.length > 0 && (
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/40">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <Calendar size={16} className="text-primary-400" />
                  Ish Jadvali
                </h4>
                <div className="space-y-2">
                  {selectedDoctor.schedules.filter(s => s.is_active).map(schedule => (
                    <div key={schedule.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{schedule.day_name}</span>
                      <span className="text-slate-400 flex items-center gap-1">
                        <Clock size={14} />
                        {schedule.start_time} - {schedule.end_time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button 
              onClick={() => setSelectedDoctor(null)} 
              className="btn-secondary w-full justify-center"
            >
              {t('close')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
