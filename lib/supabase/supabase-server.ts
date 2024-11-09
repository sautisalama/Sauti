import { Database, Tables } from '@/types/db-schema'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
    const cookieStore = cookies()

    return createServerClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
        cookies: {
            get(name: string) {
            return cookieStore.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
            try {
                cookieStore.set({ name, value, ...options })
            } catch (error) {
                // The `set` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
            }
            },
            remove(name: string, options: CookieOptions) {
            try {
                cookieStore.set({ name, value: '', ...options })
            } catch (error) {
                // The `delete` method was called from a Server Component.
                // This can be ignored if you have middleware refreshing
                // user sessions.
            }
            },
        },
        }
    )
}

export async function getSession() {
    const supabase = createClient()

    const {
        data: { session },
    } = await supabase.auth.getSession()
    return session
}


export async function getProfileDetails() {
    const supabase = createClient()
    try {
        const session = await getSession()
        if (!session?.user?.id) return null
        const { data, error }: { data: Tables<'profiles'> | null; error: any } =
            await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id ?? '')
                .single()

            if (error) throw error

        return data
    } catch (error) {
        console.error('get user profile error:', error)
        return null
    }
}