-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('B2B', 'B2G');

-- CreateEnum
CREATE TYPE "ProjectPhaseType" AS ENUM ('SETUP', 'KICKOFF_INTERNO', 'KICKOFF_EXTERNO', 'EXECUCAO', 'MONITORAMENTO', 'ENCERRAMENTO');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PLANEJADO', 'EM_ANDAMENTO', 'PAUSADO', 'CONCLUIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "ProjectPhaseStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "MilestoneStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'AT_RISK');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ProjectRole" AS ENUM ('PROJECT_MANAGER', 'TECH_LEAD', 'DEVELOPER', 'ANALYST', 'QA', 'ARCHITECT', 'CONSULTANT');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RiskStatus" AS ENUM ('IDENTIFIED', 'MITIGATING', 'RESOLVED', 'ACCEPTED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('CONTRACT', 'DELIVERABLE', 'MINUTES', 'CHANGE_REQUEST', 'ACCEPTANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "ChangeRequestType" AS ENUM ('SCOPE', 'SCHEDULE', 'BUDGET', 'QUALITY', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ChangeRequestStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('PENDING', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcceptanceType" AS ENUM ('PROVISIONAL', 'FINAL');

-- CreateEnum
CREATE TYPE "AcceptanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONDITIONALLY_APPROVED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MASTER', 'ADMIN', 'MANAGER', 'DIRECTOR', 'SELLER', 'USER', 'PRE_SALES', 'USER_B2B');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('LEAD', 'QUALIFICATION', 'DIAGNOSIS', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE', 'WHATSAPP', 'PHONE', 'EMAIL', 'REFERRAL', 'CAMPAIGN', 'MANUAL');

-- CreateEnum
CREATE TYPE "CompanySize" AS ENUM ('MICRO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "CompanyStatus" AS ENUM ('LEAD', 'PROSPECT', 'ACTIVE', 'INACTIVE', 'CHURNED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CALL', 'MEETING', 'EMAIL', 'TASK', 'FOLLOW_UP', 'SOLICITACAO_ORCAMENTO');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProposalType" AS ENUM ('COMMERCIAL', 'TECHNICAL');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "IntegrationType" AS ENUM ('ERP', 'WHATSAPP', 'EMAIL_MARKETING', 'VOIP', 'API_EXTERNAL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('TOTVS', 'SAP', 'SENIOR', 'GENERIC_ERP', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PartnerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "IntegrationModule" AS ENUM ('B2B', 'B2G', 'PRE_SALES');

-- CreateEnum
CREATE TYPE "IntegrationEntityType" AS ENUM ('CUSTOMER', 'PRICE_TABLE', 'PRODUCT', 'ORDER', 'LEAD', 'OPPORTUNITY', 'BID_NOTICE', 'BID_DOCUMENT', 'CONTRACT');

-- CreateEnum
CREATE TYPE "TenantCompanyStatus" AS ENUM ('PROSPECT', 'ACTIVE', 'SUSPENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "LicenseBillingCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "AttentionSeverity" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "AttentionStatus" AS ENUM ('PENDENTE', 'RESOLVIDO');

-- CreateEnum
CREATE TYPE "LearningCategory" AS ENUM ('NEGOCIACAO', 'CONCORRENCIA', 'EDITAL_JURIDICO', 'ESCOPO_TECNICO', 'PERDA_DE_DEAL', 'RELACIONAMENTO', 'PRECIFICACAO', 'OUTRO');

-- CreateEnum
CREATE TYPE "CustomFieldDataType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON', 'OBJECT', 'ARRAY');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'ERROR', 'WARNING', 'INFO');

-- CreateEnum
CREATE TYPE "CompetitorStatus" AS ENUM ('COMPETING', 'WON_AGAINST', 'LOST_TO', 'NOT_COMPETING');

-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('PROPOSAL_APPROVAL', 'DISCOUNT_APPROVAL', 'PRICE_APPROVAL', 'CONTRACT_APPROVAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkflowAdvancedType" AS ENUM ('CONDITIONAL', 'SEQUENTIAL', 'PARALLEL', 'ESCALATION', 'APPROVAL', 'NOTIFICATION');

-- CreateEnum
CREATE TYPE "WorkflowCategory" AS ENUM ('GENERAL', 'SALES', 'MARKETING', 'SUPPORT', 'FINANCE', 'HR');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('WORKFLOW', 'APPROVAL', 'REMINDER', 'ALERT', 'SYSTEM', 'MARKETING');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "SurveyStatus" AS ENUM ('PENDING', 'SENT', 'RESPONDED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ChurnRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('ACTIVE', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'AWAITING_SIGNATURE', 'ACTIVE', 'RENEWAL_PENDING', 'EXPIRED', 'CANCELLED', 'RENEWED');

-- CreateEnum
CREATE TYPE "PreSalesStatus" AS ENUM ('NOVA', 'EM_PRECIFICACAO', 'AGUARDANDO_APROVACAO', 'ENVIADA', 'APROVADO', 'REPROVADO', 'FINALIZADA', 'REJEITADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "BidNoticeType" AS ENUM ('EDITAL', 'TERMO_REFERENCIA', 'ATA_REGISTRO_PRECOS', 'DOCUMENTACAO');

-- CreateEnum
CREATE TYPE "BidNoticeStatus" AS ENUM ('MONITORANDO', 'ANALISE_EM_ANDAMENTO', 'ANALISE_CONCLUIDA', 'PROPOSTA_EM_PREPARACAO', 'ENVIADA', 'SUSPENSA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('B2B', 'B2G', 'B2C');

-- CreateEnum
CREATE TYPE "StatusProcessamentoPncp" AS ENUM ('NOVO', 'PROCESSADO', 'ERRO', 'REPROCESSAR');

-- CreateEnum
CREATE TYPE "KickoffPhase" AS ENUM ('ENTENDIMENTO_OPORTUNIDADE', 'APRESENTACAO_PROPOSTA', 'FECHAMENTO_PROJETO', 'ALINHAMENTO_INTERNO', 'ALINHAMENTO_EXTERNO');

-- CreateEnum
CREATE TYPE "KickoffMeetingStatus" AS ENUM ('AGENDADA', 'REALIZADA', 'CANCELADA', 'REAGENDADA');

-- CreateEnum
CREATE TYPE "KickoffPlatform" AS ENUM ('MEET', 'TEAMS', 'ZOOM', 'PRESENCIAL', 'TELEFONE', 'OUTRO');

-- CreateEnum
CREATE TYPE "KickoffParticipantRole" AS ENUM ('ORGANIZADOR', 'INTERNO', 'EXTERNO');

-- CreateEnum
CREATE TYPE "KickoffParticipantStatus" AS ENUM ('CONVIDADO', 'CONFIRMADO', 'RECUSADO', 'PRESENTE');

-- CreateEnum
CREATE TYPE "KickoffActionItemStatus" AS ENUM ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'CANCELADO');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SELLER',
    "tenantCompanyId" TEXT,
    "regionId" TEXT,
    "quota" DOUBLE PRECISION,
    "commissionSalePercentage" DOUBLE PRECISION,
    "commissionProject12" DOUBLE PRECISION,
    "commissionProject24" DOUBLE PRECISION,
    "commissionProject36" DOUBLE PRECISION,
    "commissionProject48" DOUBLE PRECISION,
    "commissionProject60" DOUBLE PRECISION,
    "accessB2B" BOOLEAN NOT NULL DEFAULT true,
    "accessB2G" BOOLEAN NOT NULL DEFAULT true,
    "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
    "accessManagement" BOOLEAN NOT NULL DEFAULT false,
    "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
    "permissionOverrides" JSONB NOT NULL DEFAULT '{}',
    "isCompanyOwner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "segment" TEXT,
    "subsegment" TEXT,
    "clientType" "ClientType" NOT NULL DEFAULT 'B2B',
    "size" "CompanySize",
    "website" TEXT,
    "logo" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Brasil',
    "regionId" TEXT,
    "status" "CompanyStatus" NOT NULL DEFAULT 'ACTIVE',
    "leadScore" INTEGER NOT NULL DEFAULT 0,
    "churnRisk" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "accessB2B" BOOLEAN NOT NULL DEFAULT true,
    "accessB2G" BOOLEAN NOT NULL DEFAULT false,
    "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
    "accessManagement" BOOLEAN NOT NULL DEFAULT false,
    "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
    "tenantCompanyId" TEXT,
    "leadEntryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountManagerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "position" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "margin" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tenantCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "number" TEXT,
    "title" TEXT NOT NULL,
    "projectName" TEXT,
    "projectClientType" TEXT,
    "negotiationType" TEXT,
    "projectClassification" TEXT,
    "projectTower" TEXT,
    "projectDetail" TEXT,
    "manufacturer" TEXT,
    "licenseCount" INTEGER,
    "contractMonths" INTEGER,
    "monthlyValue" DOUBLE PRECISION,
    "installationFee" DOUBLE PRECISION,
    "leadSourceDetail" TEXT,
    "importSource" TEXT,
    "importSourceRow" INTEGER,
    "projectType" TEXT NOT NULL DEFAULT 'SINGLE',
    "projectMonths" INTEGER,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "probability" INTEGER NOT NULL DEFAULT 50,
    "stage" "Stage" NOT NULL,
    "b2gStage" TEXT,
    "source" "LeadSource",
    "leadEntryDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedCloseDate" TIMESTAMP(3),
    "actualCloseDate" TIMESTAMP(3),
    "customerTurnDate" TIMESTAMP(3),
    "exitDate" TIMESTAMP(3),
    "lossReason" TEXT,
    "stageDecisionDetails" JSONB,
    "notes" TEXT,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "tenantCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityAttentionPoint" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "AttentionSeverity" NOT NULL DEFAULT 'MEDIA',
    "status" "AttentionStatus" NOT NULL DEFAULT 'PENDENTE',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "tenantCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityAttentionPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityLearning" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "category" "LearningCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "tenantCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpportunityLearning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityFollowUp" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT,
    "opportunityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OpportunityFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OpportunityProduct" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunityId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "OpportunityProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "companyId" TEXT,
    "opportunityId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "tenantCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" "ProposalType" NOT NULL DEFAULT 'COMMERCIAL',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sectionsData" JSONB NOT NULL DEFAULT '{}',
    "totalValue" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "validUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "opportunityId" TEXT NOT NULL,
    "priceTableId" TEXT,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProposalType" NOT NULL DEFAULT 'COMMERCIAL',
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "coverEnabled" BOOLEAN NOT NULL DEFAULT true,
    "coverTitle" TEXT,
    "coverSubtitle" TEXT,
    "coverLogo" TEXT,
    "coverBackground" TEXT,
    "headerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "headerLogo" TEXT,
    "headerText" TEXT,
    "headerHeight" INTEGER NOT NULL DEFAULT 80,
    "footerEnabled" BOOLEAN NOT NULL DEFAULT true,
    "footerText" TEXT,
    "footerLogo" TEXT,
    "footerHeight" INTEGER NOT NULL DEFAULT 60,
    "indexEnabled" BOOLEAN NOT NULL DEFAULT true,
    "indexTitle" TEXT NOT NULL DEFAULT 'Índice',
    "sections" JSONB NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#3B82F6',
    "secondaryColor" TEXT NOT NULL DEFAULT '#64748B',
    "fontFamily" TEXT NOT NULL DEFAULT 'Inter',
    "fontSize" INTEGER NOT NULL DEFAULT 12,
    "pageMargins" JSONB NOT NULL DEFAULT '{"top": 40, "right": 40, "bottom": 40, "left": 40}',
    "pageSize" TEXT NOT NULL DEFAULT 'A4',
    "pageOrientation" TEXT NOT NULL DEFAULT 'portrait',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProposalTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalItem" (
    "id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "proposalId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "ProposalItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "calculationBase" DOUBLE PRECISION,
    "projectType" TEXT NOT NULL DEFAULT 'SINGLE',
    "projectMonths" INTEGER,
    "status" "CommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "opportunityId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "provider" "IntegrationProvider" NOT NULL DEFAULT 'CUSTOM',
    "partnerTier" "PartnerTier" NOT NULL DEFAULT 'BRONZE',
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "clientId" TEXT,
    "clientSecretHash" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rateLimitPerMinute" INTEGER,
    "webhookSigningSecret" TEXT,
    "metadata" JSONB,
    "webhookUrl" TEXT,
    "lastSync" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" "LogStatus" NOT NULL,
    "message" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationAccessToken" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationAccessToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationRateLimitWindow" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationRateLimitWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationIdempotencyKey" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationIdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhookEndpoint" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "lastTriggeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationWebhookEndpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationWebhookDelivery" (
    "id" TEXT NOT NULL,
    "endpointId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "httpStatus" INTEGER,
    "errorResponse" TEXT,
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationWebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationFieldMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "module" "IntegrationModule" NOT NULL,
    "entityType" "IntegrationEntityType" NOT NULL,
    "sourceField" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transformRule" JSONB,
    "defaultValue" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationFieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationCustomField" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "module" "IntegrationModule" NOT NULL,
    "entityType" "IntegrationEntityType" NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "dataType" "CustomFieldDataType" NOT NULL DEFAULT 'STRING',
    "description" TEXT,
    "totvsFieldCode" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "defaultValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationCustomField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEntityMapping" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "module" "IntegrationModule" NOT NULL,
    "entityType" "IntegrationEntityType" NOT NULL,
    "internalId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEntityMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationEntityData" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "module" "IntegrationModule" NOT NULL,
    "entityType" "IntegrationEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationEntityData_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationOrder" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "companyId" TEXT,
    "opportunityId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "totalValue" DOUBLE PRECISION NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantCompany" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "cnpj" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "status" "TenantCompanyStatus" NOT NULL DEFAULT 'PROSPECT',
    "notes" TEXT,
    "accessB2B" BOOLEAN NOT NULL DEFAULT true,
    "accessB2G" BOOLEAN NOT NULL DEFAULT false,
    "accessPreSales" BOOLEAN NOT NULL DEFAULT false,
    "accessManagement" BOOLEAN NOT NULL DEFAULT false,
    "accessAutomation" BOOLEAN NOT NULL DEFAULT false,
    "rolePolicyOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantCompany_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LicensePlan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "billingCycle" "LicenseBillingCycle" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "seatsIncluded" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "features" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LicensePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyLicense" (
    "id" TEXT NOT NULL,
    "tenantCompanyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "LicenseStatus" NOT NULL DEFAULT 'PENDING',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "priceAtPurchase" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "paymentReference" TEXT,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceTable" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "regionId" TEXT,
    "customerSegment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductPrice" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceTableId" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ProductPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "strengths" TEXT,
    "weaknesses" TEXT,
    "pricing" TEXT,
    "marketShare" DOUBLE PRECISION,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitorComparison" (
    "id" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "competitorId" TEXT NOT NULL,
    "status" "CompetitorStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitorComparison_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Brasil',
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "steps" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalRequest" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApprovalStep" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "status" "StepStatus" NOT NULL,
    "comments" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CrossSellRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mainProductId" TEXT NOT NULL,
    "suggestedProductId" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CrossSellRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UpSellRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mainProductId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UpSellRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "targetDeals" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "bonusPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBonus" (
    "id" TEXT NOT NULL,
    "regionId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBonus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamBonusDistribution" (
    "id" TEXT NOT NULL,
    "teamBonusId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamBonusDistribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdvancedWorkflow" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "WorkflowAdvancedType" NOT NULL,
    "category" "WorkflowCategory" NOT NULL DEFAULT 'GENERAL',
    "trigger" JSONB NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "escalationRules" JSONB,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvancedWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowExecution" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "triggeredById" TEXT,
    "triggerData" JSONB NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "results" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOnboarding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contractId" TEXT,
    "assignedToId" TEXT NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'PENDING',
    "expectedEndDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingStep" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "order" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "category" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "companyId" TEXT,
    "assignedToId" TEXT,
    "slaDeadline" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketResponse" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NPSSurvey" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "contractId" TEXT,
    "score" INTEGER,
    "feedback" TEXT,
    "status" "SurveyStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NPSSurvey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChurnAlert" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "riskLevel" "ChurnRisk" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "reasons" TEXT[],
    "assignedToId" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChurnAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'ACTIVE',
    "slaResponseTime" INTEGER,
    "slaResolutionTime" INTEGER,
    "slaAvailability" DOUBLE PRECISION,
    "slaDescription" TEXT,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractAttachment" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSalesRequest" (
    "id" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "nomeCliente" TEXT,
    "modalidade" TEXT,
    "status" "PreSalesStatus" NOT NULL DEFAULT 'NOVA',
    "prioridade" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "tiposPrecificacao" TEXT[],
    "regimeTributario" TEXT,
    "valorSugerido" DOUBLE PRECISION,
    "custoTotal" DOUBLE PRECISION,
    "margemLucro" DOUBLE PRECISION,
    "calculoDetalhes" JSONB,
    "observacoes" TEXT,
    "dataAprovacao" TIMESTAMP(3),
    "dataRejeicao" TIMESTAMP(3),
    "solicitanteId" TEXT NOT NULL,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "aprovadoPorId" TEXT,
    "rejeitadoPorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreSalesRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSalesItem" (
    "id" TEXT NOT NULL,
    "preSalesRequestId" TEXT NOT NULL,
    "productId" TEXT,
    "descricao" TEXT,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "custoUnitario" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "precoSugerido" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margemLucro" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreSalesItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSalesApproval" (
    "id" TEXT NOT NULL,
    "preSalesRequestId" TEXT NOT NULL,
    "aprovadorId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL,
    "observacoes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreSalesApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSalesPoc" (
    "id" TEXT NOT NULL,
    "relatedOpportunityId" TEXT,
    "relatedOpportunityNumber" TEXT,
    "relatedOpportunityTitle" TEXT,
    "title" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "environment" TEXT,
    "objective" TEXT NOT NULL,
    "scope" TEXT,
    "successCriteria" TEXT NOT NULL,
    "commercialOwner" TEXT NOT NULL,
    "technicalOwner" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PLANEJAMENTO',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "nextStep" TEXT,
    "risks" TEXT,
    "resultSummary" TEXT,
    "decisionReason" TEXT,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "discardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreSalesPoc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSalesPocFollowUp" (
    "id" TEXT NOT NULL,
    "pocId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "nextStep" TEXT,
    "status" TEXT,
    "progress" INTEGER,
    "createdById" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreSalesPocFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidNotice" (
    "id" TEXT NOT NULL,
    "type" "BidNoticeType" NOT NULL DEFAULT 'EDITAL',
    "title" TEXT NOT NULL,
    "referenceCode" TEXT,
    "organization" TEXT NOT NULL,
    "stateCode" TEXT,
    "modality" TEXT,
    "objectDescription" TEXT,
    "estimatedValue" DOUBLE PRECISION,
    "openingDate" TIMESTAMP(3),
    "proposalDueDate" TIMESTAMP(3),
    "status" "BidNoticeStatus" NOT NULL DEFAULT 'MONITORANDO',
    "sourceUrl" TEXT,
    "documentText" TEXT,
    "summary" TEXT,
    "aiAnalysis" JSONB,
    "documentation" JSONB,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BidNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BidNoticeHistory" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" TEXT,
    "payload" JSONB,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BidNoticeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedAnalysis" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "processedAt" TEXT NOT NULL,
    "extractedData" JSONB NOT NULL,
    "originalFileDataUri" TEXT,
    "summaryPdfDataUri" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PendingSubscription" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "companyName" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "responsibleName" TEXT NOT NULL,
    "responsibleEmail" TEXT NOT NULL,
    "responsiblePhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PendingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ProjectType" NOT NULL,
    "phase" "ProjectPhaseType" NOT NULL DEFAULT 'SETUP',
    "status" "ProjectStatus" NOT NULL DEFAULT 'PLANEJADO',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "opportunityId" TEXT,
    "contractId" TEXT,
    "companyId" TEXT NOT NULL,
    "projectManagerId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectPhase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "status" "ProjectPhaseStatus" NOT NULL DEFAULT 'PENDING',
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "progressPercent" INTEGER NOT NULL DEFAULT 0,
    "assignedToId" TEXT,
    "responsibleIds" JSONB DEFAULT '[]',
    "accountableId" TEXT,
    "consultedIds" JSONB DEFAULT '[]',
    "informedIds" JSONB DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMilestone" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "MilestoneStatus" NOT NULL DEFAULT 'PENDING',
    "plannedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "billingTrigger" BOOLEAN NOT NULL DEFAULT false,
    "billingValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "milestoneId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "estimatedHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dependencyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTeam" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectRole" NOT NULL DEFAULT 'DEVELOPER',
    "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "hourlyCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTeam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTimelog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "teamId" TEXT,
    "userId" TEXT NOT NULL,
    "logDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "billable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTimelog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectRisk" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" "RiskLevel" NOT NULL DEFAULT 'MEDIUM',
    "status" "RiskStatus" NOT NULL DEFAULT 'IDENTIFIED',
    "impact" TEXT,
    "mitigationPlan" TEXT,
    "ownerId" TEXT,
    "identifiedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectRisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectIssue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "reportedById" TEXT,
    "assignedToId" TEXT,
    "reportedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAttachment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "category" "AttachmentCategory" NOT NULL DEFAULT 'OTHER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectChangeRequest" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "ChangeRequestType" NOT NULL DEFAULT 'SCOPE',
    "status" "ChangeRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "impactCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impactDays" INTEGER NOT NULL DEFAULT 0,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "justification" JSONB NOT NULL DEFAULT '{}',
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectBilling" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "milestoneId" TEXT,
    "invoiceNumber" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" "BillingStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "invoiceData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectBilling_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAcceptance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "AcceptanceType" NOT NULL DEFAULT 'PROVISIONAL',
    "status" "AcceptanceStatus" NOT NULL DEFAULT 'PENDING',
    "documentNumber" TEXT,
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectB2GConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "empenhoNumber" TEXT,
    "empenhoValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ordemServicoNumber" TEXT,
    "editalNumber" TEXT,
    "orgaoCNPJ" TEXT,
    "fiscalContrato" TEXT,
    "gestorContrato" TEXT,
    "medicoes" JSONB NOT NULL DEFAULT '[]',
    "aditivos" JSONB NOT NULL DEFAULT '[]',
    "conformidade" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectB2GConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectB2BConfig" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "slaConfig" JSONB NOT NULL DEFAULT '{}',
    "slaHistory" JSONB NOT NULL DEFAULT '[]',
    "billingSchedule" JSONB NOT NULL DEFAULT '[]',
    "timesheetConfig" JSONB NOT NULL DEFAULT '{}',
    "contractMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "realizedMargin" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectB2BConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "licitacoes_pncp" (
    "id" TEXT NOT NULL,
    "numero_controle_pncp" TEXT NOT NULL,
    "numero_compra" TEXT,
    "ano_compra" INTEGER,
    "processo" TEXT,
    "sequencial_compra" INTEGER,
    "objeto_compra" TEXT,
    "informacao_complementar" TEXT,
    "valor_total_estimado" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "valor_total_homologado" DECIMAL(15,4) NOT NULL DEFAULT 0,
    "srp" BOOLEAN NOT NULL DEFAULT false,
    "tipo_instrumento_convocatorio_id" INTEGER,
    "tipo_instrumento_convocatorio_nome" TEXT,
    "modalidade_id" INTEGER,
    "modalidade_nome" TEXT,
    "modo_disputa_id" INTEGER,
    "modo_disputa_nome" TEXT,
    "situacao_compra_id" INTEGER,
    "situacao_compra_nome" TEXT,
    "amparo_legal" JSONB,
    "data_abertura_proposta" TIMESTAMP(3),
    "data_encerramento_proposta" TIMESTAMP(3),
    "data_publicacao_pncp" DATE,
    "data_inclusao_pncp" DATE,
    "data_atualizacao_pncp" DATE,
    "orgao_entidade" JSONB,
    "unidade_orgao" JSONB,
    "orgao_sub_rogado" JSONB,
    "unidade_sub_rogada" JSONB,
    "usuario_nome" TEXT,
    "link_sistema_origem" TEXT,
    "justificativa_presencial" TEXT,
    "origem_dados" TEXT NOT NULL DEFAULT 'PNCP_API',
    "status_processamento" "StatusProcessamentoPncp" NOT NULL DEFAULT 'NOVO',
    "metadata_processamento" JSONB,
    "hash_verificacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "licitacoes_pncp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "user_email" TEXT,
    "user_role" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "details" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "phase" "KickoffPhase" NOT NULL,
    "agenda" JSONB NOT NULL DEFAULT '[]',
    "checklist" JSONB NOT NULL DEFAULT '[]',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickoffTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffMeeting" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "phase" "KickoffPhase" NOT NULL,
    "status" "KickoffMeetingStatus" NOT NULL DEFAULT 'AGENDADA',
    "platform" "KickoffPlatform" NOT NULL DEFAULT 'MEET',
    "meetingLink" TEXT,
    "meetingNotes" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime" TIMESTAMP(3),
    "opportunityId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickoffMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffParticipant" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "contactId" TEXT,
    "role" "KickoffParticipantRole" NOT NULL DEFAULT 'INTERNO',
    "status" "KickoffParticipantStatus" NOT NULL DEFAULT 'CONVIDADO',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickoffParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffAgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "tratativa" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "order" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickoffAgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffChecklistItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 1,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickoffChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffActionItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "KickoffActionItemStatus" NOT NULL DEFAULT 'PENDENTE',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KickoffActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KickoffHistory" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT,
    "userId" TEXT,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KickoffHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantCompanyId_idx" ON "User"("tenantCompanyId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Company_tenantCompanyId_idx" ON "Company"("tenantCompanyId");

-- CreateIndex
CREATE INDEX "Product_tenantCompanyId_idx" ON "Product"("tenantCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_number_key" ON "Opportunity"("number");

-- CreateIndex
CREATE INDEX "Opportunity_b2gStage_idx" ON "Opportunity"("b2gStage");

-- CreateIndex
CREATE INDEX "Opportunity_tenantCompanyId_idx" ON "Opportunity"("tenantCompanyId");

-- CreateIndex
CREATE INDEX "OpportunityAttentionPoint_opportunityId_idx" ON "OpportunityAttentionPoint"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityAttentionPoint_tenantCompanyId_idx" ON "OpportunityAttentionPoint"("tenantCompanyId");

-- CreateIndex
CREATE INDEX "OpportunityLearning_opportunityId_idx" ON "OpportunityLearning"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityLearning_tenantCompanyId_idx" ON "OpportunityLearning"("tenantCompanyId");

-- CreateIndex
CREATE INDEX "OpportunityFollowUp_opportunityId_idx" ON "OpportunityFollowUp"("opportunityId");

-- CreateIndex
CREATE INDEX "OpportunityFollowUp_userId_idx" ON "OpportunityFollowUp"("userId");

-- CreateIndex
CREATE INDEX "OpportunityFollowUp_createdAt_idx" ON "OpportunityFollowUp"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OpportunityProduct_opportunityId_productId_key" ON "OpportunityProduct"("opportunityId", "productId");

-- CreateIndex
CREATE INDEX "Activity_tenantCompanyId_idx" ON "Activity"("tenantCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_number_key" ON "Proposal"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_opportunityId_key" ON "Commission"("opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_clientId_key" ON "Integration"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationAccessToken_tokenHash_key" ON "IntegrationAccessToken"("tokenHash");

-- CreateIndex
CREATE INDEX "IntegrationAccessToken_integrationId_expiresAt_idx" ON "IntegrationAccessToken"("integrationId", "expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationAccessToken_tokenHash_expiresAt_idx" ON "IntegrationAccessToken"("tokenHash", "expiresAt");

-- CreateIndex
CREATE INDEX "IntegrationRateLimitWindow_windowStart_idx" ON "IntegrationRateLimitWindow"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationRateLimitWindow_integrationId_windowStart_key" ON "IntegrationRateLimitWindow"("integrationId", "windowStart");

-- CreateIndex
CREATE INDEX "IntegrationIdempotencyKey_expiresAt_idx" ON "IntegrationIdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationIdempotencyKey_integrationId_scope_key_key" ON "IntegrationIdempotencyKey"("integrationId", "scope", "key");

-- CreateIndex
CREATE INDEX "IntegrationWebhookEndpoint_integrationId_eventType_isActive_idx" ON "IntegrationWebhookEndpoint"("integrationId", "eventType", "isActive");

-- CreateIndex
CREATE INDEX "IntegrationWebhookDelivery_status_nextAttemptAt_idx" ON "IntegrationWebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "IntegrationWebhookDelivery_integrationId_eventType_createdA_idx" ON "IntegrationWebhookDelivery"("integrationId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "IntegrationFieldMapping_integrationId_module_entityType_idx" ON "IntegrationFieldMapping"("integrationId", "module", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationFieldMapping_integrationId_module_entityType_sou_key" ON "IntegrationFieldMapping"("integrationId", "module", "entityType", "sourceField");

-- CreateIndex
CREATE INDEX "IntegrationCustomField_integrationId_module_entityType_idx" ON "IntegrationCustomField"("integrationId", "module", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationCustomField_integrationId_module_entityType_fiel_key" ON "IntegrationCustomField"("integrationId", "module", "entityType", "fieldKey");

-- CreateIndex
CREATE INDEX "IntegrationEntityMapping_integrationId_module_entityType_in_idx" ON "IntegrationEntityMapping"("integrationId", "module", "entityType", "internalId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEntityMapping_integrationId_module_entityType_ex_key" ON "IntegrationEntityMapping"("integrationId", "module", "entityType", "externalId");

-- CreateIndex
CREATE INDEX "IntegrationEntityData_integrationId_module_entityType_idx" ON "IntegrationEntityData"("integrationId", "module", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationEntityData_integrationId_module_entityType_entit_key" ON "IntegrationEntityData"("integrationId", "module", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "IntegrationOrder_companyId_issuedAt_idx" ON "IntegrationOrder"("companyId", "issuedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationOrder_integrationId_externalOrderId_key" ON "IntegrationOrder"("integrationId", "externalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantCompany_cnpj_key" ON "TenantCompany"("cnpj");

-- CreateIndex
CREATE INDEX "TenantCompany_status_createdAt_idx" ON "TenantCompany"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LicensePlan_code_key" ON "LicensePlan"("code");

-- CreateIndex
CREATE INDEX "LicensePlan_isActive_sortOrder_idx" ON "LicensePlan"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLicense_paymentReference_key" ON "CompanyLicense"("paymentReference");

-- CreateIndex
CREATE INDEX "CompanyLicense_tenantCompanyId_status_endDate_idx" ON "CompanyLicense"("tenantCompanyId", "status", "endDate");

-- CreateIndex
CREATE INDEX "CompanyLicense_paymentStatus_createdAt_idx" ON "CompanyLicense"("paymentStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductPrice_productId_priceTableId_minQuantity_key" ON "ProductPrice"("productId", "priceTableId", "minQuantity");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "Region"("code");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_number_key" ON "SupportTicket"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_number_key" ON "Contract"("number");

-- CreateIndex
CREATE UNIQUE INDEX "PreSalesRequest_numero_key" ON "PreSalesRequest"("numero");

-- CreateIndex
CREATE INDEX "PreSalesPoc_status_idx" ON "PreSalesPoc"("status");

-- CreateIndex
CREATE INDEX "PreSalesPoc_priority_idx" ON "PreSalesPoc"("priority");

-- CreateIndex
CREATE INDEX "PreSalesPoc_dueDate_idx" ON "PreSalesPoc"("dueDate");

-- CreateIndex
CREATE INDEX "PreSalesPoc_relatedOpportunityId_idx" ON "PreSalesPoc"("relatedOpportunityId");

-- CreateIndex
CREATE INDEX "PreSalesPocFollowUp_pocId_createdAt_idx" ON "PreSalesPocFollowUp"("pocId", "createdAt");

-- CreateIndex
CREATE INDEX "SavedAnalysis_companyId_createdByUserId_idx" ON "SavedAnalysis"("companyId", "createdByUserId");

-- CreateIndex
CREATE INDEX "SavedAnalysis_createdAt_idx" ON "SavedAnalysis"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SavedAnalysis_companyId_analysisId_key" ON "SavedAnalysis"("companyId", "analysisId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX "PendingSubscription_status_idx" ON "PendingSubscription"("status");

-- CreateIndex
CREATE INDEX "PendingSubscription_responsibleEmail_idx" ON "PendingSubscription"("responsibleEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Project_number_key" ON "Project"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Project_opportunityId_key" ON "Project"("opportunityId");

-- CreateIndex
CREATE INDEX "Project_companyId_idx" ON "Project"("companyId");

-- CreateIndex
CREATE INDEX "Project_projectManagerId_idx" ON "Project"("projectManagerId");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "Project_phase_idx" ON "Project"("phase");

-- CreateIndex
CREATE INDEX "Project_type_idx" ON "Project"("type");

-- CreateIndex
CREATE INDEX "ProjectPhase_projectId_idx" ON "ProjectPhase"("projectId");

-- CreateIndex
CREATE INDEX "ProjectPhase_order_idx" ON "ProjectPhase"("order");

-- CreateIndex
CREATE INDEX "ProjectPhase_assignedToId_idx" ON "ProjectPhase"("assignedToId");

-- CreateIndex
CREATE INDEX "ProjectPhase_accountableId_idx" ON "ProjectPhase"("accountableId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_projectId_idx" ON "ProjectMilestone"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_phaseId_idx" ON "ProjectMilestone"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_status_idx" ON "ProjectMilestone"("status");

-- CreateIndex
CREATE INDEX "ProjectTask_projectId_idx" ON "ProjectTask"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTask_phaseId_idx" ON "ProjectTask"("phaseId");

-- CreateIndex
CREATE INDEX "ProjectTask_milestoneId_idx" ON "ProjectTask"("milestoneId");

-- CreateIndex
CREATE INDEX "ProjectTask_assignedToId_idx" ON "ProjectTask"("assignedToId");

-- CreateIndex
CREATE INDEX "ProjectTask_status_idx" ON "ProjectTask"("status");

-- CreateIndex
CREATE INDEX "ProjectTeam_projectId_idx" ON "ProjectTeam"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTeam_userId_idx" ON "ProjectTeam"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeam_projectId_userId_key" ON "ProjectTeam"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectTimelog_projectId_idx" ON "ProjectTimelog"("projectId");

-- CreateIndex
CREATE INDEX "ProjectTimelog_taskId_idx" ON "ProjectTimelog"("taskId");

-- CreateIndex
CREATE INDEX "ProjectTimelog_userId_idx" ON "ProjectTimelog"("userId");

-- CreateIndex
CREATE INDEX "ProjectTimelog_logDate_idx" ON "ProjectTimelog"("logDate");

-- CreateIndex
CREATE INDEX "ProjectRisk_projectId_idx" ON "ProjectRisk"("projectId");

-- CreateIndex
CREATE INDEX "ProjectRisk_level_idx" ON "ProjectRisk"("level");

-- CreateIndex
CREATE INDEX "ProjectRisk_status_idx" ON "ProjectRisk"("status");

-- CreateIndex
CREATE INDEX "ProjectIssue_projectId_idx" ON "ProjectIssue"("projectId");

-- CreateIndex
CREATE INDEX "ProjectIssue_status_idx" ON "ProjectIssue"("status");

-- CreateIndex
CREATE INDEX "ProjectIssue_priority_idx" ON "ProjectIssue"("priority");

-- CreateIndex
CREATE INDEX "ProjectAttachment_projectId_idx" ON "ProjectAttachment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChangeRequest_projectId_idx" ON "ProjectChangeRequest"("projectId");

-- CreateIndex
CREATE INDEX "ProjectChangeRequest_status_idx" ON "ProjectChangeRequest"("status");

-- CreateIndex
CREATE INDEX "ProjectBilling_projectId_idx" ON "ProjectBilling"("projectId");

-- CreateIndex
CREATE INDEX "ProjectBilling_status_idx" ON "ProjectBilling"("status");

-- CreateIndex
CREATE INDEX "ProjectAcceptance_projectId_idx" ON "ProjectAcceptance"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAcceptance_type_idx" ON "ProjectAcceptance"("type");

-- CreateIndex
CREATE INDEX "ProjectAcceptance_status_idx" ON "ProjectAcceptance"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectB2GConfig_projectId_key" ON "ProjectB2GConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectB2BConfig_projectId_key" ON "ProjectB2BConfig"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "licitacoes_pncp_numero_controle_pncp_key" ON "licitacoes_pncp"("numero_controle_pncp");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_numero_controle_pncp_idx" ON "licitacoes_pncp"("numero_controle_pncp");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_data_publicacao_pncp_idx" ON "licitacoes_pncp"("data_publicacao_pncp");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_modalidade_id_modalidade_nome_idx" ON "licitacoes_pncp"("modalidade_id", "modalidade_nome");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_situacao_compra_id_idx" ON "licitacoes_pncp"("situacao_compra_id");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_data_abertura_proposta_data_encerramento_pr_idx" ON "licitacoes_pncp"("data_abertura_proposta", "data_encerramento_proposta");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_valor_total_estimado_idx" ON "licitacoes_pncp"("valor_total_estimado");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_status_processamento_created_at_idx" ON "licitacoes_pncp"("status_processamento", "created_at");

-- CreateIndex
CREATE INDEX "licitacoes_pncp_ano_compra_idx" ON "licitacoes_pncp"("ano_compra");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resource_resource_id_idx" ON "audit_logs"("resource", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "KickoffTemplate_phase_idx" ON "KickoffTemplate"("phase");

-- CreateIndex
CREATE INDEX "KickoffTemplate_isActive_isDefault_idx" ON "KickoffTemplate"("isActive", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "KickoffMeeting_number_key" ON "KickoffMeeting"("number");

-- CreateIndex
CREATE INDEX "KickoffMeeting_status_idx" ON "KickoffMeeting"("status");

-- CreateIndex
CREATE INDEX "KickoffMeeting_phase_idx" ON "KickoffMeeting"("phase");

-- CreateIndex
CREATE INDEX "KickoffMeeting_opportunityId_idx" ON "KickoffMeeting"("opportunityId");

-- CreateIndex
CREATE INDEX "KickoffMeeting_companyId_idx" ON "KickoffMeeting"("companyId");

-- CreateIndex
CREATE INDEX "KickoffMeeting_ownerId_idx" ON "KickoffMeeting"("ownerId");

-- CreateIndex
CREATE INDEX "KickoffMeeting_scheduledDate_idx" ON "KickoffMeeting"("scheduledDate");

-- CreateIndex
CREATE INDEX "KickoffMeeting_createdAt_idx" ON "KickoffMeeting"("createdAt");

-- CreateIndex
CREATE INDEX "KickoffParticipant_meetingId_idx" ON "KickoffParticipant"("meetingId");

-- CreateIndex
CREATE INDEX "KickoffParticipant_userId_idx" ON "KickoffParticipant"("userId");

-- CreateIndex
CREATE INDEX "KickoffParticipant_contactId_idx" ON "KickoffParticipant"("contactId");

-- CreateIndex
CREATE INDEX "KickoffAgendaItem_meetingId_order_idx" ON "KickoffAgendaItem"("meetingId", "order");

-- CreateIndex
CREATE INDEX "KickoffChecklistItem_meetingId_order_idx" ON "KickoffChecklistItem"("meetingId", "order");

-- CreateIndex
CREATE INDEX "KickoffActionItem_meetingId_idx" ON "KickoffActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "KickoffActionItem_assigneeId_status_idx" ON "KickoffActionItem"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "KickoffHistory_meetingId_createdAt_idx" ON "KickoffHistory"("meetingId", "createdAt");

-- CreateIndex
CREATE INDEX "KickoffHistory_userId_idx" ON "KickoffHistory"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAttentionPoint" ADD CONSTRAINT "OpportunityAttentionPoint_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAttentionPoint" ADD CONSTRAINT "OpportunityAttentionPoint_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAttentionPoint" ADD CONSTRAINT "OpportunityAttentionPoint_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityAttentionPoint" ADD CONSTRAINT "OpportunityAttentionPoint_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityLearning" ADD CONSTRAINT "OpportunityLearning_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityLearning" ADD CONSTRAINT "OpportunityLearning_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityLearning" ADD CONSTRAINT "OpportunityLearning_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityFollowUp" ADD CONSTRAINT "OpportunityFollowUp_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityFollowUp" ADD CONSTRAINT "OpportunityFollowUp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityProduct" ADD CONSTRAINT "OpportunityProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ProposalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalItem" ADD CONSTRAINT "ProposalItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationAccessToken" ADD CONSTRAINT "IntegrationAccessToken_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationRateLimitWindow" ADD CONSTRAINT "IntegrationRateLimitWindow_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationIdempotencyKey" ADD CONSTRAINT "IntegrationIdempotencyKey_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookEndpoint" ADD CONSTRAINT "IntegrationWebhookEndpoint_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookDelivery" ADD CONSTRAINT "IntegrationWebhookDelivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "IntegrationWebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationWebhookDelivery" ADD CONSTRAINT "IntegrationWebhookDelivery_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationFieldMapping" ADD CONSTRAINT "IntegrationFieldMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationCustomField" ADD CONSTRAINT "IntegrationCustomField_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEntityMapping" ADD CONSTRAINT "IntegrationEntityMapping_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationEntityData" ADD CONSTRAINT "IntegrationEntityData_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationOrder" ADD CONSTRAINT "IntegrationOrder_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationOrder" ADD CONSTRAINT "IntegrationOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationOrder" ADD CONSTRAINT "IntegrationOrder_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLicense" ADD CONSTRAINT "CompanyLicense_tenantCompanyId_fkey" FOREIGN KEY ("tenantCompanyId") REFERENCES "TenantCompany"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyLicense" ADD CONSTRAINT "CompanyLicense_planId_fkey" FOREIGN KEY ("planId") REFERENCES "LicensePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceTable" ADD CONSTRAINT "PriceTable_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductPrice" ADD CONSTRAINT "ProductPrice_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "PriceTable"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorComparison" ADD CONSTRAINT "CompetitorComparison_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitorComparison" ADD CONSTRAINT "CompetitorComparison_competitorId_fkey" FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "ApprovalWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalStep" ADD CONSTRAINT "ApprovalStep_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellRule" ADD CONSTRAINT "CrossSellRule_mainProductId_fkey" FOREIGN KEY ("mainProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CrossSellRule" ADD CONSTRAINT "CrossSellRule_suggestedProductId_fkey" FOREIGN KEY ("suggestedProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpSellRule" ADD CONSTRAINT "UpSellRule_mainProductId_fkey" FOREIGN KEY ("mainProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UpSellRule" ADD CONSTRAINT "UpSellRule_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBonus" ADD CONSTRAINT "TeamBonus_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBonusDistribution" ADD CONSTRAINT "TeamBonusDistribution_teamBonusId_fkey" FOREIGN KEY ("teamBonusId") REFERENCES "TeamBonus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamBonusDistribution" ADD CONSTRAINT "TeamBonusDistribution_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "AdvancedWorkflow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnboarding" ADD CONSTRAINT "CustomerOnboarding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnboarding" ADD CONSTRAINT "CustomerOnboarding_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerOnboarding" ADD CONSTRAINT "CustomerOnboarding_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingStep" ADD CONSTRAINT "OnboardingStep_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "CustomerOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketResponse" ADD CONSTRAINT "TicketResponse_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketResponse" ADD CONSTRAINT "TicketResponse_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPSSurvey" ADD CONSTRAINT "NPSSurvey_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NPSSurvey" ADD CONSTRAINT "NPSSurvey_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurnAlert" ADD CONSTRAINT "ChurnAlert_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChurnAlert" ADD CONSTRAINT "ChurnAlert_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractAttachment" ADD CONSTRAINT "ContractAttachment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesRequest" ADD CONSTRAINT "PreSalesRequest_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesRequest" ADD CONSTRAINT "PreSalesRequest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesRequest" ADD CONSTRAINT "PreSalesRequest_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesRequest" ADD CONSTRAINT "PreSalesRequest_aprovadoPorId_fkey" FOREIGN KEY ("aprovadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesRequest" ADD CONSTRAINT "PreSalesRequest_rejeitadoPorId_fkey" FOREIGN KEY ("rejeitadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesItem" ADD CONSTRAINT "PreSalesItem_preSalesRequestId_fkey" FOREIGN KEY ("preSalesRequestId") REFERENCES "PreSalesRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesItem" ADD CONSTRAINT "PreSalesItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesApproval" ADD CONSTRAINT "PreSalesApproval_preSalesRequestId_fkey" FOREIGN KEY ("preSalesRequestId") REFERENCES "PreSalesRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesApproval" ADD CONSTRAINT "PreSalesApproval_aprovadorId_fkey" FOREIGN KEY ("aprovadorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSalesPocFollowUp" ADD CONSTRAINT "PreSalesPocFollowUp_pocId_fkey" FOREIGN KEY ("pocId") REFERENCES "PreSalesPoc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BidNoticeHistory" ADD CONSTRAINT "BidNoticeHistory_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "BidNotice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_projectManagerId_fkey" FOREIGN KEY ("projectManagerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectPhase" ADD CONSTRAINT "ProjectPhase_accountableId_fkey" FOREIGN KEY ("accountableId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "ProjectPhase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_dependencyId_fkey" FOREIGN KEY ("dependencyId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTeam" ADD CONSTRAINT "ProjectTeam_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelog" ADD CONSTRAINT "ProjectTimelog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelog" ADD CONSTRAINT "ProjectTimelog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelog" ADD CONSTRAINT "ProjectTimelog_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "ProjectTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTimelog" ADD CONSTRAINT "ProjectTimelog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectRisk" ADD CONSTRAINT "ProjectRisk_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectIssue" ADD CONSTRAINT "ProjectIssue_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeRequest" ADD CONSTRAINT "ProjectChangeRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeRequest" ADD CONSTRAINT "ProjectChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectChangeRequest" ADD CONSTRAINT "ProjectChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBilling" ADD CONSTRAINT "ProjectBilling_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectBilling" ADD CONSTRAINT "ProjectBilling_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "ProjectMilestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAcceptance" ADD CONSTRAINT "ProjectAcceptance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAcceptance" ADD CONSTRAINT "ProjectAcceptance_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectB2GConfig" ADD CONSTRAINT "ProjectB2GConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectB2BConfig" ADD CONSTRAINT "ProjectB2BConfig_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffMeeting" ADD CONSTRAINT "KickoffMeeting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "KickoffTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffParticipant" ADD CONSTRAINT "KickoffParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffParticipant" ADD CONSTRAINT "KickoffParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffParticipant" ADD CONSTRAINT "KickoffParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffAgendaItem" ADD CONSTRAINT "KickoffAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffChecklistItem" ADD CONSTRAINT "KickoffChecklistItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffChecklistItem" ADD CONSTRAINT "KickoffChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffActionItem" ADD CONSTRAINT "KickoffActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffActionItem" ADD CONSTRAINT "KickoffActionItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffHistory" ADD CONSTRAINT "KickoffHistory_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KickoffHistory" ADD CONSTRAINT "KickoffHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
