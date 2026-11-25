import React, { useEffect, useRef } from 'react';
import { Award, Droplets, Flame, Sparkles, X } from 'lucide-react';
import type { Language } from '../types/fitplate';

export type CelebrationKind = 'calorie' | 'protein' | 'carbs' | 'fat' | 'fiber' | 'water';

interface ConfettiOverlayProps {
  celebration: { id: number; kind: CelebrationKind } | null;
  language: Language;
  onDone: () => void;
}

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  vRot: number;
  tiltPhase: number;
  tiltSpeed: number;
  shape: 'ribbon' | 'dot';
  alpha: number;
}

const CONFETTI_PALETTES: Record<CelebrationKind, string[]> = {
  calorie: ['#10b981', '#34d399', '#fbbf24', '#6ee7b7', '#f59e0b'],
  protein: ['#10b981', '#34d399', '#2dd4bf', '#fde047', '#a7f3d0'],
  carbs: ['#38bdf8', '#60a5fa', '#fbbf24', '#34d399', '#bae6fd'],
  fat: ['#fbbf24', '#f59e0b', '#34d399', '#fde68a', '#fb923c'],
  fiber: ['#2dd4bf', '#10b981', '#5eead4', '#fbbf24', '#a7f3d0'],
  water: ['#0ea5e9', '#38bdf8', '#2dd4bf', '#7dd3fc', '#10b981'],
};

function getCelebrationCopy(kind: CelebrationKind, isHi: boolean) {
  switch (kind) {
    case 'protein':
      return {
        title: isHi ? 'प्रोटीन लक्ष्य पूरा!' : 'Protein Goal Reached!',
        subtitle: isHi
          ? 'आज का दैनिक प्रोटीन लक्ष्य हासिल हुआ।'
          : 'You hit your daily protein target.',
      };
    case 'carbs':
      return {
        title: isHi ? 'कार्ब्स लक्ष्य पूर्ण!' : 'Carbs Goal Reached!',
        subtitle: isHi
          ? 'आपका दैनिक कार्बोहाइड्रेट लक्ष्य पूरा हुआ।'
          : 'You hit your daily carbs target.',
      };
    case 'fat':
      return {
        title: isHi ? 'हेल्दी फैट्स लक्ष्य पूर्ण!' : 'Healthy Fats Goal Reached!',
        subtitle: isHi
          ? 'आज का फैट लक्ष्य पूरा हुआ।'
          : 'You hit your daily healthy fat target.',
      };
    case 'fiber':
      return {
        title: isHi ? 'फाइबर लक्ष्य पूर्ण!' : 'Fiber Goal Reached!',
        subtitle: isHi
          ? 'आज का फाइबर लक्ष्य पूरा हुआ।'
          : 'You reached your daily fiber goal.',
      };
    case 'water':
      return {
        title: isHi ? '100% पानी का लक्ष्य पूर्ण!' : 'Daily Water Goal Reached!',
        subtitle: isHi
          ? 'शानदार हाइड्रेशन! आज का पानी लक्ष्य पूरा हुआ।'
          : 'Great hydration — you completed your daily water target.',
      };
    case 'calorie':
    default:
      return {
        title: isHi ? 'दैनिक कैलोरी लक्ष्य पूर्ण!' : 'Daily Calorie Goal Reached!',
        subtitle: isHi
          ? 'बढ़िया! आपने आज का कैलोरी लक्ष्य पूरा कर लिया।'
          : 'Nice work — you reached your daily calorie target.',
      };
  }
}

export const ConfettiOverlay: React.FC<ConfettiOverlayProps> = ({
  celebration,
  language,
  onDone,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isHi = language === 'hi';

  useEffect(() => {
    if (!celebration) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const timer = window.setTimeout(onDone, 2400);
      return () => window.clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const palette = CONFETTI_PALETTES[celebration.kind] || CONFETTI_PALETTES.calorie;

    // Gentle top-edge & upper-center bursts for a subtle, clean confetti effect
    const origins = [
      { x: w * 0.28, y: h * 0.14 },
      { x: w * 0.5, y: h * 0.1 },
      { x: w * 0.72, y: h * 0.14 },
    ];

    const pieces: ConfettiPiece[] = Array.from({ length: 64 }, (_, idx) => {
      const origin = origins[idx % origins.length];
      const spreadAngle = -Math.PI / 2 + (Math.random() - 0.5) * 2.1;
      const speed = 2.0 + Math.random() * 4.8;
      return {
        x: origin.x + (Math.random() - 0.5) * 32,
        y: origin.y + (Math.random() - 0.5) * 14,
        vx: Math.cos(spreadAngle) * speed,
        vy: Math.sin(spreadAngle) * speed * 0.65 + 0.6,
        w: 5 + Math.random() * 4,
        h: 3 + Math.random() * 3,
        color: palette[idx % palette.length],
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.14,
        tiltPhase: Math.random() * Math.PI * 2,
        tiltSpeed: 0.1 + Math.random() * 0.1,
        shape: idx % 4 === 0 ? 'dot' : 'ribbon',
        alpha: 0.9,
      };
    });

    const durationMs = 2400;
    const startTime = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = elapsed / durationMs;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let activeCount = 0;
      for (const p of pieces) {
        p.vy += 0.085;
        p.vx = p.vx * 0.985 + Math.sin(p.tiltPhase) * 0.05;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vRot;
        p.tiltPhase += p.tiltSpeed;

        const fade = progress > 0.55 ? Math.max(0, 1 - (progress - 0.55) / 0.45) : 1;
        p.alpha = fade * 0.88;

        if (p.alpha > 0.02 && p.y < window.innerHeight + 30) {
          activeCount++;
          ctx.save();
          ctx.globalAlpha = p.alpha;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.fillStyle = p.color;

          if (p.shape === 'ribbon') {
            const scaleY = 0.45 + 0.55 * Math.abs(Math.cos(p.tiltPhase));
            ctx.scale(1, scaleY);
            ctx.beginPath();
            ctx.roundRect(-p.w / 2, -p.h / 2, p.w, p.h, 1.5);
            ctx.fill();
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.h * 0.55, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }

      if (elapsed < durationMs && activeCount > 0) {
        rafId = requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        onDone();
      }
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [celebration, onDone]);

  if (!celebration) return null;

  const isWater = celebration.kind === 'water';
  const copy = getCelebrationCopy(celebration.kind, isHi);

  return (
    <div className="fixed inset-0 z-50 pointer-events-none" aria-live="polite">
      <canvas ref={canvasRef} className="w-full h-full block" />

      <div className="fixed top-5 left-1/2 -translate-x-1/2 px-4 w-full max-w-sm pointer-events-auto">
        <div
          className={`rounded-2xl border shadow-xl px-4 py-3 flex items-center justify-between gap-3 backdrop-blur-md ${
            isWater
              ? 'bg-sky-600/95 border-sky-300 text-white'
              : 'bg-slate-900/95 dark:bg-emerald-900/95 border-amber-400/80 text-white'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              {isWater ? (
                <Droplets className="w-5 h-5 text-sky-200" />
              ) : celebration.kind === 'calorie' ? (
                <Flame className="w-5 h-5 text-amber-300" />
              ) : (
                <Sparkles className="w-5 h-5 text-amber-300" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 text-xs font-bold">
                <Award className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">{copy.title}</span>
              </div>
              <p className="text-[11px] text-white/90 truncate">{copy.subtitle}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onDone}
            aria-label="Dismiss celebration"
            className="min-h-[32px] min-w-[32px] rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center shrink-0 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
