import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Check if dev mode is enabled
  const isDevMode = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV === 'true';

  // Bypass proxy if in dev mode
  if (isDevMode) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow access to login page without authentication
  if (pathname === '/login') {
    // Check if user is already authenticated
    const authToken = request.cookies.get('auth_token')?.value;
    const sessionToken = request.cookies.get('session')?.value;
    const isAuthenticated = !!authToken || !!sessionToken;

    // If authenticated and trying to access login, redirect to home
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Allow access to login page
    return NextResponse.next();
  }

  // Check authentication for all other pages
  const authToken = request.cookies.get('auth_token')?.value;
  const sessionToken = request.cookies.get('session')?.value;
  const isAuthenticated = !!authToken || !!sessionToken;

  // If not authenticated, redirect to login
  if (!isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Preserve the original path for redirect after login
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Allow access to protected pages
  return NextResponse.next();
}

// Configure which routes the proxy should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc.)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};






















