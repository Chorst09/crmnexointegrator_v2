export interface ClientData {
  name: string;
  projectName?: string;
  email?: string;
  phone?: string;
  contact?: string; // Alterado para opcional
  companyName?: string;
}

export interface AccountManagerData {
  name: string;
  email?: string; // Alterado para opcional
  phone?: string;
}

// Adicionando tipos que estavam faltando
export interface BidDocs {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  [key: string]: any;
}

export interface DatabaseLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
}

export interface ErrorAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved?: boolean;
}

export interface Proposal {
  id: string; // Unique ID for each version, e.g., Prop_MV_0001/2025_v1
  baseId: string; // Base ID, e.g., Prop_MV_0001/2025
  version: number;
  title: string;
  client: ClientData | string; // Pode ser string ou objeto
  type: string; // Proposal type: RADIO, FIBER, VM, etc.
  value: number;
  status:
    | 'Rascunho'
    | 'Enviada'
    | 'Em Análise'
    | 'Aprovada'
    | 'Rejeitada'
    | 'Aguardando Aprovação'
    | 'Aguardando Aprovação Diretoria'
    | 'Aguardando aprovação desconto Diretoria'
    | 'Aguardando Aprovação do Cliente'
    | 'Fechado Ganho'
    | 'Perdido'
    | 'Renovação';
  createdBy?: string; // User ID
  accountManager: AccountManagerData | string; // User name or object
  createdAt: any; // Firestore Timestamp
  distributorId: string;
  date: string;
  expiryDate: string;
  // Optional fields for extended proposal data
  totalSetup?: number;
  totalMonthly?: number;
  contractPeriod?: number;
  selectedSpeed?: number; // Adicionado
  includeInstallation?: boolean; // Adicionado
  contractTerm?: number; // Adicionado
  clientData?: ClientData; // Alterado para opcional - usado pelos calculadores
  products?: any[];
  items?: any[]; // Adicionado
  userId?: string;
  updatedAt?: any;
  updatedBy?: string;
  applySalespersonDiscount?: boolean; // Adicionado
  appliedDirectorDiscountPercentage?: number; // Adicionado
  includeReferralPartner?: boolean; // Adicionado
  includeInfluencerPartner?: boolean; // Adicionado
  baseTotalMonthly?: number; // Adicionado
  changes?: string; // Adicionado
  isExistingClient?: boolean; // Adicionado - indica se é cliente da base
  previousMonthlyFee?: number; // Adicionado - valor que o cliente paga atualmente
  forecastTemperature?: number; // Temperatura do negócio (0,25,50,75,100)
  details?: { // Adicionado para acomodar details de diferentes calculadoras
    speed?: number;
    contractTerm?: number;
    includeInstallation?: boolean;
    planDescription?: string;
    doubleFiberRadioCost?: number;
    applySalespersonDiscount?: boolean;
    appliedDirectorDiscountPercentage?: number;
    includeReferralPartner?: boolean;
    [key: string]: any;
  };
  discountInfo?: {
    applySalespersonDiscount: boolean;
    appliedDirectorDiscountPercentage: number;
    salespersonDiscountFactor: number;
    directorDiscountFactor: number;
    hasDiscounts: boolean;
  };
}

export type UserRole = 'admin' | 'director' | 'user' | 'pending';

export interface UserProfile {
  id: string;
  email: string | null;
  name?: string;
  role: UserRole;
  token?: string; // Adicionado token
  distributorId?: string; // Adicionado distributorId
  passwordChanged?: boolean; // Adicionado para controlar primeiro acesso
}

export interface Partner {
  id: number;
  name: string;
  type: 'Cliente' | 'Distribuidor' | 'Fornecedor';
  // Adicionado o campo mainContact aqui
  mainContact?: string;
  contact: string;
  phone: string;
  status: 'Ativo' | 'Inativo';
  site?: string;
  products?: string;
  sitePartner?: string;
  siteRO?: string;
  templateRO?: string;
  procedimentoRO?: string;
  login?: string;
  password?: string;
}

