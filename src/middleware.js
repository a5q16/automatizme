import { NextResponse } from 'next/server';

export function middleware(request) {
  const path = request.nextUrl.pathname;

  // حماية جميع مسارات الأدمن ما عدا صفحة تسجيل الدخول
  if (path.startsWith('/admin') && !path.startsWith('/admin/login')) {
    const session = request.cookies.get('admin_session');
    
    // إذا لم تكن هناك جلسة، اطرده فورا إلى صفحة الدخول
    if (!session) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};