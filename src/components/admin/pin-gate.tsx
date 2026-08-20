'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'

interface PinGateProps {
  onSuccess: () => void
}

export function PinGate({ onSuccess }: PinGateProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pin) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        toast({ title: 'Welcome back', description: 'Session established.' })
        onSuccess()
      } else {
        setShake(true)
        setTimeout(() => setShake(false), 450)
        toast({
          title: 'Invalid PIN',
          description: 'Please try again.',
          variant: 'destructive',
        })
        setPin('')
        inputRef.current?.focus()
      }
    } catch {
      toast({
        title: 'Network error',
        description: 'Could not reach the server.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen enphera-body flex flex-col items-center justify-center px-4">
      <div className="absolute top-6 left-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--enphera-muted)] hover:text-[color:var(--enphera-amber)] transition-colors font-sans"
        >
          <ArrowLeft size={16} /> Back to Compendium
        </Link>
      </div>

      <div
        className={`w-full max-w-sm ${shake ? 'enphera-shake' : ''}`}
      >
        <div className="text-center mb-8">
          <h1 className="enphera-brand text-3xl text-[color:var(--enphera-amber)]">
            ENPHERA
          </h1>
          <p className="mt-1 text-xs text-[color:var(--enphera-muted)] font-sans uppercase tracking-widest">
            Admin Access
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-[color:var(--enphera-bg-elevated)] border border-[color:var(--enphera-border)] rounded-lg p-6 space-y-4"
        >
          <label
            htmlFor="admin-pin"
            className="block text-sm font-sans text-[color:var(--enphera-text)]"
          >
            Enter PIN
          </label>
          <Input
            id="admin-pin"
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
            placeholder="• • • •"
            maxLength={8}
            className="text-center text-2xl tracking-[0.5em] bg-[color:var(--enphera-bg)] border-[color:var(--enphera-border)] text-[color:var(--enphera-text)] font-mono"
          />
          <Button
            type="submit"
            disabled={loading || pin.length < 4}
            className="w-full bg-[color:var(--enphera-amber)] text-[color:var(--enphera-bg)] hover:bg-[color:var(--enphera-amber-soft)] font-sans font-semibold"
          >
            {loading ? 'Verifying…' : 'Unlock'}
          </Button>
          <p className="text-xs text-center text-[color:var(--enphera-muted)] font-sans pt-2">
            Default PIN: <code className="text-[color:var(--enphera-amber)]">1234</code>{' '}
            (change via <code>.env.local</code>)
          </p>
        </form>
      </div>
    </div>
  )
}
