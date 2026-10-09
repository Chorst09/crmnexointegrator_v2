#!/usr/bin/env python3
import argparse
import datetime as dt
import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path
from zipfile import ZipFile

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}
REL_NS = {"pr": "http://schemas.openxmlformats.org/package/2006/relationships"}
SOURCE_NAME = "Base cliente Double.xlsx"
VALID_CLIENT_TYPES = {"Cliente Novo", "Cliente da Base"}
STAGE_MAP = {
    "lead / prospecao": "LEAD",
    "lead / prospeção": "LEAD",
    "apresentacao": "QUALIFICATION",
    "apresentação": "QUALIFICATION",
    "requisitos/projeto": "DIAGNOSIS",
    "negociacao": "NEGOTIATION",
    "negociação": "NEGOTIATION",
    "ganho/fechada": "WON",
    "perdida": "LOST",
}


def clean(value):
    if value is None:
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def norm(value):
    text = clean(value).lower()
    return (
        text.replace("ç", "c")
        .replace("ã", "a")
        .replace("á", "a")
        .replace("à", "a")
        .replace("â", "a")
        .replace("é", "e")
        .replace("ê", "e")
        .replace("í", "i")
        .replace("ó", "o")
        .replace("ô", "o")
        .replace("ú", "u")
    )


def sql(value):
    if value is None or value == "":
        return "NULL"
    return "'" + str(value).replace("'", "''") + "'"


def sql_date(value):
    return f"{sql(value)}::timestamp" if value else "NULL"


def sql_num(value):
    return "NULL" if value is None else str(value)


def cell_col(ref):
    letters = "".join(ch for ch in ref if ch.isalpha())
    out = 0
    for ch in letters:
        out = out * 26 + ord(ch.upper()) - 64
    return out


def cell_row(ref):
    match = re.search(r"\d+", ref)
    return int(match.group(0)) if match else 0


def excel_date(value):
    if value in (None, ""):
        return None
    text = clean(value)
    if text in {"0", "0.0", "0,0"}:
        return None
    try:
        serial = float(text)
        if 20000 <= serial <= 60000:
            return (dt.datetime(1899, 12, 30) + dt.timedelta(days=serial)).date().isoformat()
    except ValueError:
        pass
    match = re.match(r"^(\d{2})(\d{2})/(\d{4})$", text)
    if match:
        day, month, year = map(int, match.groups())
        try:
            return dt.date(year, month, day).isoformat()
        except ValueError:
            return None
    for fmt in ("%d/%m/%Y", "%d/%m/%y", "%Y-%m-%d"):
        try:
            return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def number(value):
    text = clean(value)
    if not text:
        return None
    try:
        return float(text.replace(".", "").replace(",", ".") if "," in text else text)
    except ValueError:
        return None


def integer(value):
    parsed = number(value)
    return int(parsed) if parsed is not None else None


def read_xlsx(path):
    rows = defaultdict(dict)
    with ZipFile(path) as archive:
        shared = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", NS):
                shared.append("".join(t.text or "" for t in item.findall(".//a:t", NS)))

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        rels = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("pr:Relationship", REL_NS)}
        sheet = workbook.find("a:sheets/a:sheet", NS)
        target = relmap[sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]]
        sheet_xml = ET.fromstring(archive.read("xl/" + target.lstrip("/")))

        for cell in sheet_xml.findall(".//a:sheetData/a:row/a:c", NS):
            ref = cell.attrib.get("r", "")
            typ = cell.attrib.get("t")
            value = ""
            if typ == "inlineStr":
                value = "".join(t.text or "" for t in cell.findall(".//a:t", NS))
            else:
                v = cell.find("a:v", NS)
                if v is not None and v.text is not None:
                    value = shared[int(v.text)] if typ == "s" else v.text
            if value != "":
                rows[cell_row(ref)][cell_col(ref)] = clean(value)
    return rows


