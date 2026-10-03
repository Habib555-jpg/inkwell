'use client';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

type Dot = { x: number; y: number; tx: number; ty: number; size: number; alpha: number; target: number; dx: number; dy: number; mag: number };

/**
 * Drifting particles that lean toward the cursor (adapted from Magic UI "Particles").
 * Unlike the original, the pointer is tracked in a ref (no React re-render per mouse move), the loop pauses when
 * the tab is hidden, and reduced motion draws a single still frame. Colour defaults to the theme accent.
 */
export function Particles({ className, quantity = 70, size = 0.5, staticity = 50, ease = 50 }: {
  className?: string; quantity?: number; size?: number; staticity?: number; ease?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const box = wrap.current, cv = canvas.current, ctx = cv?.getContext('2d');
    if (!box || !cv || !ctx) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = window.devicePixelRatio || 1;
    const mouse = { x: 0, y: 0 };
    let w = 0, h = 0, raf = 0, dots: Dot[] = [];
    const rgb = () => getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim() || '#a597ff';
    let color = rgb();

    const make = (): Dot => ({
      x: Math.random() * w, y: Math.random() * h, tx: 0, ty: 0, size: Math.floor(Math.random() * 2) + size,
      alpha: reduce ? 0.5 : 0, target: +(Math.random() * 0.6 + 0.1).toFixed(2),
      dx: (Math.random() - 0.5) * 0.12, dy: (Math.random() - 0.5) * 0.12, mag: 0.1 + Math.random() * 4,
    });
    const resize = () => {
      w = box.offsetWidth; h = box.offsetHeight;
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = `${w}px`; cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: quantity }, make);
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = color;
      for (const d of dots) {
        ctx.globalAlpha = d.alpha;
        ctx.beginPath(); ctx.arc(d.x + d.tx, d.y + d.ty, d.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    const step = () => {
      for (let i = 0; i < dots.length; i++) {
        const d = dots[i];
        const edge = Math.min(d.x + d.tx, w - d.x - d.tx, d.y + d.ty, h - d.y - d.ty);
        const fade = Math.max(0, Math.min(1, edge / 20));
        d.alpha = fade >= 1 ? Math.min(d.target, d.alpha + 0.02) : d.target * fade;
        d.x += d.dx; d.y += d.dy;
        d.tx += (mouse.x / (staticity / d.mag) - d.tx) / ease;
        d.ty += (mouse.y / (staticity / d.mag) - d.ty) / ease;
        if (d.x < -d.size || d.x > w + d.size || d.y < -d.size || d.y > h + d.size) dots[i] = make();
      }
      draw();
      raf = requestAnimationFrame(step);
    };
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      const x = e.clientX - r.left - w / 2, y = e.clientY - r.top - h / 2;
      if (Math.abs(x) < w / 2 && Math.abs(y) < h / 2) { mouse.x = x; mouse.y = y; }
    };
    const onVisibility = () => { cancelAnimationFrame(raf); if (!document.hidden && !reduce) raf = requestAnimationFrame(step); };
    // follow theme switches (the accent changes between light and dark)
    const themeObs = new MutationObserver(() => { color = rgb(); if (reduce) draw(); });

    resize();
    if (reduce) draw(); else raf = requestAnimationFrame(step);
    const ro = new ResizeObserver(() => { resize(); if (reduce) draw(); });
    ro.observe(box);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); themeObs.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [quantity, size, staticity, ease]);

  return (
    <div ref={wrap} aria-hidden className={cn('pointer-events-none', className)}>
      <canvas ref={canvas} className="size-full" />
    </div>
  );
}
