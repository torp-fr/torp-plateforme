import { cn } from '@/lib/utils';

interface ScoreGaugeProps {
  score: number;
  maxScore?: number;
  size?: 'sm' | 'md' | 'lg';
  grade?: string;
  showLabel?: boolean;
}

const getScoreColor = (pct: number) => {
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 65) return 'text-blue-600';
  if (pct >= 50) return 'text-yellow-600';
  if (pct >= 35) return 'text-orange-600';
  return 'text-red-600';
};

const getStrokeColor = (pct: number) => {
  if (pct >= 80) return 'stroke-emerald-600';
  if (pct >= 65) return 'stroke-blue-600';
  if (pct >= 50) return 'stroke-yellow-600';
  if (pct >= 35) return 'stroke-orange-600';
  return 'stroke-red-600';
};

const sizes = { sm: 80, md: 120, lg: 180 };

export function ScoreGauge({
  score,
  maxScore = 100,
  size = 'md',
  grade,
  showLabel = true,
}: ScoreGaugeProps) {
  const pct = (score / maxScore) * 100;
  const dim = sizes[size];
  const r = dim / 2 - 10;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const strokeW = size === 'sm' ? 4 : size === 'md' ? 6 : 8;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: dim, height: dim }}>
        <svg width={dim} height={dim} className="-rotate-90">
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeW}
            className="text-slate-200"
          />
          <circle
            cx={dim / 2}
            cy={dim / 2}
            r={r}
            fill="none"
            className={cn('transition-all duration-1000', getStrokeColor(pct))}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={cn(
              'font-bold',
              getScoreColor(pct),
              size === 'lg'
                ? 'text-3xl'
                : size === 'md'
                  ? 'text-xl'
                  : 'text-sm'
            )}
          >
            {score}
          </span>
          {grade && (
            <span
              className={cn(
                'font-semibold',
                getScoreColor(pct),
                size === 'lg' ? 'text-lg' : 'text-xs'
              )}
            >
              {grade}
            </span>
          )}
        </div>
      </div>
      {showLabel && (
        <span className="text-xs text-slate-500">/ {maxScore}</span>
      )}
    </div>
  );
}
