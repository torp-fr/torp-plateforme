/**
 * Centralized Logger for Development/Production
 * All console logs are controlled here
 * - DEV: Full debug logging enabled
 * - PROD: Only errors enabled
 */

export const isDev = import.meta.env.DEV;

/**
 * Development log - visible only in dev mode
 */
export const log = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};

/**
 * Warning log - visible only in dev mode
 */
export const warn = (...args: any[]) => {
  if (isDev) {
    console.warn(...args);
  }
};

/**
 * Error log - ALWAYS visible (critical errors must be logged)
 */
export const error = (...args: any[]) => {
  console.error(...args);
};

/**
 * Timing helper - dev only
 */
export const time = (label: string) => {
  if (isDev) {
    console.time(label);
  }
};

/**
 * Timing helper end - dev only
 */
export const timeEnd = (label: string) => {
  if (isDev) {
    console.timeEnd(label);
  }
};
