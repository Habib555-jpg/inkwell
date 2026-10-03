'use client';
import { useEffect, useRef } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';

const EASE = [0.16, 1, 0.3, 1] as const;

/** Fades and lifts its children in once, when they first enter the viewport. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.5, ease: EASE, delay }}>
      {children}
    </motion.div>
  );
}

const list = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } } };

/** A <ul> whose <StaggerItem> children cascade in one after another. */
export function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return <motion.ul className={className} variants={list} initial={reduce ? false : 'hidden'} animate="show">{children}</motion.ul>;
}
export function StaggerItem({ children, className, lift }: { children: React.ReactNode; className?: string; lift?: boolean }) {
  return (
    <motion.li className={className} variants={item} whileHover={lift ? { y: -4 } : undefined} transition={{ duration: 0.2 }}>
      {children}
    </motion.li>
  );
}

/** Counts from 0 to `value` when scrolled into view; renders the final number with reduced motion. */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || reduce) return;
    const c = animate(0, value, { duration: 0.9, ease: 'easeOut', onUpdate: (v) => { el.textContent = Math.round(v).toLocaleString(); } });
    return () => c.stop();
  }, [inView, value, reduce]);
  return <span ref={ref} className={className}>{value.toLocaleString()}</span>;
}
