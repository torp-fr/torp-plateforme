/**
 * DataField Component
 * Affichage uniforme des données avec fallback "Non renseigné"
 * Règle absolue : aucune donnée mockée - afficher "Non renseigné" ou masquer si donnée absente
 */

import React from 'react';
import { cn } from '@/lib/utils';

export interface DataFieldProps {
  /** Label du champ */
  label: string;
  /** Valeur à afficher */
  value: string | number | null | undefined;
  /** Texte affiché si la valeur est absente (défaut: "Non renseigné") */
  fallback?: string;
  /** Si true, masque complètement le champ quand la valeur est absente */
  hideIfEmpty?: boolean;
  /** Classes CSS additionnelles pour le conteneur */
  className?: string;
  /** Classes CSS additionnelles pour le label */
  labelClassName?: string;
  /** Classes CSS additionnelles pour la valeur */
  valueClassName?: string;
  /** Variante de style */
  variant?: 'default' | 'inline' | 'stacked' | 'card';
  /** Icône à afficher avant le label */
  icon?: React.ReactNode;
  /** Formateur pour la valeur */
  formatter?: (value: string | number) => string;
  /** Afficher en gras la valeur */
  boldValue?: boolean;
  /** Taille du texte */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Vérifie si une valeur est considérée comme "vide"
 */
const isEmpty = (value: string | number | null | undefined): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  if (typeof value === 'number' && isNaN(value)) return true;
  return false;
};

/**
 * Composant DataField pour affichage uniforme des données
 */
export const DataField: React.FC<DataFieldProps> = ({
  label,
  value,
  fallback = 'Non renseigné',
  hideIfEmpty = false,
  className,
  labelClassName,
  valueClassName,
  variant = 'default',
  icon,
  formatter,
  boldValue = false,
  size = 'md',
}) => {
  const isValueEmpty = isEmpty(value);

  // Si hideIfEmpty est true et que la valeur est vide, ne rien afficher
  if (hideIfEmpty && isValueEmpty) {
    return null;
  }

  // Formater la valeur si un formateur est fourni
  const displayValue = isValueEmpty
    ? fallback
    : formatter && !isValueEmpty
      ? formatter(value as string | number)
      : String(value);

  // Classes de taille
  const sizeClasses = {
    sm: { label: 'text-xs', value: 'text-sm' },
    md: { label: 'text-sm', value: 'text-base' },
    lg: { label: 'text-base', value: 'text-lg' },
  };

  // Classes de variante pour le conteneur
  const variantClasses = {
    default: 'flex flex-col gap-1',
    inline: 'flex flex-row items-center gap-2',
    stacked: 'flex flex-col gap-0.5',
    card: 'flex flex-col gap-1 p-3 bg-gray-50 rounded-lg border border-gray-100',
  };

  return (
    <div className={cn(variantClasses[variant], className)}>
      <span
        className={cn(
          'text-muted-foreground',
          sizeClasses[size].label,
          icon && 'flex items-center gap-1.5',
          labelClassName
        )}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {label}
      </span>
      <span
        className={cn(
          sizeClasses[size].value,
          boldValue && 'font-semibold',
          isValueEmpty && 'text-muted-foreground italic',
          !isValueEmpty && 'text-foreground',
          valueClassName
        )}
      >
        {displayValue}
      </span>
    </div>
  );
};

/**
 * DataFieldGroup - Pour grouper plusieurs DataField
 */
export interface DataFieldGroupProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}

export const DataFieldGroup: React.FC<DataFieldGroupProps> = ({
  children,
  title,
  className,
  columns = 2,
}) => {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
      )}
      <div className={cn('grid gap-4', gridClasses[columns])}>
        {children}
      </div>
    </div>
  );
};

/**
 * Formateurs utilitaires
 */
export const formatters = {
  /** Formater un montant en euros */
  currency: (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  },

  /** Formater une date */
  date: (value: string | number): string => {
    if (typeof value === 'number') return String(value);
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  },

  /** Formater une date courte */
  shortDate: (value: string | number): string => {
    if (typeof value === 'number') return String(value);
    const date = new Date(value);
    if (isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString('fr-FR');
  },

  /** Formater un pourcentage */
  percentage: (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return String(value);
    return `${num.toFixed(1)}%`;
  },

  /** Formater un numéro SIRET/SIREN */
  siret: (value: string | number): string => {
    const str = String(value).replace(/\s/g, '');
    if (str.length === 14) {
      return `${str.slice(0, 3)} ${str.slice(3, 6)} ${str.slice(6, 9)} ${str.slice(9)}`;
    }
    if (str.length === 9) {
      return `${str.slice(0, 3)} ${str.slice(3, 6)} ${str.slice(6)}`;
    }
    return str;
  },

  /** Formater un numéro de téléphone */
  phone: (value: string | number): string => {
    const str = String(value).replace(/\s/g, '');
    if (str.length === 10) {
      return str.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
    }
    return str;
  },
};

export default DataField;
