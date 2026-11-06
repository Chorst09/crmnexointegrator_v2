/**
 * Utilitários para gerente de contas da empresa
 */

export const accountManagerOptions = () => [];

export const resolveCompanyAccountManager = (company) => {
  return company?.accountManager || null;
};
