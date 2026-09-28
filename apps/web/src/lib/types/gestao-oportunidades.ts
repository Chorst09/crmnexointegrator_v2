// Tipos para o Sistema de Gestão de Oportunidades

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: 'vendedor' | 'gerente' | 'diretor';
  team_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Cliente {
  id?: string;
  nome_razao_social: string;
  cnpj_cpf?: string;
  nome_contato: string;
  email_contato: string;
  telefone?: string;
  endereco_completo?: string;
  status: 'ativo' | 'prospect' | 'inativo';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Fornecedor {
  id?: string;
  nome_razao_social: string;
  cnpj: string;
  contato_principal_nome: string;
  contato_principal_email: string;
  contato_principal_telefone?: string;
  area_atuacao?: string;
  observacoes?: string;
  status: 'ativo' | 'inativo';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Oportunidade {
  id?: string;
  numero_oportunidade: string;
  setor: 'privado' | 'governo';
  titulo: string;
  cliente_id: string;
  cliente?: Cliente;
  fornecedores?: Fornecedor[];
  valor_estimado: number;
  fase: 'aguardando_aprovacao' | 'aprovada' | 'vencida' | 'negada';
  data_fechamento_prevista: string;
  data_vencimento: string;
  responsavel_id: string;
  responsavel?: Profile;
  probabilidade_fechamento?: number;
  descricao?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Atividade {
  id?: string;
  oportunidade_id: string;
  tipo: 'nota' | 'ligacao' | 'email' | 'reuniao' | 'proposta' | 'mudanca_fase' | 'sistema';
  titulo: string;
  descricao?: string;
  usuario_id: string;
  usuario?: Profile;
  created_at?: string;
}

// Tipos para formulários
export interface ClienteFormData {
  nome_razao_social: string;
  cnpj_cpf: string;
  nome_contato: string;
  email_contato: string;
  telefone: string;
  endereco_completo: string;
  status: 'ativo' | 'prospect' | 'inativo';
}

export interface FornecedorFormData {
  nome_razao_social: string;
  cnpj: string;
  contato_principal_nome: string;
  contato_principal_email: string;
  contato_principal_telefone: string;
  area_atuacao: string;
  observacoes: string;
  status: 'ativo' | 'inativo';
}

export interface OportunidadeFormData {
  numero_oportunidade: string;
  setor: 'privado' | 'governo';
  titulo: string;
  cliente_id: string;
  valor_estimado: string;
  fase: 'aguardando_aprovacao' | 'aprovada' | 'vencida' | 'negada';
  data_fechamento_prevista: string;
  data_vencimento: string;
  responsavel_id: string;
  probabilidade_fechamento: string;
  descricao: string;
  fornecedores: string[];
}