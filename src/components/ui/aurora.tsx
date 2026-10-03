'use client';
import { useEffect, useRef } from 'react';
import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';
import { cn } from '@/lib/cn';

/*
 * Flowing aurora light (React Bits "Aurora", installed via the shadcn registry; WebGL through `ogl`).
 * Adapted: colours are parsed once, the canvas follows its container (ResizeObserver), the loop pauses while the
 * tab is hidden, reduced motion renders one still frame, light/dark follows the `dark` class on <html>, and a
 * browser without WebGL 2 simply shows nothing instead of throwing.
 */

const VERT = `#version 300 es
in vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`;

const FRAG = `#version 300 es
precision highp float;
uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;
uniform float uLightMode;
out vec4 fragColor;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  // three-stop ramp across x
  vec3 rampColor = uv.x < 0.5
    ? mix(uColorStops[0], uColorStops[1], uv.x / 0.5)
    : mix(uColorStops[1], uColorStops[2], (uv.x - 0.5) / 0.5);
  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;
  height = exp(height);
  height = (uv.y * 2.0 - height + 0.2);
  float intensity = 0.6 * height;
  float auroraAlpha = smoothstep(0.20 - uBlend * 0.5, 0.20 + uBlend * 0.5, intensity);
  if (uLightMode > 0.5) {
    // light theme: tinted light on a transparent canvas, so the page's paper shows through
    fragColor = vec4(rampColor * auroraAlpha * 0.55, auroraAlpha * 0.55);
  } else {
    fragColor = vec4(intensity * rampColor * auroraAlpha, auroraAlpha);
  }
}
`;

const toRgb = (hex: string) => { const c = new Color(hex); return [c.r, c.g, c.b]; };

/** Position it yourself (e.g. `absolute inset-0`): the canvas fills the nearest positioned box. */
export function Aurora({ className, colorStops = ['#7c6cff', '#4fa8ff', '#b3a4ff'], amplitude = 1, blend = 0.5, speed = 1 }: {
  className?: string; colorStops?: [string, string, string]; amplitude?: number; blend?: number; speed?: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [c0, c1, c2] = colorStops;

  useEffect(() => {
    const ctn = box.current;
    if (!ctn) return;
    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true, dpr: Math.min(window.devicePixelRatio, 1.5) });
    } catch { return; } // no WebGL: leave the static glow behind it
    const gl = renderer.gl;
    if (!('drawBuffers' in gl)) return; // the shader needs WebGL 2
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const canvas = gl.canvas as HTMLCanvasElement;
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:transparent';

    const geometry = new Triangle(gl);
    delete (geometry.attributes as Record<string, unknown>).uv;
    const isLight = () => (document.documentElement.classList.contains('dark') ? 0 : 1);
    const program = new Program(gl, {
      vertex: VERT, fragment: FRAG,
      uniforms: {
        uTime: { value: 0 }, uAmplitude: { value: amplitude }, uBlend: { value: blend },
        uColorStops: { value: [toRgb(c0), toRgb(c1), toRgb(c2)] },
        uResolution: { value: [ctn.offsetWidth, ctn.offsetHeight] },
        uLightMode: { value: isLight() },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });
    ctn.appendChild(canvas);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const frame = (t: number) => {
      program.uniforms.uTime.value = t * 0.001 * speed;
      renderer.render({ scene: mesh });
    };
    const loop = (t: number) => { frame(t); raf = requestAnimationFrame(loop); };
    const start = () => { cancelAnimationFrame(raf); if (reduce) frame(4000); else if (!document.hidden) raf = requestAnimationFrame(loop); };
    const resize = () => {
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      program.uniforms.uResolution.value = [ctn.offsetWidth, ctn.offsetHeight];
      if (reduce) frame(4000);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(ctn);
    const themeObs = new MutationObserver(() => { program.uniforms.uLightMode.value = isLight(); if (reduce) frame(4000); });
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', start);
    resize();
    start();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); themeObs.disconnect();
      document.removeEventListener('visibilitychange', start);
      if (canvas.parentNode === ctn) ctn.removeChild(canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [c0, c1, c2, amplitude, blend, speed]);

  return <div ref={box} aria-hidden className={cn('pointer-events-none overflow-hidden', className)} />;
}
