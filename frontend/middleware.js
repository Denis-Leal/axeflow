
import { NextResponse } from 'next/server';

export function middleware(request) {
  const host = (request.headers.get('host') || '')
    .toLowerCase()
    .split(':')[0];

  const isPortalHost =
    host === 'portal.axeflow.dbltech.com.br' ||
    host === 'www.portal.axeflow.dbltech.com.br';

  if (isPortalHost && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/portal', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/'],
};
