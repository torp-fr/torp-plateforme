/**
 * SCurveChart - Graphique en courbe S pour le suivi d'avancement Phase 3
 */

import React, { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SCurveDataPoint {
  date: string;
  label: string;
  prevu: number;
  reel: number;
  projete?: number;
}

interface SCurveChartProps {
  data: SCurveDataPoint[];
  title?: string;
  showProjection?: boolean;
  className?: string;
}

export function SCurveChart({
  data,
  title = "Courbe en S - Avancement du projet",
  showProjection = true,
  className,
}: SCurveChartProps) {
  // Calcul de l'écart actuel
  const currentStatus = useMemo(() => {
    const lastPoint = data[data.length - 1];
    if (!lastPoint) return null;

    const ecart = lastPoint.reel - lastPoint.prevu;
    let status: 'ahead' | 'on-track' | 'behind' | 'critical' = 'on-track';

    if (ecart > 5) status = 'ahead';
    else if (ecart < -10) status = 'critical';
    else if (ecart < -3) status = 'behind';

    return {
      ecart,
      status,
      prevu: lastPoint.prevu,
      reel: lastPoint.reel,
    };
  }, [data]);

  // Projection basée sur la tendance actuelle
  const projectedData = useMemo(() => {
    if (!showProjection || data.length < 3) return data;

    const lastPoints = data.slice(-3);
    const avgProgress =
      lastPoints.reduce((acc, p, i, arr) => {
        if (i === 0) return acc;
        return acc + (p.reel - arr[i - 1].reel);
      }, 0) / 2;

    const result = [...data];
    const lastPoint = data[data.length - 1];

    // Ajouter des points projetés jusqu'à 100%
    let currentValue = lastPoint.reel;
    let weekCount = 0;

    while (currentValue < 100 && weekCount < 20) {
      weekCount++;
      currentValue = Math.min(100, currentValue + avgProgress);

      const projectedDate = new Date(lastPoint.date);
      projectedDate.setDate(projectedDate.getDate() + weekCount * 7);

      result.push({
        date: projectedDate.toISOString().split('T')[0],
        label: `S+${weekCount}`,
        prevu: Math.min(100, lastPoint.prevu + weekCount * 5), // Progression linéaire du prévu
        reel: lastPoint.reel,
        projete: currentValue,
      });
    }

    return result;
  }, [data, showProjection]);

  const getStatusBadge = () => {
    if (!currentStatus) return null;

    const variants = {
      ahead: { color: 'bg-green-100 text-green-800', text: 'En avance' },
      'on-track': { color: 'bg-blue-100 text-blue-800', text: 'Conforme' },
      behind: { color: 'bg-yellow-100 text-yellow-800', text: 'En retard' },
      critical: { color: 'bg-red-100 text-red-800', text: 'Retard critique' },
    };

    const variant = variants[currentStatus.status];

    return (
      <Badge className={variant.color}>
        {variant.text} ({currentStatus.ecart > 0 ? '+' : ''}
        {currentStatus.ecart.toFixed(1)}%)
      </Badge>
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    return (
      <div className="rounded-lg border bg-background p-3 shadow-lg">
        <p className="font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span>{entry.name}:</span>
            <span className="font-medium">{entry.value.toFixed(1)}%</span>
          </div>
        ))}
        {payload.length >= 2 && (
          <div className="mt-1 border-t pt-1 text-sm">
            <span>Écart: </span>
            <span
              className={cn(
                'font-medium',
                payload[1].value - payload[0].value >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {payload[1].value - payload[0].value > 0 ? '+' : ''}
              {(payload[1].value - payload[0].value).toFixed(1)}%
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        {getStatusBadge()}
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={projectedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" className="text-xs" tick={{ fill: 'currentColor' }} />
              <YAxis
                domain={[0, 100]}
                tickFormatter={(value) => `${value}%`}
                className="text-xs"
                tick={{ fill: 'currentColor' }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Zone entre prévu et réel */}
              <defs>
                <linearGradient id="colorGap" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Ligne de référence à 100% */}
              <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="5 5" label="Fin" />

              {/* Courbe prévue */}
              <Line
                type="monotone"
                dataKey="prevu"
                name="Prévu"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ fill: '#6366f1', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />

              {/* Courbe réelle */}
              <Line
                type="monotone"
                dataKey="reel"
                name="Réel"
                stroke="#22c55e"
                strokeWidth={2}
                dot={{ fill: '#22c55e', strokeWidth: 2 }}
                activeDot={{ r: 6 }}
              />

              {/* Courbe projetée */}
              {showProjection && (
                <Line
                  type="monotone"
                  dataKey="projete"
                  name="Projeté"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Légende détaillée */}
        <div className="mt-4 grid grid-cols-3 gap-4 text-center text-sm">
          <div>
            <p className="text-muted-foreground">Avancement prévu</p>
            <p className="text-xl font-bold text-indigo-600">
              {currentStatus?.prevu.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Avancement réel</p>
            <p className="text-xl font-bold text-green-600">
              {currentStatus?.reel.toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Écart</p>
            <p
              className={cn(
                'text-xl font-bold',
                currentStatus && currentStatus.ecart >= 0 ? 'text-green-600' : 'text-red-600'
              )}
            >
              {currentStatus && currentStatus.ecart > 0 ? '+' : ''}
              {currentStatus?.ecart.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export d'un hook helper pour générer les données
export function useSCurveData(progressHistory: Array<{ date: string; prevu: number; reel: number }>) {
  return useMemo(() => {
    return progressHistory.map((point, index) => ({
      ...point,
      label: `S${index + 1}`,
    }));
  }, [progressHistory]);
}
