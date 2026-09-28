import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTE_PREFIXES = ['/login', '/auth', '/tienda', '/catalogo', '/_next', '/api'];

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
    pathname.includes('.') ||
    pathname === '/favicon.ico' ||
    pathname === '/logo-elohim.png'
  );
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const isPublicRoute = isPublicPath(pathname);

  // Fail-closed: si Supabase no está configurado, en producción las rutas protegidas redirigen a /login.
  // En desarrollo local se permite continuar para trabajar con el fallback simulado.
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('placeholder')) {
    if (process.env.NODE_ENV === 'production' && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            supabaseResponse = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (user && pathname === '/login') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  } catch (error) {
    console.error('Error en updateSession middleware:', error);
    // Fail-closed: si falla la validación de sesión en una ruta protegida del ERP,
    // redirigir a /login en lugar de dejar pasar la petición sin autenticar.
    if (!isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }
}
