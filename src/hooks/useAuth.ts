import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type DbProfile } from '../lib/supabase'

const CORPORATE_DOMAIN = (import.meta as any).env?.VITE_CORPORATE_DOMAIN ?? 'fortestecnologia.com.br'

export function useAuth() {
  const [session, setSession]             = useState<Session | null>(null)
  const [user, setUser]                   = useState<User | null>(null)
  const [profile, setProfile]             = useState<DbProfile | null>(null)
  // authLoading: ainda checando se existe sessão (load inicial)
  const [authLoading, setAuthLoading]     = useState(true)
  // profileLoaded: o perfil já foi buscado ao menos uma vez. Uma vez true,
  // NUNCA volta a false num re-fetch — é isso que impede a tela de aprovação
  // de reaparecer ao focar a aba / renovar o token.
  const [profileLoaded, setProfileLoaded] = useState(false)
  const [domainError, setDomainError]     = useState<string | null>(null)

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (error) console.error('[useAuth] fetchProfile error:', error)
      if (data) setProfile(data)
    } catch (e) {
      console.error('[useAuth] fetchProfile exception:', e)
    } finally {
      setProfileLoaded(true)
    }
  }, [])

  useEffect(() => {
    let active = true

    // Garantia: o spinner nunca trava para sempre, mesmo se a rede falhar.
    const timer = setTimeout(() => {
      if (active) setAuthLoading(false)
    }, 8000)

    // Resolve uma sessão (do load inicial ou de um evento de auth) para o
    // estado da UI. Centralizado para que login, refresh de token e foco de
    // aba sigam exatamente o mesmo caminho.
    const handleSession = async (nextSession: Session | null) => {
      if (!active) return

      // Sem sessão → deslogado.
      if (!nextSession?.user) {
        setSession(null)
        setUser(null)
        setProfile(null)
        setProfileLoaded(false)
        return
      }

      // Domínio corporativo obrigatório.
      const email = nextSession.user.email ?? ''
      if (!email.toLowerCase().endsWith('@' + CORPORATE_DOMAIN)) {
        setDomainError(
          `Apenas contas @${CORPORATE_DOMAIN} podem acessar o álbum. ` +
          `Você entrou com "${email}".`
        )
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setProfile(null)
        setProfileLoaded(false)
        return
      }

      setDomainError(null)
      setSession(nextSession)
      setUser(nextSession.user)

      // Atualiza avatar em background — não bloqueia o carregamento do perfil.
      const avatarUrl = nextSession.user.user_metadata?.avatar_url
        ?? nextSession.user.user_metadata?.picture
        ?? null
      if (avatarUrl) {
        supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', nextSession.user.id)
      }

      await fetchProfile(nextSession.user.id)
    }

    // 1) Sessão inicial (fonte de verdade no boot).
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        await handleSession(session)
      } catch (e) {
        console.error('[useAuth] getSession error:', e)
      } finally {
        if (active) {
          clearTimeout(timer)
          setAuthLoading(false)
        }
      }
    })()

    // 2) Eventos de auth. IMPORTANTE: tratamos TODOS, incluindo INITIAL_SESSION
    //    — é por esse evento que o Supabase entrega a sessão do retorno do
    //    OAuth do Google numa carga nova de página. Ignorá-lo fazia o login
    //    com Google falhar (voltava ao splash deslogado). O profileLoaded
    //    evita re-fetch redundante reabrir a tela de aprovação.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      handleSession(nextSession)
    })

    return () => {
      active = false
      clearTimeout(timer)
      subscription.unsubscribe()
    }
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
    // Limpa o estado local imediatamente — UI responde na hora.
    setDomainError(null)
    setUser(null)
    setProfile(null)
    setSession(null)
    setProfileLoaded(false)
    // Invalida a sessão no servidor em background (não bloqueia a UI).
    supabase.auth.signOut().catch(() => {})
  }, [])

  // loading: enquanto não sabemos a sessão, OU temos usuário mas o perfil
  // (que decide aprovação) ainda não chegou. Mantém o spinner em vez de
  // mostrar a tela de aprovação prematuramente.
  const loading = authLoading || (!!user && !profileLoaded)

  // isPending: SÓ é true quando temos certeza — perfil carregado e
  // approved === false. Nunca durante uma transição de carregamento.
  const isPending = !!user && profileLoaded && !!profile && profile.approved === false

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
