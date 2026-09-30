import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { buildApiUrl, getCRMAuthHeaders } from '@/config/api';

type SimulatorProposal = Record<string, any>;

const normalizeText = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeComparable = (value: unknown) => normalizeText(value).toLowerCase();

const extractClientName = (proposal: SimulatorProposal) =>
  normalizeText(
    typeof proposal.client === 'string'
      ? proposal.client
      : proposal.client?.name || proposal.clientData?.name || proposal.clientName
  );

const extractProjectName = (proposal: SimulatorProposal, clientName: string) =>
  normalizeText(
    proposal.projectName ||
      proposal.name ||
      proposal.title ||
      proposal.client?.projectName ||
      proposal.clientData?.projectName ||
      `Projeto ${clientName}`
  );

const extractOpportunityValue = (proposal: SimulatorProposal) => {
  const value = Number(proposal.totalMonthly ?? proposal.value ?? proposal.totalPrice ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const extractContractMonths = (proposal: SimulatorProposal) => {
  const months = Number(
    proposal.contractPeriod ||
      proposal.contractTerm ||
      proposal.details?.contractTerm ||
      proposal.clientData?.contractTerm ||
      12
  );
  return [12, 24, 36, 48, 60].includes(months) ? months : 12;
};

const normalizeDateInput = (value: unknown) => {
  const raw = normalizeText(value);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;

  return date.toISOString().slice(0, 10);
};

const readCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

const parseErrorMessage = async (response: Response) => {
  const fallback = `Erro ${response.status} ao converter em oportunidade.`;
  try {
    const data = await response.json();
    return data?.error || data?.message || fallback;
  } catch {
    try {
      return (await response.text()) || fallback;
    } catch {
      return fallback;
    }
  }
};

interface ConvertToB2BOpportunityButtonProps {
  proposal: SimulatorProposal;
  label?: string;
}

export const ConvertToB2BOpportunityButton: React.FC<ConvertToB2BOpportunityButtonProps> = ({
  proposal,
  label = 'Converter em OP'
}) => {
  const navigate = useNavigate();
  const [isConverting, setIsConverting] = React.useState(false);

  const handleConvert = async () => {
    if (isConverting) return;

    const clientName = extractClientName(proposal);
    if (!clientName) {
      alert('Informe o cliente da proposta antes de converter em oportunidade.');
      return;
    }

    const currentUser = readCurrentUser();
    const ownerId = currentUser?.id || proposal.userId || proposal.createdBy;
    if (!ownerId) {
      alert('Não foi possível identificar o responsável pela oportunidade. Faça login novamente.');
      return;
    }

    setIsConverting(true);

    try {
      const headers = getCRMAuthHeaders();
      const proposalId = normalizeText(proposal.id || proposal.baseId || proposal.proposalNumber);
      const sourceMarker = proposalId ? `Proposta Simuladores: ${proposalId}` : 'Proposta Simuladores';

      if (proposalId) {
        const opportunitiesResponse = await fetch(buildApiUrl('/opportunities?clientType=B2B'), { headers });
        if (opportunitiesResponse.ok) {
          const opportunities = await opportunitiesResponse.json();
          const existingOpportunity = Array.isArray(opportunities)
            ? opportunities.find((item) => normalizeText(item?.notes).includes(sourceMarker))
            : null;

          if (existingOpportunity?.id) {
            navigate(`/oportunidades?clientType=B2B&opportunityId=${encodeURIComponent(existingOpportunity.id)}`);
            return;
          }
        }
      }

      const companiesResponse = await fetch(buildApiUrl('/companies?clientType=B2B'), { headers });
      if (!companiesResponse.ok) {
        throw new Error(await parseErrorMessage(companiesResponse));
      }

      const companies = await companiesResponse.json();
      const existingCompany = Array.isArray(companies)
        ? companies.find((item) => normalizeComparable(item?.name) === normalizeComparable(clientName))
        : null;

      let companyId = existingCompany?.id;
      if (!companyId) {
        const createCompanyResponse = await fetch(buildApiUrl('/companies?clientType=B2B'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: clientName,
            clientType: 'B2B',
            status: 'ACTIVE',
            segment: 'Simuladores',
            autoDistribute: false
          })
        });

        if (!createCompanyResponse.ok) {
          throw new Error(await parseErrorMessage(createCompanyResponse));
        }

        const createdCompany = await createCompanyResponse.json();
        companyId = createdCompany?.id;
      }

      if (!companyId) {
        throw new Error('Não foi possível localizar ou criar a empresa B2B.');
      }

      const projectName = extractProjectName(proposal, clientName);
      const value = extractOpportunityValue(proposal);
      const projectMonths = extractContractMonths(proposal);
      const productName = normalizeText(proposal.type || proposal.product || proposal.productType || 'Simuladores');
      const notes = [
        sourceMarker,
        `Cliente: ${clientName}`,
        `Produto: ${productName}`,
        proposal.status ? `Status da proposta: ${proposal.status}` : '',
        proposal.date ? `Data da proposta: ${proposal.date}` : ''
      ].filter(Boolean).join('\n');

      const createOpportunityResponse = await fetch(buildApiUrl('/opportunities?clientType=B2B'), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          clientType: 'B2B',
          title: projectName,
          projectName,
          projectClientType: proposal.isExistingClient ? 'BASE_CLIENT' : 'NEW_CLIENT',
          projectType: 'MONTHLY',
          projectMonths,
          description: `Oportunidade B2B criada a partir de orçamento salvo em Simuladores.\n${notes}`,
          value,
          probability: Number(proposal.forecastTemperature) || 50,
          stage: 'DIAGNOSIS',
          source: 'MANUAL',
          expectedCloseDate: normalizeDateInput(proposal.expiryDate),
          companyId,
          ownerId,
          notes
        })
      });

      if (!createOpportunityResponse.ok) {
        throw new Error(await parseErrorMessage(createOpportunityResponse));
      }

      const opportunity = await createOpportunityResponse.json();
      alert('Oportunidade B2B criada com sucesso.');
      navigate(`/oportunidades?clientType=B2B&opportunityId=${encodeURIComponent(opportunity.id)}`);
    } catch (error) {
      console.error('Erro ao converter proposta em oportunidade B2B:', error);
      alert(error instanceof Error ? error.message : 'Erro ao converter em oportunidade B2B.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleConvert}
      disabled={isConverting}
      className="border-emerald-600 text-emerald-300 hover:bg-emerald-700 hover:text-white"
    >
      {isConverting ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4 mr-2" />
      )}
      {isConverting ? 'Convertendo...' : label}
    </Button>
  );
};

export default ConvertToB2BOpportunityButton;
