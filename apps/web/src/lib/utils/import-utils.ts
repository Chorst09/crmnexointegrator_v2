/**
 * Utilitários para importação de dados nas calculadoras
 */

export interface ImportResult<T = any> {
  success: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
  totalProcessed: number;
  totalImported: number;
}

export interface ImportOptions {
  skipErrors?: boolean;
  validateData?: boolean;
  maxFileSize?: number; // em bytes
  allowedFormats?: string[];
}

/**
 * Lê arquivo como texto
 */
export const readFileAsText = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      resolve(event.target?.result as string);
    };
    
    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo'));
    };
    
    reader.readAsText(file);
  });
};

/**
 * Valida arquivo antes da importação
 */
export const validateFile = (
  file: File,
  options: ImportOptions = {}
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const {
    maxFileSize = 5 * 1024 * 1024, // 5MB default
    allowedFormats = ['csv', 'json', 'txt']
  } = options;

  // Verifica tamanho do arquivo
  if (file.size > maxFileSize) {
    errors.push(`Arquivo muito grande. Máximo permitido: ${maxFileSize / 1024 / 1024}MB`);
  }

  // Verifica formato do arquivo
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension && !allowedFormats.includes(extension)) {
    errors.push(`Formato não suportado. Formatos permitidos: ${allowedFormats.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Converte CSV para array de objetos
 */
export const parseCSV = (csvContent: string): any[] => {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
    
    if (values.length === headers.length) {
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index];
      });
      data.push(row);
    }
  }

  return data;
};

/**
 * Converte JSON para array de objetos
 */
export const parseJSON = (jsonContent: string): any[] => {
  try {
    const parsed = JSON.parse(jsonContent);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    throw new Error('JSON inválido');
  }
};

/**
 * Importa dados de arquivo
 */
export const importFromFile = async (
  file: File,
  options: ImportOptions = {}
): Promise<ImportResult> => {
  const result: ImportResult = {
    success: false,
    data: [],
    errors: [],
    warnings: [],
    totalProcessed: 0,
    totalImported: 0
  };

  try {
    // Valida arquivo
    const validation = validateFile(file, options);
    if (!validation.isValid) {
      result.errors = validation.errors;
      return result;
    }

    // Lê conteúdo do arquivo
    const content = await readFileAsText(file);
    const extension = file.name.split('.').pop()?.toLowerCase();

    let rawData: any[] = [];

    // Parse baseado no formato
    switch (extension) {
      case 'csv':
        rawData = parseCSV(content);
        break;
      case 'json':
        rawData = parseJSON(content);
        break;
      case 'txt':
        // Para arquivos de texto, cada linha é um item
        rawData = content.split('\n')
          .filter(line => line.trim())
          .map(line => ({ content: line.trim() }));
        break;
      default:
        result.errors.push('Formato de arquivo não suportado');
        return result;
    }

    result.totalProcessed = rawData.length;

    // Processa cada item
    for (const item of rawData) {
      try {
        // Validação básica se habilitada
        if (options.validateData && !validateImportedItem(item)) {
          result.warnings.push(`Item inválido ignorado: ${JSON.stringify(item)}`);
          continue;
        }

        result.data.push(item);
        result.totalImported++;
      } catch (error) {
        const errorMsg = `Erro ao processar item: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        
        if (options.skipErrors) {
          result.warnings.push(errorMsg);
        } else {
          result.errors.push(errorMsg);
          return result;
        }
      }
    }

    result.success = result.totalImported > 0;
    return result;

  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : 'Erro desconhecido');
    return result;
  }
};

/**
 * Valida item importado (implementação básica)
 */
const validateImportedItem = (item: any): boolean => {
  // Validação básica - pode ser customizada conforme necessário
  return item && typeof item === 'object';
};

/**
 * Importa configurações de calculadora
 */
export const importCalculatorConfig = async (
  file: File,
  expectedKeys: string[] = []
): Promise<ImportResult> => {
  const result = await importFromFile(file, {
    allowedFormats: ['json'],
    validateData: true
  });

  if (!result.success) return result;

  // Validação específica para configurações
  if (result.data.length > 0) {
    const config = result.data[0];
    
    // Verifica se contém as chaves esperadas
    if (expectedKeys.length > 0) {
      const missingKeys = expectedKeys.filter(key => !(key in config));
      if (missingKeys.length > 0) {
        result.warnings.push(`Chaves ausentes na configuração: ${missingKeys.join(', ')}`);
      }
    }
  }

  return result;
};

/**
 * Importa propostas
 */
export const importProposals = async (file: File): Promise<ImportResult> => {
  const result = await importFromFile(file, {
    allowedFormats: ['csv', 'json'],
    validateData: true,
    skipErrors: true
  });

  if (!result.success) return result;

  // Validação específica para propostas
  const validatedData: any[] = [];
  
  for (const proposal of result.data) {
    const validation = validateProposalData(proposal);
    
    if (validation.isValid) {
      validatedData.push(proposal);
    } else {
      result.warnings.push(`Proposta inválida: ${validation.errors.join(', ')}`);
    }
  }

  result.data = validatedData;
  result.totalImported = validatedData.length;
  result.success = validatedData.length > 0;

  return result;
};

/**
 * Valida dados de proposta
 */
const validateProposalData = (proposal: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!proposal.title) {
    errors.push('Título é obrigatório');
  }

  if (!proposal.client) {
    errors.push('Cliente é obrigatório');
  }

  if (!proposal.type) {
    errors.push('Tipo é obrigatório');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Converte dados importados para formato da aplicação
 */
export const transformImportedData = (
  data: any[],
  fieldMapping: Record<string, string>
): any[] => {
  return data.map(item => {
    const transformed: any = {};
    
    Object.entries(fieldMapping).forEach(([importField, appField]) => {
      if (item[importField] !== undefined) {
        transformed[appField] = item[importField];
      }
    });
    
    return transformed;
  });
};

/**
 * Gera template de importação
 */
export const generateImportTemplate = (
  fields: { name: string; example: string; required: boolean }[],
  format: 'csv' | 'json' = 'csv'
): string => {
  if (format === 'csv') {
    const headers = fields.map(f => f.name).join(',');
    const examples = fields.map(f => f.example).join(',');
    return `${headers}\n${examples}`;
  } else {
    const template: any = {};
    fields.forEach(field => {
      template[field.name] = field.example;
    });
    return JSON.stringify([template], null, 2);
  }
};

/**
 * Download template de importação
 */
export const downloadImportTemplate = (
  templateName: string,
  fields: { name: string; example: string; required: boolean }[],
  format: 'csv' | 'json' = 'csv'
): void => {
  const content = generateImportTemplate(fields, format);
  const filename = `template-${templateName}.${format}`;
  const mimeType = format === 'csv' ? 'text/csv' : 'application/json';
  
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};