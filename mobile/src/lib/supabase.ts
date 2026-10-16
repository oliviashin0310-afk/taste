import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const persistentStorage = {
  async getItem(key: string) {
    if (Capacitor.isNativePlatform()) return (await Preferences.get({ key })).value
    return window.localStorage.getItem(key)
  },
  async setItem(key: string, value: string) {
    if (Capacitor.isNativePlatform()) {
      await Preferences.set({ key, value })
      return
    }
    window.localStorage.setItem(key, value)
  },
  async removeItem(key: string) {
    if (Capacitor.isNativePlatform()) {
      await Preferences.remove({ key })
      return
    }
    window.localStorage.removeItem(key)
  },
}

export const supabase: SupabaseClient | null = url && publishableKey
  ? createClient(url, publishableKey, {
      auth: {
        storage: persistentStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
    })
  : null

export const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL || 'taste://auth/callback'
