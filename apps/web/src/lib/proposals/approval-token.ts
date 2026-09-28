import jwt from 'jsonwebtoken';

export type ProposalApprovalAction = 'approve' | 'reject';

export interface ProposalApprovalTokenPayload {
  workflowId: string;
  proposalId: string;
  approverId: string;
  action: ProposalApprovalAction;
}

const getSecret = () => {
  const secret = process.env.PROPOSAL_APPROVAL_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('PROPOSAL_APPROVAL_TOKEN_SECRET ou NEXTAUTH_SECRET não configurado');
  }
  return secret;
};

const TOKEN_TTL = (process.env.PROPOSAL_APPROVAL_TOKEN_TTL || '72h') as jwt.SignOptions['expiresIn'];

export const signProposalApprovalToken = (payload: ProposalApprovalTokenPayload): string => {
  const secret = getSecret();
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
};

export const verifyProposalApprovalToken = (token: string): ProposalApprovalTokenPayload => {
  const secret = getSecret();
  return jwt.verify(token, secret) as ProposalApprovalTokenPayload;
};
