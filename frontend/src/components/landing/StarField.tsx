"use client";

/** Twinkling canvas starfield with gentle pointer parallax. DPR-aware,
 * rAF-driven, fully disabled under prefers-reduced-motion. */
import { useEffect, useRef } from "react";

interface Star {
  x: number; // 0..1
  y: number;
  r: number;
  phase: number;
  speed: number;
  depth: number; // parallax factor
  warm: boolean;
}

export function StarField({ count = 140, className = "" }: { count?: number; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const stars: Star[] = Array.from({ length: count }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.4 + Math.random() * 1.4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 1.1,
      depth: 0.3 + Math.random() * 0.7,
      warm: Math.random() < 0.45,
    }));

    let raf = 0;
    let width = 0;
    let height = 0;
    const pointer = { x: 0.5, y: 0.5 };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const onPointer = (e: PointerEvent) => {
      pointer.x = e.clientX / window.innerWidth;
      pointer.y = e.clientY / window.innerHeight;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height);
      for (const s of stars) {
        const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(s.phase + (t / 1000) * s.speed));
        const px = (pointer.x - 0.5) * 18 * s.depth;
        const py = (pointer.y - 0.5) * 12 * s.depth;
        ctx.beginPath();
        ctx.arc(s.x * width + px, s.y * height + py, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.warm
          ? `rgba(255, 217, 160, ${0.55 * tw})`
          : `rgba(216, 200, 255, ${0.5 * tw})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, [count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none absolute inset-0 h-full w-full ${className}`}
    />
  );
}
