import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useThemeStore = create(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set((s) => {
        const next = s.theme === 'dark' ? 'light' : 'dark'
        document.documentElement.classList.toggle('light', next === 'light')
        return { theme: next }
      }),
      initTheme: () => {
        const stored = localStorage.getItem('theme-storage')
        const theme = stored ? JSON.parse(stored)?.state?.theme : 'dark'
        if (theme === 'light') document.documentElement.classList.add('light')
      },
    }),
    { name: 'theme-storage' }
  )
)

export default useThemeStore
