/**
 * Validation Service
 * Service de validation des données formulaires
 * Inclut validation SIRET, dates, emails, téléphones, etc.
 */

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  sanitized?: string;
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  sanitized: Record<string, unknown>;
}

/**
 * Valide un numéro SIRET (14 chiffres avec algorithme de Luhn)
 */
export function validateSIRET(siret: string): ValidationResult {
  // Nettoyer le SIRET (enlever espaces et tirets)
  const cleaned = siret.replace(/[\s-]/g, '');

  // Vérifier la longueur
  if (cleaned.length !== 14) {
    return {
      isValid: false,
      error: 'Le SIRET doit contenir 14 chiffres',
      sanitized: cleaned,
    };
  }

  // Vérifier que ce sont des chiffres
  if (!/^\d{14}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Le SIRET ne doit contenir que des chiffres',
      sanitized: cleaned,
    };
  }

  // Algorithme de Luhn pour validation SIRET
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  if (sum % 10 !== 0) {
    // Exception pour La Poste (SIRET commence par 356000000)
    if (!cleaned.startsWith('356000000')) {
      return {
        isValid: false,
        error: 'Le numéro SIRET est invalide (clé de contrôle incorrecte)',
        sanitized: cleaned,
      };
    }
  }

  return {
    isValid: true,
    sanitized: cleaned,
  };
}

/**
 * Valide un numéro SIREN (9 premiers chiffres du SIRET)
 */
export function validateSIREN(siren: string): ValidationResult {
  const cleaned = siren.replace(/[\s-]/g, '');

  if (cleaned.length !== 9) {
    return {
      isValid: false,
      error: 'Le SIREN doit contenir 9 chiffres',
      sanitized: cleaned,
    };
  }

  if (!/^\d{9}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Le SIREN ne doit contenir que des chiffres',
      sanitized: cleaned,
    };
  }

  // Algorithme de Luhn pour SIREN
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(cleaned[i], 10);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }

  if (sum % 10 !== 0) {
    return {
      isValid: false,
      error: 'Le numéro SIREN est invalide',
      sanitized: cleaned,
    };
  }

  return {
    isValid: true,
    sanitized: cleaned,
  };
}

/**
 * Valide un email
 */
export function validateEmail(email: string): ValidationResult {
  const cleaned = email.trim().toLowerCase();

  if (!cleaned) {
    return {
      isValid: false,
      error: 'L\'email est requis',
      sanitized: cleaned,
    };
  }

  // Regex RFC 5322 simplifiée
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(cleaned)) {
    return {
      isValid: false,
      error: 'L\'email n\'est pas valide',
      sanitized: cleaned,
    };
  }

  return {
    isValid: true,
    sanitized: cleaned,
  };
}

/**
 * Valide un numéro de téléphone français
 */
export function validatePhoneFR(phone: string): ValidationResult {
  // Nettoyer le numéro
  let cleaned = phone.replace(/[\s.-]/g, '');

  // Gérer le préfixe international
  if (cleaned.startsWith('+33')) {
    cleaned = '0' + cleaned.substring(3);
  } else if (cleaned.startsWith('0033')) {
    cleaned = '0' + cleaned.substring(4);
  }

  if (!cleaned) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone est requis',
      sanitized: cleaned,
    };
  }

  // Vérifier le format français
  if (!/^0[1-9]\d{8}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Le numéro de téléphone n\'est pas valide (format: 0X XX XX XX XX)',
      sanitized: cleaned,
    };
  }

  // Formater pour l'affichage
  const formatted = cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');

  return {
    isValid: true,
    sanitized: formatted,
  };
}

/**
 * Valide un code postal français
 */
export function validateCodePostalFR(cp: string): ValidationResult {
  const cleaned = cp.replace(/\s/g, '');

  if (!/^\d{5}$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Le code postal doit contenir 5 chiffres',
      sanitized: cleaned,
    };
  }

  // Vérifier que le département existe (01-95, 2A, 2B, 97x, 98x)
  const dept = cleaned.substring(0, 2);
  const deptNum = parseInt(dept, 10);

  const validDepts = [
    ...Array.from({ length: 95 }, (_, i) => String(i + 1).padStart(2, '0')),
    '2A', '2B', // Corse
    '97', '98', // DOM-TOM
  ];

  if (!validDepts.includes(dept) && deptNum !== 20) {
    return {
      isValid: false,
      error: 'Le code postal ne correspond pas à un département français valide',
      sanitized: cleaned,
    };
  }

  return {
    isValid: true,
    sanitized: cleaned,
  };
}

