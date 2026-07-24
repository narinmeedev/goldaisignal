import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';
import { jwtVerify } from 'jose';
import { minisaas } from '@/lib/minisaas';
import { getJwtSecretKey } from '@/lib/auth';

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  // Send non-blocking heartbeat to Mini SaaS Center
  if (pathname.startsWith('/admin') || pathname === '/') {
    event.waitUntil(minisaas.heartbeat("UP", 25).catch(() => {}));
  }
  
  // Only protect /admin routes
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      // Not logged in, redirect to login
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    try {
      const { payload } = await jwtVerify(token, getJwtSecretKey());
      
      // Role-based protection: block non-admins from certain pages
      const role = payload.role as string;
      const adminOnlyPrefixes = [
        '/admin/users',
        '/admin/payments',
        '/admin/settings',
        '/admin/logs',
        '/admin/affiliate-manager',
      ];
      const isAdminRoute = adminOnlyPrefixes.some((prefix) => pathname.startsWith(prefix));
      
      if (isAdminRoute && role !== 'admin') {
        // Redirect standard users away from admin-only areas
        const dashboardUrl = new URL('/admin', request.url);
        return NextResponse.redirect(dashboardUrl);
      }
      
      // Allow access
      return NextResponse.next();
    } catch (error) {
      // Invalid token, redirect to login
      const loginUrl = new URL('/login', request.url);
      // Optional: clear the bad cookie
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('auth_token');
      return response;
    }
  }

  // Prevent logged in users from seeing the login page
  if (pathname === '/login') {
    const token = request.cookies.get('auth_token')?.value;
    if (token) {
      try {
        await jwtVerify(token, getJwtSecretKey());
        const dashboardUrl = new URL('/admin', request.url);
        return NextResponse.redirect(dashboardUrl);
      } catch {
        // Token is invalid, let them see the login page
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/login'],
};