def normalize_row(headers, values):
    mapped = {headers.get(col): values.get(col, "") for col in headers if headers.get(col)}
    shifted = False
    if (
        not values.get(1)
        and mapped.get("Tipo Cliente") not in VALID_CLIENT_TYPES
        and values.get(4) in VALID_CLIENT_TYPES
    ):
        shifted = True
        mapped = {
            "G. de Contas": values.get(2, ""),
            "Data Entrada": values.get(3, ""),
            "Tipo Cliente": values.get(4, ""),
            "Cliente": values.get(5, ""),
            "Segmento": values.get(6, ""),
            "Subsegmento": values.get(7, ""),
            "Contato": values.get(8, ""),
            "Fone": values.get(9, ""),
            "Email": values.get(10, ""),
            "Tipo Negociação": values.get(11, ""),
            "Entrada": values.get(12, ""),
            "Classificação do Projeto": values.get(13, ""),
            "Torre de Projeto": values.get(14, ""),
            "Detalhe Projeto": values.get(15, ""),
            "Fabricante": values.get(16, ""),
            "Nº Licenças": values.get(17, ""),
            "Funil": values.get(18, ""),
            "Responsável": values.get(19, ""),
            "Tempo Contrato": values.get(20, ""),
            "Valor Mensal": values.get(21, ""),
            "Valor Contrato": values.get(22, ""),
            "Taxa de Instalação": values.get(23, ""),
            "Termômetro mês vigente": values.get(25, ""),
            "Data Fechamento": values.get(26, ""),
            "Motivo de Perda": "",
            "Obs:": values.get(27, ""),
        }
    return mapped, shifted


def classify(row):
    raw_stage = row.get("Funil") or row.get("Responsável") or ""
    stage = STAGE_MAP.get(norm(raw_stage), "LEAD")
    if row.get("Motivo de Perda") and not re.fullmatch(r"0(?:\.0+)?", row.get("Motivo de Perda", "")):
        stage = "LOST"
    tipo = row.get("Tipo Cliente")
    project_client_type = "BASE_CLIENT" if tipo == "Cliente da Base" else "NEW_CLIENT"
    negotiation = row.get("Tipo Negociação")
    if norm(negotiation) == "renovacao":
        project_client_type = "RENEWAL"
    return stage, project_client_type


