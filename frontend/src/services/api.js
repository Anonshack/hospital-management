import axios from 'axios'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

// Track if we're currently refreshing to prevent parallel refresh calls
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  failedQueue = []
}

// Request interceptor — attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401 with proper queue-based refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip refresh for auth endpoints themselves
    const isAuthEndpoint = originalRequest.url?.includes('/auth/login') ||
                           originalRequest.url?.includes('/auth/token/refresh') ||
                           originalRequest.url?.includes('/auth/register')

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          return api(originalRequest)
        }).catch(err => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')

      if (!refreshToken) {
        isRefreshing = false
        _doLogout()
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post(
          `${API_BASE}/auth/token/refresh/`,
          { refresh: refreshToken }
        )

        const newAccess = data.access
        const newRefresh = data.refresh // Some backends rotate refresh token too

        localStorage.setItem('access_token', newAccess)
        if (newRefresh) localStorage.setItem('refresh_token', newRefresh)

        api.defaults.headers.common['Authorization'] = `Bearer ${newAccess}`
        originalRequest.headers.Authorization = `Bearer ${newAccess}`

        processQueue(null, newAccess)
        isRefreshing = false

        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        isRefreshing = false
        _doLogout()
        return Promise.reject(refreshError)
      }
    }

    // Show error toasts for server errors (not 401/403/400)
    if (error.response?.status >= 500) {
      const msg = error.response?.data?.message ||
                  error.response?.data?.detail ||
                  'Server xatosi yuz berdi'
      // Only show generic toast if the calling code doesn't have its own handler
      // by checking if the error has been already handled (marked)
      if (!error.config?._suppressToast) {
        toast.error(`Server xatosi: ${msg}`)
      }
    }

    return Promise.reject(error)
  }
)

function _doLogout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  // Clear zustand store without import cycle — dispatch custom event
  window.dispatchEvent(new CustomEvent('auth:logout'))
}

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login/', data),
  register: (data) => api.post('/auth/register/', data),
  logout: (refresh) => api.post('/auth/logout/', { refresh }),
  refresh: (refresh) => api.post('/auth/token/refresh/', { refresh }),
  verifyEmail: (token) => api.get(`/auth/verify-email/${token}/`),
  requestPasswordReset: (email) => api.post('/auth/password-reset/', { email }),
  confirmPasswordReset: (data) => api.post('/auth/password-reset/confirm/', data),
}

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersAPI = {
  getMe: () => api.get('/users/me/'),
  updateMe: (data) => {
    const isFormData = data instanceof FormData
    return api.patch('/users/me/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})
  },
  changePassword: (data) => api.post('/users/change-password/', data),
  list: (params) => api.get('/users/', { params }),
  get: (id) => api.get(`/users/${id}/`),
  create: (data) => {
    const isFormData = data instanceof FormData
    return api.post('/users/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})
  },
  update: (id, data) => {
    const isFormData = data instanceof FormData
    return api.patch(`/users/${id}/`, data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})
  },
  delete: (id) => api.delete(`/users/${id}/`),
  activate: (id) => api.post(`/users/${id}/activate/`),
  verify: (id) => api.post(`/users/${id}/verify/`),
  promoteToAdmin: (id) => api.post(`/users/${id}/promote_to_admin/`),
  statistics: () => api.get('/users/statistics/'),
}

// ─── Patients ────────────────────────────────────────────────────────────────
export const patientsAPI = {
  list: (params) => api.get('/patients/', { params }),
  get: (id) => api.get(`/patients/${id}/`),
  getMe: () => api.get('/patients/me/'),
  updateMe: (data) => {
    const isFormData = data instanceof FormData
    return api.patch('/patients/me/', data,
      isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
    )
  },
  update: (id, data) => api.patch(`/patients/${id}/`, data),
  getMedicalRecords: (id) => api.get(`/patients/${id}/medical_records/`),
  getAppointments: (id) => api.get(`/patients/${id}/appointments/`),
}

// ─── Doctors ─────────────────────────────────────────────────────────────────
export const doctorsAPI = {
  list: (params) => api.get('/doctors/', { params }),
  get: (id) => api.get(`/doctors/${id}/`),
  getMe: () => api.get('/doctors/me/'),
  updateMe: (data) => {
    const isFormData = data instanceof FormData
    return api.patch('/doctors/me/', data,
      isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}
    )
  },
  dashboard: (id) => api.get(`/doctors/${id}/dashboard/`),
  getMySchedule: () => api.get('/doctors/my_schedule/'),
  saveMySchedule: (data) => api.post('/doctors/my_schedule/', data),
  deleteScheduleDay: (day) => api.delete(`/doctors/my_schedule/?day=${day}`),
  deleteAllSchedule: () => api.delete('/doctors/my_schedule/'),
  getAvailableSlots: (id, date) => api.get(`/doctors/${id}/available_slots/?date=${date}`),
}

