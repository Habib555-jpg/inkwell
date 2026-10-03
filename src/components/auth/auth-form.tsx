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
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }} className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0.7, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.1 }} className="bg-brand mb-4 grid size-14 place-items-center rounded-2xl text-white shadow-glow">
            <Feather className="size-6" aria-hidden />
          </motion.div>
          <h1 className="text-gradient pb-1 font-serif text-4xl font-semibold tracking-tight">Inkwell</h1>
          <p className="mt-1 text-sm text-ink-soft">Your novel&apos;s writing partner. Approved canon is truth.</p>
        </div>
        <form action={formAction} className="glass space-y-4 rounded-2xl border border-line p-6 shadow-lift">
          <h2 className="font-serif text-xl font-semibold">{isLogin ? 'Welcome back' : 'Create your account'}</h2>
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
