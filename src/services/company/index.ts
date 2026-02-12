/**
 * Company Services - Mock placeholders
 * These services were removed in the pragmatic cleanup
 */

export interface CompanyLookupResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface OptimizationType {
  level: string;
}

export interface MaterialRecognitionResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const SiretLookupService = {
  lookupBySiret: async (siret: string): Promise<CompanyLookupResult> => ({
    success: false,
    error: 'Service removed',
  }),
  formatSiret: (siret: string): string => siret,
};

export const TextOptimizerService = {
  optimizeText: async (text: string, field: string, options: any): Promise<string> => text,
};

export const MaterialRecognitionService = {
  validateFile: (file: File): boolean => true,
  captureFromCamera: async (): Promise<File | null> => null,
  recognizeFromFile: async (file: File, options: any): Promise<MaterialRecognitionResult> => ({
    success: false,
    error: 'Service removed',
  }),
  mapToMaterialForm: (result: any): any => ({}),
};
