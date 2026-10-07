-- Tabela do módulo Simuladores/Calculadoras: propostas geradas pelas calculadoras.
-- Espelha o model SimulatorProposal de backend/prisma/schema.prisma.
-- Idempotente: seguro rodar em bases onde a tabela já existe.
CREATE TABLE IF NOT EXISTS "SimulatorProposal" (
    "id"                  TEXT NOT NULL,
    "baseId"              TEXT NOT NULL,
    "version"             INTEGER NOT NULL DEFAULT 1,
    "title"               TEXT NOT NULL,
    "client"              TEXT NOT NULL,
    "type"                TEXT NOT NULL,
    "value"               DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status"              TEXT NOT NULL DEFAULT 'Rascunho',
    "forecastTemperature" DOUBLE PRECISION,
    "metadata"            JSONB,
    "createdBy"           TEXT NOT NULL,
    "accountManager"      TEXT,
    "distributorId"       TEXT,
    "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SimulatorProposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SimulatorProposal_baseId_idx"    ON "SimulatorProposal" ("baseId");
CREATE INDEX IF NOT EXISTS "SimulatorProposal_createdBy_idx" ON "SimulatorProposal" ("createdBy");
CREATE INDEX IF NOT EXISTS "SimulatorProposal_type_idx"      ON "SimulatorProposal" ("type");
