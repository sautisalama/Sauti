'use server'

import { createClient } from '@/lib/supabase/supabase-server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
    const supabase = createClient()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
    })

    if (error) {
        return { error: error.message }
    }

    redirect('/signin')
}

export async function signIn(formData: FormData) {
    const supabase = createClient()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    redirect('/dashboard')
}

export async function signInWithGoogle() {
    const supabase = createClient()
    
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
        },
    })

    if (error) {
        return { error: error.message }
    }
} 