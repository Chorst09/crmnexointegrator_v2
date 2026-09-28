import { z } from 'zod';

// Validação para CNPJ (formato básico)
const cnpjRegex = /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/;

// Validação para CPF (formato básico)
const cpfRegex = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

// Schema para Cliente
export const clienteSchema = z.object({
  nome_razao_social: z.string()
    .min(2, 'Nome/Razão Social deve ter pelo menos 2 caracteres')
    .max(255, 'Nome/Razão Social deve ter no máximo 255 caracteres'),
  
  cnpj_cpf: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true; // Campo opcional
      return cnpjRegex.test(val) || cpfRegex.test(val);
    }, 'CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX ou CPF no formato XXX.XXX.XXX-XX'),
  
  nome_contato: z.string()
    .min(2, 'Nome do contato deve ter pelo menos 2 caracteres')
    .max(255, 'Nome do contato deve ter no máximo 255 caracteres'),
  
  email_contato: z.string()
    .email('Email deve ter um formato válido')
    .max(255, 'Email deve ter no máximo 255 caracteres'),
  
  telefone: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length >= 10;
    }, 'Telefone deve ter pelo menos 10 dígitos'),
  
  endereco_completo: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length <= 500;
    }, 'Endereço deve ter no máximo 500 caracteres'),
  
  status: z.enum(['ativo', 'prospect', 'inativo'], {
    errorMap: () => ({ message: 'Status deve ser: ativo, prospect ou inativo' })
  })
});

// Schema para Fornecedor
export const fornecedorSchema = z.object({
  nome_razao_social: z.string()
    .min(2, 'Nome/Razão Social deve ter pelo menos 2 caracteres')
    .max(255, 'Nome/Razão Social deve ter no máximo 255 caracteres'),
  
  cnpj: z.string()
    .regex(cnpjRegex, 'CNPJ deve estar no formato XX.XXX.XXX/XXXX-XX'),
  
  contato_principal_nome: z.string()
    .min(2, 'Nome do contato deve ter pelo menos 2 caracteres')
    .max(255, 'Nome do contato deve ter no máximo 255 caracteres'),
  
  contato_principal_email: z.string()
    .email('Email deve ter um formato válido')
    .max(255, 'Email deve ter no máximo 255 caracteres'),
  
  contato_principal_telefone: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length >= 10;
    }, 'Telefone deve ter pelo menos 10 dígitos'),
  
  area_atuacao: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length <= 255;
    }, 'Área de atuação deve ter no máximo 255 caracteres'),
  
  observacoes: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length <= 1000;
    }, 'Observações devem ter no máximo 1000 caracteres'),
  
  status: z.enum(['ativo', 'inativo'], {
    errorMap: () => ({ message: 'Status deve ser: ativo ou inativo' })
  })
});

// Schema para Oportunidade
export const oportunidadeSchema = z.object({
  numero_oportunidade: z.string()
    .min(1, 'Número da oportunidade é obrigatório')
    .max(50, 'Número da oportunidade deve ter no máximo 50 caracteres'),
  
  setor: z.enum(['privado', 'governo'], {
    errorMap: () => ({ message: 'Setor deve ser: Privado ou Governo' })
  }),
  
  titulo: z.string()
    .min(2, 'Título deve ter pelo menos 2 caracteres')
    .max(255, 'Título deve ter no máximo 255 caracteres'),
  
  cliente_id: z.string()
    .uuid('Cliente deve ser selecionado'),
  
  valor_estimado: z.string()
    .refine((val) => {
      const num = parseFloat(val.replace(/[^\d,.-]/g, '').replace(',', '.'));
      return !isNaN(num) && num > 0;
    }, 'Valor estimado deve ser um número positivo'),
  
  fase: z.enum(['aguardando_aprovacao', 'aprovada', 'vencida', 'negada'], {
    errorMap: () => ({ message: 'Fase deve ser uma das opções válidas' })
  }),
  
  data_fechamento_prevista: z.string()
    .refine((val) => {
      const date = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    }, 'Data de fechamento deve ser hoje ou no futuro'),
  
  data_vencimento: z.string()
    .refine((val) => {
      const date = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return date >= today;
    }, 'Data de vencimento deve ser hoje ou no futuro'),
  
  responsavel_id: z.string()
    .uuid('Responsável deve ser selecionado'),
  
  probabilidade_fechamento: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const num = parseInt(val);
      return !isNaN(num) && num >= 0 && num <= 100;
    }, 'Probabilidade deve ser entre 0 e 100'),
  
  descricao: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length <= 1000;
    }, 'Descrição deve ter no máximo 1000 caracteres'),
  
  fornecedores: z.array(z.string().uuid())
    .optional()
    .default([])
});

// Tipos derivados dos schemas
export type ClienteFormData = z.infer<typeof clienteSchema>;
export type FornecedorFormData = z.infer<typeof fornecedorSchema>;
export type OportunidadeFormData = z.infer<typeof oportunidadeSchema>;