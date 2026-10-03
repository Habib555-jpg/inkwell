'use client';
import confetti from 'canvas-confetti';

const COLORS = ['#a597ff', '#6a55f0', '#5eb3ff', '#5cc79b', '#ffffff'];

/**
 * A short celebration burst in the Midnight Ink palette (after Magic UI "Confetti", canvas-confetti).
 * Fired when a chapter becomes canon. Skipped entirely under prefers-reduced-motion.
 */
export function celebrate(from?: HTMLElement | null) {
  if (typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = from?.getBoundingClientRect();
  const origin = r ? { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight } : { x: 0.5, y: 0.6 };
  const base = { origin, colors: COLORS, zIndex: 9999, disableForReducedMotion: true, ticks: 220 };
  void confetti({ ...base, particleCount: 70, spread: 70, startVelocity: 42 });
  setTimeout(() => void confetti({ ...base, particleCount: 40, spread: 110, startVelocity: 28, scalar: 0.8 }), 180);
}
