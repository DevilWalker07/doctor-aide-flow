import { supabase } from './supabase'

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUp(
  email: string,
  password: string,
  name: string,
  crm?: string,
  specialty?: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        crm: crm || null,
        specialty: specialty || null,
      },
    },
  })
  if (error) throw error
  if (data.user && data.session) {
    await supabase.from('profiles').insert({
      user_id: data.user.id,
      name,
      crm: crm || null,
      specialty: specialty || null,
    })
  }
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/nova-senha',
  })
  if (error) throw error
}