/**
 * Valide une date (format ISO ou DD/MM/YYYY)
 */
export function validateDate(date: string, options?: {
  minDate?: Date;
  maxDate?: Date;
  allowFuture?: boolean;
  allowPast?: boolean;
}): ValidationResult {
  let parsed: Date;

  // Essayer différents formats
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Format ISO
    parsed = new Date(date);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(date)) {
    // Format FR
    const [day, month, year] = date.split('/');
    parsed = new Date(`${year}-${month}-${day}`);
  } else {
    return {
      isValid: false,
      error: 'Format de date invalide (attendu: JJ/MM/AAAA ou AAAA-MM-JJ)',
      sanitized: date,
    };
  }

  // Vérifier que la date est valide
  if (isNaN(parsed.getTime())) {
    return {
      isValid: false,
      error: 'Date invalide',
      sanitized: date,
    };
  }

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Vérifier les contraintes
  if (options?.allowFuture === false && parsed > now) {
    return {
      isValid: false,
      error: 'La date ne peut pas être dans le futur',
      sanitized: parsed.toISOString().split('T')[0],
    };
  }

  if (options?.allowPast === false && parsed < now) {
    return {
      isValid: false,
      error: 'La date ne peut pas être dans le passé',
      sanitized: parsed.toISOString().split('T')[0],
    };
  }

  if (options?.minDate && parsed < options.minDate) {
    return {
      isValid: false,
      error: `La date doit être après le ${options.minDate.toLocaleDateString('fr-FR')}`,
      sanitized: parsed.toISOString().split('T')[0],
    };
  }

  if (options?.maxDate && parsed > options.maxDate) {
    return {
      isValid: false,
      error: `La date doit être avant le ${options.maxDate.toLocaleDateString('fr-FR')}`,
      sanitized: parsed.toISOString().split('T')[0],
    };
  }

  return {
    isValid: true,
    sanitized: parsed.toISOString().split('T')[0],
  };
}

/**
 * Valide une date d'expiration (certification, document)
 * Retourne un avertissement si proche de l'expiration
 */
export function validateExpirationDate(date: string): ValidationResult & { warning?: string } {
  const result = validateDate(date, { allowPast: false });

  if (!result.isValid) {
    return result;
  }

  const expirationDate = new Date(result.sanitized!);
  const now = new Date();
  const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let warning: string | undefined;

  if (daysUntilExpiration <= 30) {
    warning = `Ce document expire dans ${daysUntilExpiration} jours`;
  } else if (daysUntilExpiration <= 90) {
    warning = `Ce document expire dans ${Math.ceil(daysUntilExpiration / 30)} mois`;
  }

  return {
    isValid: true,
    sanitized: result.sanitized,
    warning,
  };
}

/**
 * Valide un montant (prix, budget)
 */
export function validateMontant(value: string | number, options?: {
  min?: number;
  max?: number;
  allowNegative?: boolean;
}): ValidationResult {
  let numValue: number;

  if (typeof value === 'string') {
    // Nettoyer et convertir
    const cleaned = value.replace(/[\s€]/g, '').replace(',', '.');
    numValue = parseFloat(cleaned);
  } else {
    numValue = value;
  }

  if (isNaN(numValue)) {
    return {
      isValid: false,
      error: 'Veuillez entrer un montant valide',
      sanitized: '0',
    };
  }

  if (!options?.allowNegative && numValue < 0) {
    return {
      isValid: false,
      error: 'Le montant ne peut pas être négatif',
      sanitized: String(Math.abs(numValue)),
    };
  }

  if (options?.min !== undefined && numValue < options.min) {
    return {
      isValid: false,
      error: `Le montant minimum est de ${options.min.toLocaleString('fr-FR')} €`,
      sanitized: String(numValue),
    };
  }

  if (options?.max !== undefined && numValue > options.max) {
    return {
      isValid: false,
      error: `Le montant maximum est de ${options.max.toLocaleString('fr-FR')} €`,
      sanitized: String(numValue),
    };
  }

  return {
    isValid: true,
    sanitized: String(numValue),
  };
}

/**
 * Valide un champ requis
 */
