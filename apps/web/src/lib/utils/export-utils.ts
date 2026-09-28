/**
 * Utilitários para exportação de dados das calculadoras
 */

import { formatCurrency, formatDate, formatPercentage } from './formatters';

export interface ExportData {
  [key: string]: any;
}

export interface ExportOptions {
  filename?: string;
  format?: 'csv' | 'json' | 'txt';
  includeHeaders?: boolean;
  dateFormat?: 'iso' | 'br';
}

/**
 * Converte dados para CSV
 */
export const convertToCSV = (
  data: ExportData[],
  options: ExportOptions = {}
): string => {
  if (!data.length) return '';

  const { includeHeaders = true } = options;
  const headers = Object.keys(data[0]);

  let csv = '';

  if (includeHeaders) {
    csv += headers.join(',') + '\n';
  }

  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];

      // Handle different data types
      if (value === null || value === undefined) {
        return '';
      }

      if (typeof value === 'string' && value.includes(',')) {
        return `"${value}"`;
      }

      return value.toString();
    });

    csv += values.join(',') + '\n';
  });

  return csv;
};

/**
 * Converte dados para JSON formatado
 */
export const convertToJSON = (
  data: ExportData[],
  options: ExportOptions = {}
): string => {
  return JSON.stringify(data, null, 2);
};

/**
 * Converte dados para texto formatado
 */
export const convertToText = (
  data: ExportData[],
  options: ExportOptions = {}
): string => {
  if (!data.length) return '';

  let text = '';

  data.forEach((item, index) => {
    text += `=== Item ${index + 1} ===\n`;

    Object.entries(item).forEach(([key, value]) => {
      text += `${key}: ${value}\n`;
    });

    text += '\n';
  });

  return text;
};

/**
 * Faz download de arquivo
 */
export const downloadFile = (
  content: string,
  filename: string,
  mimeType: string = 'text/plain'
): void => {
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

/**
 * Exporta dados em formato específico
 */
export const exportData = (
  data: ExportData[],
  options: ExportOptions = {}
): void => {
  const {
    filename = 'export',
    format = 'csv',
    includeHeaders = true
  } = options;

  let content: string;
  let mimeType: string;
  let extension: string;

  switch (format) {
    case 'csv':
      content = convertToCSV(data, { includeHeaders });
      mimeType = 'text/csv';
      extension = 'csv';
      break;

    case 'json':
      content = convertToJSON(data);
      mimeType = 'application/json';
      extension = 'json';
      break;

    case 'txt':
      content = convertToText(data);
      mimeType = 'text/plain';
      extension = 'txt';
      break;

    default:
      throw new Error(`Formato não suportado: ${format}`);
  }

  const finalFilename = `${filename}.${extension}`;
  downloadFile(content, finalFilename, mimeType);
};

/**
 * Formata dados de proposta para exportação
 */
export const formatProposalForExport = (proposal: any): ExportData => {
  return {
    'ID': proposal.baseId || proposal.id,
    'Título': proposal.title,
    'Cliente': typeof proposal.client === 'string' ? proposal.client : proposal.client?.name,
    'Gerente de Contas': proposal.accountManager,
    'Tipo': proposal.type,
    'Status': proposal.status,
    'Valor Mensal': formatCurrency(proposal.value || 0),
    'Valor Setup': formatCurrency(proposal.totalSetup || 0),
    'Período Contratual': `${proposal.contractPeriod || 0} meses`,
    'Data de Criação': formatDate(proposal.date || proposal.createdAt),
    'Data de Expiração': formatDate(proposal.expiryDate),
    'Criado Por': proposal.createdBy || 'N/A',
    'Distribuidor': proposal.distributorId || 'N/A'
  };
};

/**
 * Formata dados de DRE para exportação
 */
export const formatDREForExport = (dre: any, period: number): ExportData => {
  return {
    'Período': `${period} meses`,
    'Receita Mensal': formatCurrency(dre.receitaMensal || 0),
    'Receita Instalação': formatCurrency(dre.receitaInstalacao || 0),
    'Receita Total': formatCurrency(dre.receitaTotalPrimeiromes || 0),
    'Custo Serviço': formatCurrency(dre.custoServico || 0),
    'Custo Banda': formatCurrency(dre.custoBanda || 0),
    'Last Mile': formatCurrency(dre.lastMile || 0),
    'Simples Nacional': formatCurrency(dre.simplesNacional || 0),
    'Comissões': formatCurrency(dre.totalComissoes || 0),
    'Despesas': formatCurrency(dre.custoDespesa || 0),
    'Lucro Líquido': formatCurrency(dre.balance || 0),
    'Margem Líquida': formatPercentage(dre.margemLiquida || 0),
    'Markup': formatPercentage(dre.markup || 0)
  };
};

/**
 * Exporta múltiplas propostas
 */
export const exportProposals = (
  proposals: any[],
  options: ExportOptions = {}
): void => {
  const formattedData = proposals.map(formatProposalForExport);

  exportData(formattedData, {
    filename: 'propostas',
    ...options
  });
};

/**
 * Exporta dados de DRE
 */
export const exportDRE = (
  dreData: Record<number, any>,
  options: ExportOptions = {}
): void => {
  const formattedData = Object.entries(dreData).map(([period, dre]) =>
    formatDREForExport(dre, parseInt(period))
  );

  exportData(formattedData, {
    filename: 'dre-analysis',
    ...options
  });
};

/**
 * Exporta configurações da calculadora
 */
export const exportCalculatorConfig = (
  config: any,
  calculatorType: string,
  options: ExportOptions = {}
): void => {
  const formattedData = [{
    'Tipo de Calculadora': calculatorType,
    'Data de Exportação': formatDate(new Date().toISOString()),
    'Configurações': JSON.stringify(config, null, 2)
  }];

  exportData(formattedData, {
    filename: `config-${calculatorType.toLowerCase()}`,
    format: 'json',
    ...options
  });
};

/**
 * Gera relatório completo da proposta
 */
export const generateProposalReport = (
  proposal: any,
  dreData?: Record<number, any>,
  options: ExportOptions = {}
): void => {
  const reportData = {
    proposta: formatProposalForExport(proposal),
    dre: dreData ? Object.entries(dreData).map(([period, dre]) =>
      formatDREForExport(dre, parseInt(period))
    ) : [],
    metadata: {
      geradoEm: formatDate(new Date().toISOString()),
      versao: '1.0'
    }
  };

  const content = JSON.stringify(reportData, null, 2);
  const filename = `relatorio-${proposal.baseId || proposal.id}.json`;

  downloadFile(content, filename, 'application/json');
};