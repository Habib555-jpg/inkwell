import { NextResponse, type NextRequest } from 'next/server';
const PUBLIC = ['/login', '/register'];
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const has = req.cookies.has('wn_session');
  if (!isPublic && !has) return NextResponse.redirect(new URL('/login', req.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'] };
