import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    name: 'Enphera Compendium API',
    endpoints: {
      public: ['/api/chapters'],
      admin: [
        '/api/admin/auth (POST pin, DELETE sign-out)',
        '/api/admin/session (GET session check)',
        '/api/admin/chapters (POST upload)',
        '/api/admin/chapters/[id] (GET preview, PUT replace, DELETE remove)',
        '/api/admin/reorder (PATCH reorder)',
        '/api/admin/scan (POST/GET sync content/)',
      ],
    },
  })
}
