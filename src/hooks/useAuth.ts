import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type DbProfile } from '../lib/supabase'

const CORPORATE_DOMAIN = (import.meta as any).env?.VITE_CORPORATE_DOMAIN ?? 'fortestecnologia.com.br'

export function useAuth() {
  const [session, setSession]               = useState<Session | null>(null)
  const [user, setUser]                     = useState<User | null>(null)
  const [profile, setProfile]               = useState<DbProfile | null>(null)
  const [loading, setLoading]               = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)
  const [domainError, setDomainError]       = useState<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    setProfileLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) console.error('[useAuth] fetchProfile error:', error)
      if (data) setProfile(data)
    } finally {
      setProfileLoading(false)
    }
  }, [])

  useEffect(() => {
    // Timeout absoluto: garante que loading termina mesmo se tudo falhar
    const timer = setTimeout(() => {
      console.warn('[useAuth] timeout — forçando loading=false')
      setLoading(false)
    }, 8000)

    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) fetchProfile(session.user.id)
      } catch (e) {
        console.error('[useAuth] getSession error:', e)
      } finally {
        clearTimeout(timer)
        setLoading(false)
      }
    })()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)

      if (session?.user) {
        const email = session.user.email ?? ''
        if (!email.toLowerCase().endsWith('@' + CORPORATE_DOMAIN)) {
          setDomainError(
            `Apenas contas @${CORPORATE_DOMAIN} podem acessar o album. ` +
            `Voce entrou com "${email}".`
          )
          await supabase.auth.signOut()
          setUser(null)
          setProfile(null)
          return
        }
        setDomainError(null)
        setUser(session.user)

        const avatarUrl = session.user.user_metadata?.avatar_url
          ?? session.user.user_metadata?.picture
          ?? null
        if (avatarUrl) {
          // Fire-and-forget: não bloqueia o carregamento do perfil (role/admin)
          supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', session.user.id)
        }

        await fetchProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name },
        emailRedirectTo: window.location.origin,
      },
    })
    return error
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }, [])

  const signInWithGoogle = useCallback(() => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    })
  }, [])

  const signOut = useCallback(() => {
    // Limpa o estado local imediatamente — UI responde na hora
    setDomainError(null)
    setUser(null)
    setProfile(null)
    setSession(null)
    // Invalida sessão no servidor em background (não bloqueia a UI)
    supabase.auth.signOut().catch(() => {})
  }, [])

  // isPending: usuario logado mas aguardando aprovacao do admin.
  // Enquanto profileLoading=true, bloqueia para nao renderizar o app
  // antes de confirmar o status de aprovacao.
  const isPending = !!user && (profileLoading || (!!profile && profile.approved === false))

  return {
    session,
    user,
    profile,
    loading,
    isPending,
    domainError,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    refetchProfile: fetchProfile,
  }
}
