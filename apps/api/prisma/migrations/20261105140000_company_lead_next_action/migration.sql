ALTER TABLE "Company"
  ADD COLUMN IF NOT EXISTS "leadNextAction" TEXT,
  ADD COLUMN IF NOT EXISTS "leadNextActionAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "leadReminderMinutes" INTEGER NOT NULL DEFAULT 15;
CREATE TABLE IF NOT EXISTS "LeadCalendarConnection" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "credentials" TEXT NOT NULL, "lastError" TEXT, "lastSyncedAt" TIMESTAMP(3), "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("userId", "provider")
);
CREATE TABLE IF NOT EXISTS "LeadCalendarOAuthState" (
  "hash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL,
  "verifier" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE TABLE IF NOT EXISTS "LeadCalendarEvent" (
  "id" TEXT PRIMARY KEY, "companyId" TEXT NOT NULL, "userId" TEXT NOT NULL,
  "provider" TEXT NOT NULL, "eventId" TEXT NOT NULL, "version" TEXT NOT NULL,
  "reminderVersion" TEXT, "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE ("companyId", "userId", "provider")
);
