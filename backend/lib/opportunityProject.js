export const PROJECT_CLIENT_TYPES = {
  NEW_CLIENT: 'NEW_CLIENT',
  BASE_CLIENT: 'BASE_CLIENT',
  RENEWAL: 'RENEWAL'
};

export const normalizeProjectClientType = (value) => {
  if (!value) return PROJECT_CLIENT_TYPES.NEW_CLIENT;
  const normalized = String(value).trim().toUpperCase();
  const allowed = Object.values(PROJECT_CLIENT_TYPES);
  return allowed.includes(normalized) ? normalized : PROJECT_CLIENT_TYPES.NEW_CLIENT;
};

export const normalizeProjectName = (value, fallback = 'Projeto sem nome') => {
  const normalized = String(value || '').trim();
  return normalized || fallback;
};
