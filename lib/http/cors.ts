import { NextResponse } from 'next/server'

const defaultOrigins = [
  'https://taste-ruddy.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function allowedOrigins() {
  const configured = (process.env.APP_CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
  return new Set([...defaultOrigins, ...configured])
}

export function withAppCors(response: NextResponse, request: Request) {
  const origin = request.headers.get('origin')
  if (origin && allowedOrigins().has(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Vary', 'Origin')
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    response.headers.set('Access-Control-Max-Age', '86400')
  }
  return response
}

export function appCorsOptions(request: Request) {
  return withAppCors(new NextResponse(null, { status: 204 }), request)
}
