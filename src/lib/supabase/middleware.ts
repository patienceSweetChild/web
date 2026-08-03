import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { UserRole } from '@/features/users/types';

const ROUTE_ROLE_GATES: { prefix: string; allowed: UserRole[] }[] = [
  { prefix: '/admin',         allowed: ['super_admin', 'admin'] },
  { prefix: '/notifications', allowed: ['super_admin', 'admin', 'team_leader', 'sales'] },
  { prefix: '/users',         allowed: ['super_admin', 'admin', 'team_leader'] },
  { prefix: '/clients',       allowed: ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'] },
  { prefix: '/projects',      allowed: ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'] },
  { prefix: '/onboarding',    allowed: ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'] },
  { prefix: '/profile',       allowed: ['super_admin', 'admin', 'team_leader', 'sales', 'viewer'] },
];

const PUBLIC_PATHS = ['/login', '/_next', '/favicon.ico'];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured (local-only mode), allow everything through
  if (!url || !key) return supabaseResponse;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const pathname = request.nextUrl.pathname;

  // Allow public paths through always
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  // Check role-gated routes
  const gate = ROUTE_ROLE_GATES.find((g) => pathname.startsWith(g.prefix));
  if (gate) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as UserRole | undefined;
    if (!role || !gate.allowed.includes(role)) {
      // Redirect to boards/catalog with an access-denied param
      const denied = request.nextUrl.clone();
      denied.pathname = '/boards/catalog';
      denied.searchParams.set('denied', '1');
      return NextResponse.redirect(denied);
    }
  }

  return supabaseResponse;
}
