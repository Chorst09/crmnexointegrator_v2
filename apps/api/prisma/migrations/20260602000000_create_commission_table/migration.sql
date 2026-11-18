CREATE TABLE "Commission" (
  "id"               TEXT      NOT NULL PRIMARY KEY,
  "amount"           DOUBLE PRECISION NOT NULL,
  "calculationBase"  DOUBLE PRECISION,
  "projectType"      TEXT      NOT NULL DEFAULT 'SINGLE',
  "projectMonths"    INTEGER,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT now()
);
