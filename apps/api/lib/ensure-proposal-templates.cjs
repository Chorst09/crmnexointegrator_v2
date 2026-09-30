const { prisma } = require('./prisma.cjs');
const {
  propostaComercialDouble,
  propostaTecnicaDouble
} = require('./proposal-template-presets.cjs');


const LEGACY_COVER_BACKGROUNDS = new Set([
  'linear-gradient(135deg, #0B1220 0%, #1E40AF 55%, #0EA5E9 120%)',
  'linear-gradient(135deg, #020617 0%, #111827 55%, #1E40AF 120%)'
]);

const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

const mergeSections = (existingSections, desiredSections) => {
  const existing = Array.isArray(existingSections) ? existingSections : [];
  const desired = Array.isArray(desiredSections) ? desiredSections : [];

  const byId = new Map(existing.filter(Boolean).map((s) => [s.id, s]));
  const used = new Set();

  const merged = desired
    .filter(Boolean)
    .map((presetSection) => {
      const current = byId.get(presetSection.id);
      used.add(presetSection.id);

      if (!current) return presetSection;

      const next = { ...current };

      // Preserve user's title/order/enabled, but add missing layout/background/content.
      const optionalFields = [
        'layout',
        'pageBackground',
        'body',
        'notes',
        'placeholders',
        'highlights',
        'bullets'
      ];

      for (const field of optionalFields) {
        const presetValue = presetSection[field];
        const currentValue = current[field];

        if (Array.isArray(presetValue)) {
          if (!Array.isArray(currentValue) || currentValue.length === 0) {
            next[field] = presetValue;
          }
          continue;
        }

        if (!isBlank(presetValue) && isBlank(currentValue)) {
          next[field] = presetValue;
        }
      }

      return next;
    });

  // Keep custom sections not present in the preset.
  for (const section of existing) {
    if (!section?.id) continue;
    if (used.has(section.id)) continue;
    // Legacy presets used to include cover/index as "sections". Keep these out of the user list.
    if (section.id === 'cover' || section.id === 'index') continue;
    merged.push(section);
  }

  return merged;
};

const ensureOne = async (template) => {
  const existing = await prisma.proposalTemplate.findFirst({
    where: { name: template.name }
  });

  if (existing) {
    const updateData = {};

    // Keep built-in templates active (they can be edited, but should not disappear).
    if (template.isActive === true && existing.isActive === false) {
      updateData.isActive = true;
    }

    // Keep preset type in sync (prevents technical preset being classified as commercial).
    if (template.type && existing.type !== template.type) {
      updateData.type = template.type;
    }

    // Only force a default if none exists yet.
    if (template.isDefault && !existing.isDefault) {
      updateData.isDefault = true;
    }

    const existingCover = (existing.coverBackground || '').trim();
    const legacyCover = LEGACY_COVER_BACKGROUNDS.has(existingCover) || isBlank(existingCover);

    // Upgrade legacy preset fields to the current preset, without clobbering user edits.
    if (legacyCover && !isBlank(template.coverBackground)) {
      updateData.coverBackground = template.coverBackground;
    }

    if (legacyCover && existing.coverEnabled !== template.coverEnabled) {
      updateData.coverEnabled = template.coverEnabled;
    }

    if (legacyCover && existing.coverTitle !== template.coverTitle) {
      updateData.coverTitle = template.coverTitle;
    }

    if (legacyCover && existing.coverSubtitle !== template.coverSubtitle) {
      updateData.coverSubtitle = template.coverSubtitle;
    }

    if (legacyCover && existing.coverLogo !== template.coverLogo) {
      updateData.coverLogo = template.coverLogo;
    }

    if (legacyCover && existing.headerEnabled !== template.headerEnabled) {
      updateData.headerEnabled = template.headerEnabled;
    }

    if (legacyCover && existing.footerEnabled !== template.footerEnabled) {
      updateData.footerEnabled = template.footerEnabled;
    }

    if (legacyCover && existing.headerText !== template.headerText) {
      updateData.headerText = template.headerText;
    }

    if (legacyCover && existing.footerText !== template.footerText) {
      updateData.footerText = template.footerText;
    }

    // Sections: merge to add missing layout/background/content, and new preset sections.
    const mergedSections = mergeSections(existing.sections, template.sections);
    const hasSectionDiff = JSON.stringify(existing.sections || null) !== JSON.stringify(mergedSections || null);
    if (hasSectionDiff) {
      updateData.sections = mergedSections;
    }

    // If nothing to update, return.
    if (Object.keys(updateData).length === 0) {
      return { created: false, updated: false, id: existing.id };
    }

    const updated = await prisma.proposalTemplate.update({
      where: { id: existing.id },
      data: updateData
    });

    return { created: false, updated: true, id: updated.id };
  }

  const created = await prisma.proposalTemplate.create({
    data: template
  });

  return { created: true, updated: false, id: created.id };
};

const ensureProposalTemplates = async () => {
  const results = [];

  try {
    // Defaults are per type (commercial vs technical).
    const [hasDefaultCommercial, hasDefaultTechnical] = await Promise.all([
      prisma.proposalTemplate.findFirst({
        where: { isDefault: true, type: 'COMMERCIAL' }
      }),
      prisma.proposalTemplate.findFirst({
        where: { isDefault: true, type: 'TECHNICAL' }
      })
    ]);

    // Clone to avoid mutating presets.
    const commercial = { ...propostaComercialDouble };
    if (!hasDefaultCommercial) {
      commercial.isDefault = true;
    }

    results.push({
      name: commercial.name,
      ...(await ensureOne(commercial))
    });

    const technical = { ...propostaTecnicaDouble };
    if (!hasDefaultTechnical) {
      technical.isDefault = true;
    }

    results.push({
      name: technical.name,
      ...(await ensureOne(technical))
    });

    return results;
  } finally {
    // Avoid holding an extra connection pool just for bootstrap.
    await prisma.$disconnect().catch(() => {});
  }
};

module.exports = {
  ensureProposalTemplates
};
