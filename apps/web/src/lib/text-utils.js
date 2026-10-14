// Shared formatting for commercial proposals and opportunity conversion.
export const normalizeText = value => String(value ?? '').trim().replace(/\s+/g, ' ');

export const normalizeComparable = value => normalizeText(value).toLowerCase();
