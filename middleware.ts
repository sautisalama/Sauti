import { type NextRequest, NextResponse } from 'next/server';
  import { updateSession } from '@/lib/supabase/midleware';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
    const res = await updateSession(req);

    // Protect dashboard routes
    if (req.nextUrl.pathname.startsWith('/dashboard')) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name) {
                        return req.cookies.get(name)?.value
                    },
                },
            }
        );
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
            return NextResponse.redirect(new URL('/signin', req.url));
        }
    }

    return res;
}

// match routes
export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)',
        '/dashboard/:path*',
    ],
}