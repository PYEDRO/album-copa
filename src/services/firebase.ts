// Firebase foi substituido pelo Supabase.
// Este arquivo existe apenas para compatibilidade e nao e importado pela aplicacao.

export const auth = null
export const db = null
export const googleProvider = null
export const signInWithGoogle = async (): Promise<never> => {
  throw new Error("Firebase removido. Use o Supabase Auth em src/hooks/useAuth.ts")
}
