/**
 * Score Badge Component
 * Affiche le grade TORP avec la couleur appropriée
 */

import { Badge } from '@/components/ui/badge';

interface ScoreBadgeProps {
  grade: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const GRADE_CONFIG: Record<string, { color: string; label: string }> = {
  'A+': { color: 'bg-emerald-600 text-white hover:bg-emerald-700', label: 'Excellent' },
  'A': { color: 'bg-green-600 text-white hover:bg-green-700', label: 'Très bien' },
  'A-': { color: 'bg-green-500 text-white hover:bg-green-600', label: 'Bien' },
  'B+': { color: 'bg-blue-500 text-white hover:bg-blue-600', label: 'Satisfaisant' },
  'B': { color: 'bg-blue-400 text-white hover:bg-blue-500', label: 'Correct' },
  'B-': { color: 'bg-blue-300 text-white hover:bg-blue-400', label: 'Moyen' },
  'C+': { color: 'bg-yellow-500 text-white hover:bg-yellow-600', label: 'Passable' },
  'C': { color: 'bg-yellow-400 text-black hover:bg-yellow-500', label: 'Insuffisant' },
  'C-': { color: 'bg-yellow-300 text-black hover:bg-yellow-400', label: 'Faible' },
  'D': { color: 'bg-orange-500 text-white hover:bg-orange-600', label: 'Médiocre' },
  'F': { color: 'bg-red-600 text-white hover:bg-red-700', label: 'Très faible' },
};

export const ScoreBadge = ({ grade, size = 'md', showLabel = false }: ScoreBadgeProps) => {
  const config = GRADE_CONFIG[grade] || { color: 'bg-gray-500 text-white', label: 'Inconnu' };

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5 font-semibold',
  };

  return (
    <Badge className={`${config.color} ${sizeClasses[size]}`}>
      {grade}
      {showLabel && ` - ${config.label}`}
    </Badge>
  );
};