def build_records(path):
    rows = read_xlsx(path)
    headers = rows[1]
    records, warnings = [], []
    for row_number in sorted(r for r in rows if r != 1):
        row, shifted = normalize_row(headers, rows[row_number])
        company = clean(row.get("Cliente"))
        if not company:
            continue
        if clean(row.get("Tipo Cliente")) not in VALID_CLIENT_TYPES:
            warnings.append({"row": row_number, "level": "skip", "message": "Tipo Cliente inválido ou linha fora do layout", "cliente": company})
            continue

        lead_date = excel_date(row.get("Data Entrada"))
        close_date = excel_date(row.get("Data Fechamento"))
        if row.get("Data Entrada") and not lead_date:
            warnings.append({"row": row_number, "level": "warn", "message": "Data Entrada inválida; será usada a data atual", "value": row.get("Data Entrada")})
        if row.get("Data Fechamento") and clean(row.get("Data Fechamento")) not in {"0", "0.0", "0,0"} and not close_date:
            warnings.append({"row": row_number, "level": "warn", "message": "Data Fechamento inválida; será ignorada", "value": row.get("Data Fechamento")})

        stage, project_client_type = classify(row)
        monthly = number(row.get("Valor Mensal"))
        contract_value = number(row.get("Valor Contrato"))
        install = number(row.get("Taxa de Instalação"))
        months = integer(row.get("Tempo Contrato"))
        probability_raw = number(row.get("Termômetro mês vigente"))
        probability = int(round(probability_raw * 100)) if probability_raw is not None and probability_raw <= 1 else None
        if probability is None:
            probability = {"LEAD": 15, "QUALIFICATION": 30, "DIAGNOSIS": 45, "NEGOTIATION": 70, "WON": 100, "LOST": 0}.get(stage, 50)
        value = contract_value if contract_value is not None and contract_value > 0 else (monthly or 0) * (months or 0) + (install or 0)

        records.append({
            "row": row_number,
            "shifted": shifted,
            "accountManagerName": clean(row.get("G. de Contas")),
            "leadEntryDate": lead_date,
            "clientTypeLabel": clean(row.get("Tipo Cliente")),
            "companyName": company,
            "segment": clean(row.get("Segmento")),
            "subsegment": clean(row.get("Subsegmento")),
            "contactName": clean(row.get("Contato")),
            "contactPhone": clean(row.get("Fone")),
            "contactEmail": clean(row.get("Email")),
            "negotiationType": clean(row.get("Tipo Negociação")),
            "leadSourceDetail": clean(row.get("Entrada")),
            "projectClassification": clean(row.get("Classificação do Projeto")),
            "projectTower": clean(row.get("Torre de Projeto")),
            "projectDetail": clean(row.get("Detalhe Projeto")),
            "manufacturer": clean(row.get("Fabricante")),
            "licenseCount": integer(row.get("Nº Licenças")),
            "stage": stage,
            "responsibleArea": clean(row.get("Responsável")),
            "contractMonths": months,
            "monthlyValue": monthly,
            "value": value,
            "installationFee": install,
            "probability": max(0, min(100, probability)),
            "expectedCloseDate": close_date if stage not in ("WON", "LOST") else None,
            "actualCloseDate": close_date if stage in ("WON", "LOST") else None,
            "customerTurnDate": close_date if stage == "WON" else None,
            "exitDate": close_date if stage == "LOST" else None,
            "lossReason": clean(row.get("Motivo de Perda")) if stage == "LOST" else "",
            "notes": clean(row.get("Obs:")),
            "projectClientType": project_client_type,
        })
    return records, warnings


def title_for(record):
    detail = record["projectDetail"] or record["projectTower"] or record["negotiationType"] or "Oportunidade"
    return f"{record['companyName']} - {detail}"


def parse_owner_email_map(value):
    mapping = {}
    for item in value or []:
        if "=" not in item:
            raise ValueError(f"Mapeamento inválido: {item}. Use Nome=email.")
        key, email = item.split("=", 1)
        mapping[clean(key)] = clean(email).lower()
    return mapping


