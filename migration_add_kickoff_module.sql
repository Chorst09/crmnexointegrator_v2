-- Migration: Add Kickoff Management Module (Gestão de Kickoff)
-- Description: Tabelas para gerenciar o ciclo de reuniões estratégicas do projeto,
--              da fase comercial até a entrega e execução.
-- Date: 2026-08-03
-- Observação: requer extensão pgcrypto (gen_random_uuid). Aplicar antes do Prisma db push
-- ou executar manualmente no banco PostgreSQL.

-- ===== ENUMS =====

DO $$
BEGIN
  CREATE TYPE "KickoffPhase" AS ENUM (
    'ENTENDIMENTO_OPORTUNIDADE',
    'APRESENTACAO_PROPOSTA',
    'FECHAMENTO_PROJETO',
    'ALINHAMENTO_INTERNO',
    'ALINHAMENTO_EXTERNO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KickoffStatus" AS ENUM (
    'AGENDADA',
    'REALIZADA',
    'CANCELADA',
    'REAGENDADA'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KickoffPlatform" AS ENUM (
    'MEET',
    'TEAMS',
    'ZOOM',
    'PRESENCIAL',
    'TELEFONE',
    'OUTRO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KickoffParticipantRole" AS ENUM (
    'ORGANIZADOR',
    'INTERNO',
    'EXTERNO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KickoffParticipantStatus" AS ENUM (
    'CONVIDADO',
    'CONFIRMADO',
    'RECUSADO',
    'PRESENTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "KickoffActionStatus" AS ENUM (
    'PENDENTE',
    'EM_ANDAMENTO',
    'CONCLUIDO',
    'CANCELADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== TABELAS =====

-- Templates de pauta pré-configurados por fase
CREATE TABLE IF NOT EXISTS "KickoffTemplate" (
    "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "phase"       "KickoffPhase" NOT NULL,
    "isDefault"   BOOLEAN NOT NULL DEFAULT false,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "agenda"      JSONB NOT NULL DEFAULT '[]'::jsonb,
    "checklist"   JSONB NOT NULL DEFAULT '[]'::jsonb,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "KickoffTemplate_phase_idx" ON "KickoffTemplate"("phase");
CREATE INDEX IF NOT EXISTS "KickoffTemplate_isActive_idx" ON "KickoffTemplate"("isActive");

-- Reuniões de kickoff
CREATE TABLE IF NOT EXISTS "KickoffMeeting" (
    "id"              TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "number"          TEXT NOT NULL UNIQUE,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "phase"           "KickoffPhase" NOT NULL,
    "status"          "KickoffStatus" NOT NULL DEFAULT 'AGENDADA',
    "platform"        "KickoffPlatform" NOT NULL DEFAULT 'MEET',
    "meetingLink"     TEXT,
    "scheduledDate"   TIMESTAMP(3) NOT NULL,
    "startTime"       TEXT,
    "endTime"         TEXT,
    "meetingNotes"    TEXT,
    "actualStartTime" TIMESTAMP(3),
    "actualEndTime"   TIMESTAMP(3),
    "opportunityId"   TEXT NOT NULL,
    "companyId"       TEXT NOT NULL,
    "ownerId"         TEXT NOT NULL,
    "templateId"      TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KickoffMeeting_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KickoffMeeting_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KickoffMeeting_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "KickoffMeeting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "KickoffTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KickoffMeeting_opportunityId_idx" ON "KickoffMeeting"("opportunityId");
CREATE INDEX IF NOT EXISTS "KickoffMeeting_companyId_idx" ON "KickoffMeeting"("companyId");
CREATE INDEX IF NOT EXISTS "KickoffMeeting_phase_status_idx" ON "KickoffMeeting"("phase", "status");
CREATE INDEX IF NOT EXISTS "KickoffMeeting_scheduledDate_idx" ON "KickoffMeeting"("scheduledDate");

-- Participantes (internos = usuários do CRM, externos = contatos do cliente)
CREATE TABLE IF NOT EXISTS "KickoffParticipant" (
    "id"        TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "meetingId" TEXT NOT NULL,
    "userId"    TEXT,
    "contactId" TEXT,
    "role"      "KickoffParticipantRole" NOT NULL DEFAULT 'INTERNO',
    "status"    "KickoffParticipantStatus" NOT NULL DEFAULT 'CONVIDADO',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KickoffParticipant_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KickoffParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "KickoffParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KickoffParticipant_meetingId_idx" ON "KickoffParticipant"("meetingId");
CREATE INDEX IF NOT EXISTS "KickoffParticipant_userId_idx" ON "KickoffParticipant"("userId");
CREATE INDEX IF NOT EXISTS "KickoffParticipant_contactId_idx" ON "KickoffParticipant"("contactId");

-- Itens de pauta da reunião
CREATE TABLE IF NOT EXISTS "KickoffAgendaItem" (
    "id"              TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "meetingId"       TEXT NOT NULL,
    "title"           TEXT NOT NULL,
    "description"     TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "order"           INTEGER NOT NULL DEFAULT 0,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KickoffAgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KickoffAgendaItem_meetingId_idx" ON "KickoffAgendaItem"("meetingId");

-- Checklist de verificação da reunião
CREATE TABLE IF NOT EXISTS "KickoffChecklistItem" (
    "id"            TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "meetingId"     TEXT NOT NULL,
    "title"         TEXT NOT NULL,
    "isCompleted"   BOOLEAN NOT NULL DEFAULT false,
    "completedAt"   TIMESTAMP(3),
    "completedById" TEXT,
    "order"         INTEGER NOT NULL DEFAULT 0,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KickoffChecklistItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KickoffChecklistItem_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KickoffChecklistItem_meetingId_idx" ON "KickoffChecklistItem"("meetingId");

-- Planos de ação / tarefas pós-reunião (integram-se ao módulo de tarefas via taskId)
CREATE TABLE IF NOT EXISTS "KickoffActionItem" (
    "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "meetingId"   TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "status"      "KickoffActionStatus" NOT NULL DEFAULT 'PENDENTE',
    "priority"    "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate"     TIMESTAMP(3),
    "assigneeId"  TEXT,
    "taskId"      TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KickoffActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KickoffActionItem_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KickoffActionItem_meetingId_idx" ON "KickoffActionItem"("meetingId");
CREATE INDEX IF NOT EXISTS "KickoffActionItem_assigneeId_idx" ON "KickoffActionItem"("assigneeId");
CREATE INDEX IF NOT EXISTS "KickoffActionItem_status_dueDate_idx" ON "KickoffActionItem"("status", "dueDate");

-- Histórico da reunião (timeline centralizada)
CREATE TABLE IF NOT EXISTS "KickoffHistory" (
    "id"          TEXT NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "meetingId"   TEXT NOT NULL,
    "eventType"   TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "description" TEXT,
    "data"        JSONB,
    "userId"      TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KickoffHistory_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "KickoffMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KickoffHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "KickoffHistory_meetingId_idx" ON "KickoffHistory"("meetingId");
CREATE INDEX IF NOT EXISTS "KickoffHistory_meetingId_createdAt_idx" ON "KickoffHistory"("meetingId", "createdAt");
