import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const txt = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

Sitemap: https://goldaisig.com/sitemap.xml
`;

  return new NextResponse(txt, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400',
    },
  });
}
