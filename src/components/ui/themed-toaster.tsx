'use client';
import { useEffect, useState } from 'react';
import { Toaster } from 'sonner';

/** Sonner toasts that follow the `dark` class on <html> (set before paint, toggled by ThemeToggle). */
export function ThemedToaster() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setTheme(el.classList.contains('dark') ? 'dark' : 'light');
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return <Toaster position="bottom-right" theme={theme} richColors closeButton />;
}
