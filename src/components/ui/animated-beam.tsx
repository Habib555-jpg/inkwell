'use client';
import { useEffect, useId, useState, type RefObject } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/cn';

/**
 * A beam of light travelling along a curved path between two elements (Magic UI "Animated Beam").
 * Colours default to the Midnight Ink accent gradient; the path re-measures whenever the container resizes.
 */
export function AnimatedBeam({
  className, containerRef, fromRef, toRef, curvature = 0, reverse = false, duration = 5, delay = 0,
  pathWidth = 2, pathOpacity = 0.18, startColor = 'var(--color-accent)', stopColor = 'var(--color-sky)',
}: {
  className?: string; containerRef: RefObject<HTMLElement | null>; fromRef: RefObject<HTMLElement | null>; toRef: RefObject<HTMLElement | null>;
  curvature?: number; reverse?: boolean; duration?: number; delay?: number; pathWidth?: number; pathOpacity?: number;
  startColor?: string; stopColor?: string;
}) {
  const id = useId();
  const [d, setD] = useState('');
  const [size, setSize] = useState({ width: 0, height: 0 });
  const g = reverse ? { x1: ['90%', '-10%'], x2: ['100%', '0%'] } : { x1: ['10%', '110%'], x2: ['0%', '100%'] };

  useEffect(() => {
    const update = () => {
      const c = containerRef.current, a = fromRef.current, b = toRef.current;
      if (!c || !a || !b) return;
      const cr = c.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
      setSize({ width: cr.width, height: cr.height });
      const sx = ra.left - cr.left + ra.width / 2, sy = ra.top - cr.top + ra.height / 2;
      const ex = rb.left - cr.left + rb.width / 2, ey = rb.top - cr.top + rb.height / 2;
      setD(`M ${sx},${sy} Q ${(sx + ex) / 2},${sy - curvature} ${ex},${ey}`);
    };
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    update();
    return () => ro.disconnect();
  }, [containerRef, fromRef, toRef, curvature]);

  return (
    <svg fill="none" width={size.width} height={size.height} viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden
      className={cn('pointer-events-none absolute left-0 top-0 transform-gpu', className)}>
      <path d={d} stroke="var(--color-line-strong)" strokeWidth={pathWidth} strokeOpacity={pathOpacity * 3} strokeLinecap="round" />
      <path d={d} stroke={`url(#${id})`} strokeWidth={pathWidth} strokeLinecap="round" />
      <defs>
        <motion.linearGradient id={id} gradientUnits="userSpaceOnUse" className="transform-gpu"
          initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
          animate={{ x1: g.x1, x2: g.x2, y1: ['0%', '0%'], y2: ['0%', '0%'] }}
          transition={{ delay, duration, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0 }}>
          <stop stopColor={startColor} stopOpacity="0" />
          <stop stopColor={startColor} />
          <stop offset="32.5%" stopColor={stopColor} />
          <stop offset="100%" stopColor={stopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