export function validateRequired(value: unknown, fieldName: string): ValidationResult {
  if (value === undefined || value === null || value === '') {
    return {
      isValid: false,
      error: `${fieldName} est requis`,
      sanitized: String(value || ''),
    };
  }

  if (typeof value === 'string' && value.trim() === '') {
    return {
      isValid: false,
      error: `${fieldName} est requis`,
      sanitized: value.trim(),
    };
  }

  return {
    isValid: true,
    sanitized: typeof value === 'string' ? value.trim() : String(value),
  };
}

/**
 * Valide un code APE/NAF
 */
export function validateCodeAPE(code: string): ValidationResult {
  const cleaned = code.replace(/[\s.]/g, '').toUpperCase();

  // Format: 4 chiffres + 1 lettre (ex: 4399A)
  if (!/^\d{4}[A-Z]$/.test(cleaned)) {
    return {
      isValid: false,
      error: 'Le code APE doit être au format XXXXL (4 chiffres + 1 lettre)',
      sanitized: cleaned,
    };
  }

  return {
    isValid: true,
    sanitized: cleaned,
  };
}

/**
 * Valide un numéro RCS
 */
export function validateRCS(rcs: string): ValidationResult {
  // Format attendu: RCS VILLE B XXX XXX XXX ou juste B XXX XXX XXX
  const cleaned = rcs.toUpperCase().replace(/[\s]/g, '');

  // Pattern simplifié - accepte différents formats
  if (cleaned.length < 9) {
    return {
      isValid: false,
      error: 'Le numéro RCS semble incomplet',
      sanitized: rcs,
    };
  }

  return {
    isValid: true,
    sanitized: rcs.toUpperCase(),
  };
}

/**
 * Valide un formulaire complet avec plusieurs champs
 */
export function validateForm(
  data: Record<string, unknown>,
  rules: Record<string, {
    required?: boolean;
    type?: 'email' | 'phone' | 'siret' | 'siren' | 'date' | 'montant' | 'codePostal' | 'ape' | 'rcs';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    custom?: (value: unknown) => ValidationResult;
  }>
): FormValidationResult {
  const errors: Record<string, string> = {};
  const sanitized: Record<string, unknown> = {};

  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = data[field];

    // Vérifier si requis
    if (fieldRules.required) {
      const requiredResult = validateRequired(value, field);
      if (!requiredResult.isValid) {
        errors[field] = requiredResult.error!;
        continue;
      }
    }

    // Si la valeur est vide et non requise, passer
    if (value === undefined || value === null || value === '') {
      sanitized[field] = value;
      continue;
    }

    // Valider selon le type
    let result: ValidationResult;

    switch (fieldRules.type) {
      case 'email':
        result = validateEmail(String(value));
        break;
      case 'phone':
        result = validatePhoneFR(String(value));
        break;
      case 'siret':
        result = validateSIRET(String(value));
        break;
      case 'siren':
        result = validateSIREN(String(value));
        break;
      case 'date':
        result = validateDate(String(value));
        break;
      case 'montant':
        result = validateMontant(value as string | number, { min: fieldRules.min, max: fieldRules.max });
        break;
      case 'codePostal':
        result = validateCodePostalFR(String(value));
        break;
      case 'ape':
        result = validateCodeAPE(String(value));
        break;
      case 'rcs':
        result = validateRCS(String(value));
        break;
      default:
        result = { isValid: true, sanitized: String(value) };
    }

    if (!result.isValid) {
      errors[field] = result.error!;
    }

    // Vérifier longueur min/max pour les strings
    if (typeof value === 'string') {
      if (fieldRules.minLength && value.length < fieldRules.minLength) {
        errors[field] = `${field} doit contenir au moins ${fieldRules.minLength} caractères`;
      }
      if (fieldRules.maxLength && value.length > fieldRules.maxLength) {
        errors[field] = `${field} doit contenir au maximum ${fieldRules.maxLength} caractères`;
      }
    }

    // Validation custom
    if (fieldRules.custom) {
      const customResult = fieldRules.custom(value);
      if (!customResult.isValid) {
        errors[field] = customResult.error!;
      }
    }

    sanitized[field] = result.sanitized || value;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    sanitized,
  };
}

// Export du service complet
export const validationService = {
  validateSIRET,
  validateSIREN,
  validateEmail,
  validatePhoneFR,
  validateCodePostalFR,
  validateDate,
  validateExpirationDate,
  validateMontant,
  validateRequired,
  validateCodeAPE,
  validateRCS,
  validateForm,
};

export default validationService;