// Removed Quote and Proposal interfaces as these features have been removed

export interface RO {
    id: number;
    partnerId: number | string; // Can be string from form
    supplierId?: number | string; // Adicionado campo supplierId
    roNumber: string;
    openDate: string;
    expiryDate: string;
    clientName: string;
    product: string;
    value: number;
}

export interface Training {
    id: number;
    partnerId: number | string; // Can be string from form
    supplierId?: number | string; // Adicionado campo supplierId
    trainingName: string;
    type: 'Comercial' | 'Técnico';
    participantName: string;
    expiryDate: string;
}

// Removed RFP, PriceRecord, PriceRecordItem, BidFile, and BidDocs interfaces as these features have been removed

// Interfaces para Edital
export interface EditalFile {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadDate: string;
  aiAnalysis?: EditalAIAnalysis;
}

export interface EditalAIAnalysis {
  keyPoints: string[];
  requirements: string[];
  deadlines: string[];
  values: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  confidence?: number;
  processingTime?: number;
  summary?: string;
}

export interface EditalDocument {
  id: string;
  name: string;
  type: string;
  status: 'Pronto' | 'Enviado' | 'Pendente' | 'Em Preparação';
  deadline?: string;
  description?: string;
  notes?: string;
}

export interface EditalProduct {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  totalEstimatedPrice: number;
  status: 'Disponível' | 'Indisponível';
  estimatedUnitPrice?: number;
  specifications?: string;
  brand?: string;
  model?: string;
  supplier?: string;
}

export interface EditalAnalysis {
  overallAssessment: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
    score?: number;
    recommendation?: string;
    finalNotes?: string;
  };
  documentAnalysis?: {
    totalDocuments: number;
    readyDocuments: number;
    pendingDocuments: number;
    notes: string;
  };
  productAnalysis?: {
    totalProducts: number;
    availableProducts: number;
    unavailableProducts: number;
    competitiveAdvantage: string;
    notes: string;
  };
  timelineAnalysis?: {
    timelineRisk: string;
    notes: string;
  };
  publishingBodyAnalysis?: {
    bodyType: string;
    paymentHistory: string;
    previousExperience: string;
    notes: string;
  };
}

export interface Edital {
  id: string;
  title: string;
  client: string;
  description: string;
  status: 'Aberto' | 'Em Análise' | 'Fechado' | 'Respondido';
  publishDate: string;
  deadline: string;
  createdAt: any;
  distributorId: string;
  documents: EditalDocument[];
  products: EditalProduct[];
  files: EditalFile[];
  attachments: any[];
  analysis: EditalAnalysis;
  // Campos adicionais para compatibilidade
  publicationNumber?: string;
  publishingBody?: string;
  openingDate?: string;
  submissionDeadline?: string;
  estimatedValue?: number;
  category?: string;
  requirements?: string;
  notes?: string;
}

export interface NavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    href?: string;
    subItems?: NavSubItem[];
}

export interface NavSubItem {
    id: string;
    label: string;
    icon: React.ReactNode;
}

