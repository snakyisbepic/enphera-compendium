import { cookies } from 'next/headers'
import { getIronSession, type SessionOptions } from 'iron-session'

export interface AdminSession {
  admin?: boolean
  loginAt?: number
}

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  'dev-only-insecure-secret-please-override-in-production-environment-variable'
const SESSION_COOKIE_NAME =
  process.env.SESSION_COOKIE_NAME || 'enphera_admin_session'

export const sessionOptions: SessionOptions = {
  password: SESSION_SECRET,
  cookieName: SESSION_COOKIE_NAME,
  ttl: 60 * 60 * 24, // 24 hours
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  },
}

export async function getSession() {
  const cookieStore = await cookies()
  return getIronSession<AdminSession>(cookieStore, sessionOptions)
}

export async function isAuthenticated() {
  const session = await getSession()
  return session?.admin === true
}

export async function requireAuth() {
  const ok = await isAuthenticated()
  if (!ok) {
    return false
  }
  return true
}

export const ADMIN_PIN = process.env.ADMIN_PIN || '1234'
