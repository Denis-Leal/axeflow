import { NextResponse } from 'next/server';

// O mesmo deploy atende app interno e portal. No subdomínio, a raiz abre o feed.
export function middleware(request) {
  const host = request.headers.get('host') || '';
  if (host.toLowerCase().startsWith('portal.') && request.nextUrl.pathname === '/') {
    return NextResponse.rewrite(new URL('/portal', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/'] };
