import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/auth-form';
import { registerAction } from '../actions';

export const metadata: Metadata = { title: 'Create account' };
export default function RegisterPage() {
  return <AuthForm mode="register" action={registerAction} />;
}
