import { useEffect, useState } from "react";

// Iris-led celebratory palette: the brand accent leads, with a few warm/cool
// confetti notes so the burst still reads festive on the light paper theme.
const COLORS = ["#5126e0", "#7c5cff", "#0e9f6e", "#f59e0b", "#fb7185", "#0e9aab"];
const PARTICLE_COUNT = 32;

type Particle = {
  id: number;
  x: number;
  y: number;
  rot: number;
  scale: number;
  color: string;
  delay: number;
};

/**
 * One-shot confetti-like burst from the top-center. CSS animations only —
 * no dependency, no canvas, ~32 elements that GC themselves after the run.
 * Honors prefers-reduced-motion.
 */
export function Celebration({
  trigger,
  onDone,
}: {
  /** Toggle to true to fire a single burst. Reset to false (or just leave) — the burst auto-clears. */
  trigger: boolean;
  onDone?: () => void;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!trigger) return;
    if (typeof window !== "undefined") {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        onDone?.();
        return;
      }
    }
    const next: Particle[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      next.push({
        id: i,
        // angle spread across the top, gentle falloff at edges
        x: 50 + (Math.random() - 0.5) * 80,
        // start slightly above the viewport so they fly down
        y: -10,
        rot: Math.random() * 360,
        scale: 0.6 + Math.random() * 0.8,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 120,
      });
    }
    setParticles(next);
    const timeout = setTimeout(() => {
      setParticles([]);
      onDone?.();
    }, 1800);
    return () => clearTimeout(timeout);
  }, [trigger, onDone]);

  if (particles.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] overflow-hidden"
      aria-hidden="true"
      data-testid="celebration-burst"
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute block w-2 h-2 rounded-[2px] animate-celebrate"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            backgroundColor: p.color,
            transform: `rotate(${p.rot}deg) scale(${p.scale})`,
            animationDelay: `${p.delay}ms`,
            boxShadow: `0 0 6px ${p.color}80`,
          }}
        />
      ))}
    </div>
  );
}
