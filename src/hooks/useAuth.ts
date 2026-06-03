import { useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, type DbProfile } from '../lib/supabase'

const CORPORATE_DOMAIN = (import.meta as any).env?.VITE_CORPORATE_DOMAIN ?? 'fortestecnologia.com.br'

// Exceções: emails liberados mesmo sem o domínio corporativo.
// Fonte 1: variável de ambiente VITE_EXTRA_ALLOWED_EMAILS (separados por vírgula).
// Fonte 2: a lista fixa abaixo (para casos pontuais aprovados).
const HARDCODED_ALLOWED_EMAILS: string[] = [
  'jorge@grupofortes.com.br',
  'sabino@grupofortes.com.br',
]
const EXTRA_ALLOWED_EMAILS = new Set(
  [
    ...String((import.meta as any).env?.VITE_EXTRA_ALLOWED_EMAILS ?? '').split(','),
    ...HARDCODED_ALLOWED_EMAILS,
  ]
    .map(e => e.trim().toLowerCase())
    .filter(Boolean),
)

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

      // Domínio corporativo obrigatório — exceto emails na allowlist.
      const email = (nextSession.user.email ?? '').toLowerCase()
      const isCorporate = email.endsWith('@' + CORPORATE_DOMAIN)
      const isAllowedException = EXTRA_ALLOWED_EMAILS.has(email)
      if (!isCorporate && !isAllowedException) {
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

      // Foto do Google. Buscamos em DUAS fontes porque alguns usuários têm a
      // foto apenas em identity_data (auth.identities), e não em user_metadata.
      //   1) user_metadata.avatar_url / picture
      //   2) identities[].identity_data.avatar_url / picture  ← mais confiável
      const meta = nextSession.user.user_metadata ?? {}
      const fromIdentities = (nextSession.user.identities ?? [])
        .map(i => {
          const d = (i.identity_data ?? {}) as Record<string, unknown>
          return (d.avatar_url ?? d.picture) as string | undefined
        })
        .find(Boolean)
      const avatarUrl: string | null =
        meta.avatar_url ?? meta.picture ?? fromIdentities ?? null

      await fetchProfile(nextSession.user.id)

      // Garante que a foto do Google apareça e fique salva. Antes havia uma
      // corrida: o update não era aguardado e o fetchProfile lia o avatar ainda
      // nulo. Agora corrigimos o estado local na hora e persistimos no banco,
      // aguardando o resultado e logando falhas (antes era fire-and-forget e
      // erros passavam despercebidos).
      if (avatarUrl) {
        setProfile(prev => (prev && prev.avatar_url !== avatarUrl)
          ? { ...prev, avatar_url: avatarUrl }
          : prev)
        const { error: avatarErr } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', nextSession.user.id)
        if (avatarErr) console.error('[useAuth] avatar update failed:', avatarErr.message)
      }
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