// ─── Departments ─────────────────────────────────────────────────────────────
export const departmentsAPI = {
  list: (params) => api.get('/departments/', { params }),
  get: (id) => api.get(`/departments/${id}/`),
  create: (data) => api.post('/departments/', data),
  update: (id, data) => api.patch(`/departments/${id}/`, data),
  delete: (id) => api.delete(`/departments/${id}/`),
}

// ─── Appointments ────────────────────────────────────────────────────────────
export const appointmentsAPI = {
  list: (params) => api.get('/appointments/', { params }),
  get: (id) => api.get(`/appointments/${id}/`),
  create: (data) => {
    const isFormData = data instanceof FormData
    return api.post('/appointments/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})
  },
  update: (id, data) => api.patch(`/appointments/${id}/`, data),
  delete: (id) => api.delete(`/appointments/${id}/`),
  cancel: (id, reason) => api.post(`/appointments/${id}/cancel/`, { reason }),
  approve: (id, notes) => api.post(`/appointments/${id}/approve/`, { notes }),
  reject: (id, reason) => api.post(`/appointments/${id}/reject/`, { reason }),
  complete: (id, notes) => api.post(`/appointments/${id}/complete/`, { notes }),
  uploadImages: (id, files) => {
    const fd = new FormData()
    files.forEach(f => fd.append('images', f))
    return api.post(`/appointments/${id}/upload-images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  today: () => api.get('/appointments/today/'),
  upcoming: () => api.get('/appointments/upcoming/'),
  statistics: () => api.get('/appointments/statistics/'),
}

// ─── Medical Records ─────────────────────────────────────────────────────────
export const medicalRecordsAPI = {
  list: (params) => api.get('/medical-records/', { params }),
  get: (id) => api.get(`/medical-records/${id}/`),
  create: (data) => api.post('/medical-records/', data, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  update: (id, data) => api.patch(`/medical-records/${id}/`, data),
}

// ─── Billing ─────────────────────────────────────────────────────────────────
export const billingAPI = {
  list: (params) => api.get('/billing/', { params }),
  get: (id) => api.get(`/billing/${id}/`),
  create: (data) => api.post('/billing/', data),
  processPayment: (id, data) => api.post(`/billing/${id}/process_payment/`, data),
  myBills: () => api.get('/billing/my_bills/'),
  revenueSummary: () => api.get('/billing/revenue_summary/'),
  uploadReceipt: (id, formData) => api.post(`/billing/${id}/upload-receipt/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  pendingReceipts: () => api.get('/billing/pending-receipts/'),
  confirmReceipt: (receipt_id, action) => api.post('/billing/confirm-receipt/', { receipt_id, action }),
}

// ─── Notifications ─────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: () => api.get('/notifications/'),
  markRead: (id) => api.post(`/notifications/${id}/mark_read/`),
  markAllRead: () => api.post('/notifications/mark_all_read/'),
  unreadCount: () => api.get('/notifications/unread_count/'),
}

// ─── Blog ────────────────────────────────────────────────────────────────────
export const blogAPI = {
  list: (params) => api.get('/blog/posts/', { params }),
  get: (id) => api.get(`/blog/posts/${id}/`),
  create: (data) => {
    const isFormData = data instanceof FormData
    return api.post('/blog/posts/', data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})
  },
  update: (id, data) => {
    const isFormData = data instanceof FormData
    return api.patch(`/blog/posts/${id}/`, data, isFormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {})
  },
  delete: (id) => api.delete(`/blog/posts/${id}/`),
  like: (id, value) => api.post(`/blog/posts/${id}/like/`, { value }),
  comment: (id, content, parent = null) => api.post(`/blog/posts/${id}/comment/`, { content, parent }),
  deleteComment: (id) => api.delete(`/blog/comments/${id}/`),
  updateComment: (id, content) => api.patch(`/blog/comments/${id}/`, { content }),
}

export default api