def generate_sql(records, tenant_company_id=None, owner_id=None, strict_owners=False, owner_email_map=None, default_owner_email=None):
    lines = [
        "BEGIN;",
        'CREATE EXTENSION IF NOT EXISTS "pgcrypto";',
    ]
    tenant_expr = sql(tenant_company_id) if tenant_company_id else '(SELECT CASE WHEN COUNT(*) = 1 THEN MAX("id") ELSE NULL END FROM "TenantCompany")'
    owner_expr = sql(owner_id) if owner_id else "NULL"
    owner_email_map = owner_email_map or {}
    for record in records:
        mapped_owner_email = owner_email_map.get(record["accountManagerName"]) or (clean(default_owner_email).lower() if not record["accountManagerName"] else "")
        title = title_for(record)
        description_bits = [
            f"Importado da linha {record['row']} da base Double.",
            f"Área responsável original: {record['responsibleArea']}" if record["responsibleArea"] else "",
        ]
        description = " ".join(part for part in description_bits if part)
        owner_fallback_sql = "" if strict_owners else """  IF v_owner IS NULL THEN
    SELECT "id" INTO v_owner
    FROM "User"
    WHERE "role"::text IN ('SELLER', 'ADMIN', 'MASTER', 'USER')
      AND (v_tenant IS NULL OR "tenantCompanyId" IS NULL OR "tenantCompanyId" = v_tenant)
    ORDER BY "createdAt"
    LIMIT 1;
  END IF;

"""
        lines.append(f"""
DO $$
DECLARE
  v_tenant TEXT := {tenant_expr};
  v_owner TEXT := {owner_expr};
  v_company TEXT;
  v_opportunity TEXT;
  v_sequence INTEGER;
  v_number TEXT;
BEGIN
  IF v_owner IS NULL AND {sql(mapped_owner_email)} IS NOT NULL THEN
    SELECT "id" INTO v_owner
    FROM "User"
    WHERE lower("email") = lower({sql(mapped_owner_email)})
      AND (v_tenant IS NULL OR "tenantCompanyId" IS NULL OR "tenantCompanyId" = v_tenant)
    ORDER BY "createdAt"
    LIMIT 1;
  END IF;

  IF v_owner IS NULL AND {sql(record['accountManagerName'])} IS NOT NULL THEN
    SELECT "id" INTO v_owner
    FROM "User"
    WHERE ({sql(record['accountManagerName'])} IS NULL
      OR lower("name") = lower({sql(record['accountManagerName'])})
      OR lower("name") LIKE lower({sql(record['accountManagerName'])}) || '%'
      OR lower({sql(record['accountManagerName'])}) LIKE lower("name") || '%')
      AND (v_tenant IS NULL OR "tenantCompanyId" IS NULL OR "tenantCompanyId" = v_tenant)
    ORDER BY CASE
      WHEN lower("name") = lower({sql(record['accountManagerName'])}) THEN 0
      WHEN lower("name") LIKE lower({sql(record['accountManagerName'])}) || '%' THEN 1
      ELSE 2
    END, "createdAt"
    LIMIT 1;
  END IF;

{owner_fallback_sql}
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Linha {record['row']} sem usuário responsável correspondente para gerente "%".', {sql(record['accountManagerName'] or '(vazio)')};
  END IF;

  SELECT "id" INTO v_company
  FROM "Company"
  WHERE lower(trim("name")) = lower(trim({sql(record['companyName'])}))
    AND "clientType" = 'B2B'
    AND (v_tenant IS NULL OR "tenantCompanyId" IS NULL OR "tenantCompanyId" = v_tenant)
  ORDER BY "createdAt"
  LIMIT 1;

  IF v_company IS NULL THEN
    INSERT INTO "Company" (
      "id", "name", "segment", "subsegment", "clientType", "status", "leadScore",
      "leadEntryDate", "accountManagerName", "accessB2B", "accessB2G", "tenantCompanyId", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text, {sql(record['companyName'])}, {sql(record['segment'])}, {sql(record['subsegment'])},
      'B2B', {sql('ACTIVE' if record['stage'] == 'WON' or record['clientTypeLabel'] == 'Cliente da Base' else ('LEAD' if record['stage'] == 'LEAD' else 'PROSPECT'))},
      0, COALESCE({sql_date(record['leadEntryDate'])}, CURRENT_TIMESTAMP), {sql(record['accountManagerName'])},
      true, false, v_tenant, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    )
    RETURNING "id" INTO v_company;
  ELSE
    UPDATE "Company"
    SET
      "segment" = COALESCE(NULLIF({sql(record['segment'])}, ''), "segment"),
      "subsegment" = COALESCE(NULLIF({sql(record['subsegment'])}, ''), "subsegment"),
      "accountManagerName" = COALESCE(NULLIF({sql(record['accountManagerName'])}, ''), "accountManagerName"),
      "leadEntryDate" = LEAST("leadEntryDate", COALESCE({sql_date(record['leadEntryDate'])}, "leadEntryDate")),
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_company;
  END IF;

  IF ({sql(record['contactName'])} IS NOT NULL OR {sql(record['contactEmail'])} IS NOT NULL OR {sql(record['contactPhone'])} IS NOT NULL) THEN
    IF NOT EXISTS (
      SELECT 1 FROM "Contact"
      WHERE "companyId" = v_company
        AND (
          ({sql(record['contactEmail'])} IS NOT NULL AND lower(COALESCE("email", '')) = lower({sql(record['contactEmail'])}))
          OR ({sql(record['contactPhone'])} IS NOT NULL AND COALESCE("phone", '') = {sql(record['contactPhone'])})
          OR ({sql(record['contactName'])} IS NOT NULL AND lower("name") = lower({sql(record['contactName'])}))
        )
    ) THEN
      INSERT INTO "Contact" ("id", "name", "email", "phone", "isPrimary", "companyId", "createdAt")
      VALUES (gen_random_uuid()::text, COALESCE(NULLIF({sql(record['contactName'])}, ''), 'Contato importado'), {sql(record['contactEmail'])}, {sql(record['contactPhone'])}, true, v_company, CURRENT_TIMESTAMP);
    END IF;
  END IF;

  SELECT "id" INTO v_opportunity
  FROM "Opportunity"
  WHERE "importSource" = {sql(SOURCE_NAME)} AND "importSourceRow" = {record['row']}
  LIMIT 1;

  SELECT COALESCE(MAX((substring("number" from ('^B2B-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-([0-9]+)$')))::int), 0) + 1
    INTO v_sequence
  FROM "Opportunity"
  WHERE "number" ~ ('^B2B-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-[0-9]+$');

  v_number := 'B2B-' || EXTRACT(YEAR FROM CURRENT_DATE)::int || '-' || lpad(v_sequence::text, 5, '0');

  IF v_opportunity IS NULL THEN
    INSERT INTO "Opportunity" (
      "id", "number", "title", "projectName", "projectClientType", "negotiationType", "projectClassification",
      "projectTower", "projectDetail", "manufacturer", "licenseCount", "contractMonths", "monthlyValue",
      "installationFee", "leadSourceDetail", "description", "value", "probability", "stage", "source",
      "leadEntryDate", "expectedCloseDate", "actualCloseDate", "customerTurnDate", "exitDate", "lossReason",
      "notes", "contactName", "contactFullName", "contactEmail", "contactPhone", "companyId", "ownerId",
      "tenantCompanyId", "importSource", "importSourceRow", "createdAt", "updatedAt"
    )
    VALUES (
      gen_random_uuid()::text, v_number, {sql(title)}, {sql(record['projectDetail'] or record['projectTower'] or title)}, {sql(record['projectClientType'])},
      {sql(record['negotiationType'])}, {sql(record['projectClassification'])}, {sql(record['projectTower'])}, {sql(record['projectDetail'])},
      {sql(record['manufacturer'])}, {sql_num(record['licenseCount'])}, {sql_num(record['contractMonths'])}, {sql_num(record['monthlyValue'])},
      {sql_num(record['installationFee'])}, {sql(record['leadSourceDetail'])}, {sql(description)}, {sql_num(record['value'])}, {record['probability']},
      {sql(record['stage'])}::"Stage", 'MANUAL'::"LeadSource", COALESCE({sql_date(record['leadEntryDate'])}, CURRENT_TIMESTAMP),
      {sql_date(record['expectedCloseDate'])}, {sql_date(record['actualCloseDate'])}, {sql_date(record['customerTurnDate'])},
      {sql_date(record['exitDate'])}, {sql(record['lossReason'])}, {sql(record['notes'])}, {sql(record['contactName'])},
      {sql(record['contactName'])}, {sql(record['contactEmail'])}, {sql(record['contactPhone'])}, v_company, v_owner, v_tenant,
      {sql(SOURCE_NAME)}, {record['row']}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );
  ELSE
    UPDATE "Opportunity"
    SET
      "number" = COALESCE("number", v_number),
      "title" = {sql(title)},
      "projectName" = {sql(record['projectDetail'] or record['projectTower'] or title)},
      "projectClientType" = {sql(record['projectClientType'])},
      "negotiationType" = {sql(record['negotiationType'])},
      "projectClassification" = {sql(record['projectClassification'])},
      "projectTower" = {sql(record['projectTower'])},
      "projectDetail" = {sql(record['projectDetail'])},
      "manufacturer" = {sql(record['manufacturer'])},
      "licenseCount" = {sql_num(record['licenseCount'])},
      "contractMonths" = {sql_num(record['contractMonths'])},
      "monthlyValue" = {sql_num(record['monthlyValue'])},
      "installationFee" = {sql_num(record['installationFee'])},
      "leadSourceDetail" = {sql(record['leadSourceDetail'])},
      "value" = {sql_num(record['value'])},
      "probability" = {record['probability']},
      "stage" = {sql(record['stage'])}::"Stage",
      "leadEntryDate" = COALESCE({sql_date(record['leadEntryDate'])}, "leadEntryDate"),
      "expectedCloseDate" = {sql_date(record['expectedCloseDate'])},
      "actualCloseDate" = {sql_date(record['actualCloseDate'])},
      "customerTurnDate" = {sql_date(record['customerTurnDate'])},
      "exitDate" = {sql_date(record['exitDate'])},
      "lossReason" = {sql(record['lossReason'])},
      "notes" = {sql(record['notes'])},
      "contactName" = {sql(record['contactName'])},
      "contactFullName" = {sql(record['contactName'])},
      "contactEmail" = {sql(record['contactEmail'])},
      "contactPhone" = {sql(record['contactPhone'])},
      "companyId" = v_company,
      "ownerId" = v_owner,
      "tenantCompanyId" = v_tenant,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = v_opportunity;
  END IF;
END $$;
""")
    lines.append("COMMIT;")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Importa a Base cliente Double para Clientes/Oportunidades B2B.")
    parser.add_argument("xlsx", type=Path)
    parser.add_argument("--sql-out", type=Path, help="Gera SQL idempotente para execução via psql.")
    parser.add_argument("--summary-out", type=Path, help="Salva o resumo em JSON.")
    parser.add_argument("--tenant-company-id")
    parser.add_argument("--owner-id")
    parser.add_argument("--strict-owners", action="store_true", help="Falha a importação se o gerente da planilha não existir como usuário.")
    parser.add_argument("--owner-email-map", action="append", default=[], help="Mapeia gerente da planilha para e-mail do usuário. Ex: Silvana=silvana@empresa.com")
    parser.add_argument("--default-owner-email", help="E-mail do usuário para linhas sem gerente.")
    args = parser.parse_args()

    records, warnings = build_records(args.xlsx)
    summary = {
        "source": str(args.xlsx),
        "records": len(records),
        "uniqueCompanies": len({r["companyName"].strip().lower() for r in records}),
        "shiftedRowsFixed": sum(1 for r in records if r["shifted"]),
        "stages": Counter(r["stage"] for r in records),
        "clientTypes": Counter(r["projectClientType"] for r in records),
        "warnings": warnings[:50],
        "warningCount": len(warnings),
    }

    printable = dict(summary)
    printable["stages"] = dict(printable["stages"])
    printable["clientTypes"] = dict(printable["clientTypes"])
    print(json.dumps(printable, ensure_ascii=False, indent=2))

    if args.summary_out:
        args.summary_out.write_text(json.dumps(printable, ensure_ascii=False, indent=2), encoding="utf-8")
    owner_email_map = parse_owner_email_map(args.owner_email_map)
    if args.sql_out:
        args.sql_out.write_text(
            generate_sql(
                records,
                args.tenant_company_id,
                args.owner_id,
                args.strict_owners,
                owner_email_map,
                args.default_owner_email,
            ),
            encoding="utf-8",
        )
        print(f"SQL gerado em {args.sql_out}")


if __name__ == "__main__":
    main()
