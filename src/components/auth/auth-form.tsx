'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Feather } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import type { ActionResult } from '@/app/_actions/result';

type Action = (prev: unknown, form: FormData) => Promise<ActionResult<null>>;

export function AuthForm({ mode, action }: { mode: 'login' | 'register'; action: Action }) {
  const [state, formAction, pending] = useActionState(action, null);
  const error = state && !state.ok ? state.error : null;
  const isLogin = mode === 'login';
  return (
    <main className="bg-hero grid min-h-dvh place-items-center px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-strong text-accent-ink shadow-lift">
            <Feather className="size-6" aria-hidden />
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Inkwell</h1>
          <p className="mt-1 text-sm text-ink-soft">Your novel&apos;s writing partner. Approved canon is truth.</p>
        </div>
        <form action={formAction} className="space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-card">
          <h2 className="text-lg font-semibold">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
          {!isLogin && <Field label="Name">{(p) => <Input {...p} name="name" autoComplete="name" />}</Field>}
          <Field label="Email">{(p) => <Input {...p} name="email" type="email" required autoComplete="email" />}</Field>
          <Field label="Password" hint={isLogin ? undefined : 'At least 8 characters.'}>
            {(p) => <Input {...p} name="password" type="password" required minLength={isLogin ? undefined : 8} autoComplete={isLogin ? 'current-password' : 'new-password'} />}
          </Field>
          {error && (
            <motion.p role="alert" initial={{ x: -6 }} animate={{ x: [6, -4, 2, 0] }} transition={{ duration: 0.3 }} className="rounded-lg bg-changed-soft px-3 py-2 text-sm text-changed">
              {error}
            </motion.p>
          )}
          <Button type="submit" className="w-full" loading={pending}>{isLogin ? 'Sign in' : 'Create account'}</Button>
        </form>
        <p className="mt-4 text-center text-sm text-ink-soft">
          {isLogin ? 'New here? ' : 'Already have an account? '}
          <Link className="font-medium text-accent hover:underline" href={isLogin ? '/register' : '/login'}>{isLogin ? 'Create an account' : 'Sign in'}</Link>
        </p>
      </motion.div>
    </main>
  );
}
