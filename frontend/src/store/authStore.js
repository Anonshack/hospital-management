import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { data } = await authAPI.login({ email, password })
          // Save tokens both in store AND localStorage
          localStorage.setItem('access_token', data.access)
          localStorage.setItem('refresh_token', data.refresh)
          set({
            user: data.user,
            accessToken: data.access,
            refreshToken: data.refresh,
            isAuthenticated: true,
            isLoading: false,
          })
          toast.success(`Xush kelibsiz, ${data.user.full_name}!`)
          return { success: true, role: data.user.role }
        } catch (err) {
          set({ isLoading: false })
          const msg = err.response?.data?.detail || err.response?.data?.message || 'Email yoki parol noto\'g\'ri'
          toast.error(msg)
          return { success: false, error: msg }
        }
      },

      register: async (formData) => {
        set({ isLoading: true })
        try {
          const { data } = await authAPI.register(formData)
          localStorage.setItem('access_token', data.tokens.access)
          localStorage.setItem('refresh_token', data.tokens.refresh)
          set({
            user: data.user,
            accessToken: data.tokens.access,
            refreshToken: data.tokens.refresh,
            isAuthenticated: true,
            isLoading: false,
          })
          toast.success('Hisob yaratildi! MediCorega xush kelibsiz.')
          return { success: true }
        } catch (err) {
          set({ isLoading: false })
          const msg = err.response?.data?.message || 'Ro\'yxatdan o\'tishda xato'
          toast.error(msg)
          return { success: false, error: msg }
        }
      },

      logout: async () => {
        try {
          const refresh = localStorage.getItem('refresh_token')
          if (refresh) await authAPI.logout(refresh)
        } catch {}
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
        toast.success('Tizimdan chiqildi.')
      },

      // Called by api.js interceptor after successful token refresh
      setTokens: (access, refresh) => {
        localStorage.setItem('access_token', access)
        if (refresh) localStorage.setItem('refresh_token', refresh)
        set({ accessToken: access, ...(refresh ? { refreshToken: refresh } : {}) })
      },

      // Called by api.js interceptor when refresh fails
      forceLogout: () => {
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        })
      },

      updateUser: (userData) => set({ user: { ...get().user, ...userData } }),

      // Rehydrate tokens from localStorage into store on app start
      rehydrateTokens: () => {
        const access = localStorage.getItem('access_token')
        const refresh = localStorage.getItem('refresh_token')
        if (access) set({ accessToken: access })
        if (refresh) set({ refreshToken: refresh })
      },
    }),
    {
      name: 'auth-storage',
      // Persist ALL auth state including tokens
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
      // After rehydration, sync tokens back to localStorage
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken) {
          localStorage.setItem('access_token', state.accessToken)
        }
        if (state?.refreshToken) {
          localStorage.setItem('refresh_token', state.refreshToken)
        }
      },
    }
  )
)

export default useAuthStore