// Tipos para o Analisador de Editais
export interface AnalysisType {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface AnalysisResult {
  id: string;
  fileName: string;
  analysisType: string;
  analysisDate: string;
  summary: string;
  keyPoints: string[];
  requirements: string[];
  deadlines: string[];
  values: string[];
  risks: string[];
  opportunities: string[];
  recommendations: string[];
  confidence: number;
  processingTime: number;
  products?: ProductItem[];
}

export interface ProductItem {
  item: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedValue: number;
  specifications: string[];
  category?: string;
  priority?: 'Crítico' | 'Importante' | 'Desejável';
  complianceLevel?: 'Total' | 'Parcial' | 'Não Atende';
  riskLevel?: 'Baixo' | 'Médio' | 'Alto';
  technicalJustification?: string;
  marketAnalysis?: string;
  alternativeOptions?: string[];
  suggestedModels?: SuggestedModel[];
}

export interface SuggestedModel {
  brand: string;
  model: string;
  partNumber?: string;
  estimatedPrice: number;
  availability: 'Disponível' | 'Sob Consulta' | 'Descontinuado';
  complianceScore: number;
  advantages: string[];
  disadvantages?: string[];
  distributors?: string[];
}

export interface DocumentRequirement {
  type: string;
  description: string;
  mandatory: boolean;
  deadline?: string;
  notes?: string;
}

// Enhanced Error Response Interfaces for Proposals API
export type ProposalApiErrorCode = 
  | 'INDEX_MISSING' 
  | 'PERMISSION_DENIED' 
  | 'QUOTA_EXCEEDED' 
  | 'VALIDATION_ERROR'
  | 'DATABASE_CONNECTION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'UNKNOWN_ERROR';

export interface ProposalApiErrorDetails {
  indexUrl?: string;
  requiredFields?: string[];
  fallbackAvailable?: boolean;
  validationErrors?: string[];
  retryAfter?: number;
  supportContact?: string;
  documentationUrl?: string;
  requiredIndexDefinition?: string;
}

export interface ProposalApiError {
  error: string;
  message: string;
  code: ProposalApiErrorCode;
  timestamp: string;
  requestId?: string;
  details?: ProposalApiErrorDetails;
}

export interface IndexErrorInfo {
  isIndexError: boolean;
  missingFields?: string[];
  collection?: string;
  indexUrl?: string;
  fallbackStrategy: 'UNORDERED_QUERY' | 'CLIENT_SORT' | 'SIMPLIFIED_QUERY' | 'NONE';
  requiredIndexDefinition?: string;
}

export interface QueryFallbackResult {
  snapshot: any;
  usedFallback: boolean;
  fallbackType?: string;
  performanceImpact?: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendedAction?: string;
}

// Commission data types for legacy PABX calculator
export interface CommissionData {
  vendedor: Array<{ meses: string; comissao: string }>;
  diretor: Array<{ meses: string; comissao: string }>;
  parceiro: Array<{ range: string; ate24: string; mais24: string }>;
}

// Tipos para Quote
export interface Quote {
  id: string;
  title: string;
  client: string;
  value: number;
  status: 'Rascunho' | 'Enviada' | 'Em Análise' | 'Aprovada' | 'Rejeitada' | 'Pendente' | 'Enviado' | 'Aprovado' | 'Rejeitado';
  createdAt: any;
  distributorId: string;
  accountManager: string;
  date: string;
  expiryDate: string;
  description?: string;
  partnerId?: number | string;
  projectName?: string;
  total?: number;
  quotationFile?: string;
  pricingFile?: string;
}

// Tipos para RFP
export interface RFP {
  id: string;
  title: string;
  client: string;
  description: string;
  status: 'Aberto' | 'Em Análise' | 'Fechado' | 'Respondido';
  deadline: string;
  createdAt: any;
  distributorId: string;
  attachments?: any[];
  type?: string;
  publishDate?: string;
  deadlineDate?: string;
  submissionDate?: string;
  value?: number;
  accountManager?: string;
  category?: string;
  requirements?: string;
  notes?: string;
}

// Tipos para PriceRecord
export interface PriceRecord {
  id: string;
  title: string;
  client: string;
  status: 'Ativo' | 'Inativo' | 'Vencido' | 'Cancelado' | 'Suspenso' | 'Renovado';
  createdAt: any;
  distributorId: string;
  items: PriceRecordItem[];
  participants: any[];
  attachments: any[];
  type?: string;
  publishDate?: string;
  validityDate?: string;
  renewalDate?: string;
  totalValue?: number;
  accountManager?: string;
  category?: string;
  description?: string;
  notes?: string;
}

export interface PriceRecordItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  unit?: string;
  supplier?: string;
}
