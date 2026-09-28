-- Migration: Add Google Calendar integration for Kickoff module
-- Run this against your database

-- Create GoogleToken table
CREATE TABLE IF NOT EXISTS "GoogleToken" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId" TEXT NOT NULL UNIQUE,
  "accessToken" TEXT NOT NULL,
  "refreshToken" TEXT NOT NULL,
  scope TEXT NOT NULL,
  "expiryDate" TIMESTAMP(3) NOT NULL,
  "calendarId" TEXT NOT NULL DEFAULT 'primary',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GoogleToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "GoogleToken_userId_idx" ON "GoogleToken"("userId");

-- Add Google Calendar fields to KickoffMeeting
ALTER TABLE "KickoffMeeting" ADD COLUMN IF NOT EXISTS "googleCalendarEventId" TEXT;
ALTER TABLE "KickoffMeeting" ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT;
