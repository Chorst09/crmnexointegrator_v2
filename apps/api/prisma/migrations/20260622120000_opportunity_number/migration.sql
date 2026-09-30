ALTER TABLE "Opportunity"
  ADD COLUMN IF NOT EXISTS "number" TEXT;

WITH candidates AS (
  SELECT
    o."id",
    CASE
      WHEN o."b2gStage" IS NOT NULL THEN 'B2G'
      WHEN UPPER(COALESCE(o."projectClientType", '')) = 'B2G' THEN 'B2G'
      WHEN UPPER(COALESCE(c."clientType"::TEXT, '')) = 'B2G' THEN 'B2G'
      WHEN COALESCE(c."segment", '') ~* '(B2G|GOVERNO|GOV|LICIT)' THEN 'B2G'
      ELSE 'B2B'
    END AS "type",
    EXTRACT(YEAR FROM o."createdAt")::INT AS "year"
  FROM "Opportunity" o
  LEFT JOIN "Company" c ON c."id" = o."companyId"
  WHERE o."number" IS NULL
),
existing_sequences AS (
  SELECT
    SPLIT_PART("number", '-', 1) AS "type",
    SPLIT_PART("number", '-', 2)::INT AS "year",
    MAX(SUBSTRING("number" FROM '^[A-Z0-9]+-[0-9]{4}-([0-9]+)$')::INT) AS "maxSequence"
  FROM "Opportunity"
  WHERE "number" ~ '^[A-Z0-9]+-[0-9]{4}-[0-9]+$'
  GROUP BY 1, 2
),
numbered AS (
  SELECT
    candidates."id",
    candidates."type",
    candidates."year",
    COALESCE(existing_sequences."maxSequence", 0)
      + ROW_NUMBER() OVER (
        PARTITION BY candidates."type", candidates."year"
        ORDER BY candidates."year", candidates."id"
      ) AS "sequence"
  FROM candidates
  LEFT JOIN existing_sequences
    ON existing_sequences."type" = candidates."type"
   AND existing_sequences."year" = candidates."year"
)
UPDATE "Opportunity" o
SET "number" = numbered."type"
  || '-'
  || numbered."year"
  || '-'
  || LPAD(numbered."sequence"::TEXT, 5, '0')
FROM numbered
WHERE o."id" = numbered."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Opportunity_number_key"
  ON "Opportunity"("number");
