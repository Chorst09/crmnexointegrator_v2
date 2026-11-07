const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

// A real, independent copy survives removal of the opportunity attachment.
async function prepareContractCopy(file, directory) {
  await fs.mkdir(directory, { recursive: true });
  const filename = randomUUID() + path.extname(file.originalname).toLowerCase();
  const target = path.join(directory, filename);
  await fs.copyFile(file.path, target, fs.constants.COPYFILE_EXCL);
  return { filename, path: target, originalName: file.originalname, mimeType: file.mimetype, size: file.size };
}
async function createCopiedContract(db, document, opportunity, copy) {
  return db.contract.create({ data: {
    number: `ANEXO-${document.id}`, title: document.originalName,
    description: 'Cópia de contrato anexado à oportunidade. Complete as datas e ative o contrato para agendar o aviso de vencimento.',
    companyId: opportunity.companyId, opportunityId: opportunity.id,
    sourceDocumentId: document.id,
    sourceOpportunityLabel: [opportunity.number, opportunity.projectName || opportunity.title].filter(Boolean).join(' — '),
    status: 'DRAFT', value: 0, startDate: null, endDate: null, expirationAlert: true,
    attachments: { create: copy }
  } });
}
module.exports = { prepareContractCopy, createCopiedContract };
