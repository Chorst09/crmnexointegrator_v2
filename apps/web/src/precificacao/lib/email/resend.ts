import nodemailer from 'nodemailer';

interface SendResendEmailInput {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
}

interface SendResendEmailResult {
  success: boolean;
  status: number;
  body: string;
  fromUsed?: string;
}

const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Simuladores Double TI <noreply@chorstconsult.com.br>';
const FALLBACK_FROM = process.env.RESEND_FROM_EMAIL_FALLBACK;
const PREFERRED_DOMAIN = (process.env.RESEND_PREFERRED_DOMAIN || 'doubletelecom.com.br').trim().toLowerCase();
const FORCE_VERIFIED_DOMAIN = process.env.RESEND_FORCE_VERIFIED_DOMAIN === 'true';
const DEFAULT_REPLY_TO = process.env.RESEND_REPLY_TO || process.env.EMAIL_REPLY_TO;

const TESTING_RESTRICTION_PATTERNS = [
  'only send testing emails',
  'you can only send testing emails',
  'verify a domain at resend.com/domains',
];
const FROM_DOMAIN_ERROR_PATTERNS = [
  'from domain',
  'domain is not verified',
  'verify your domain',
  'invalid from',
  'invalid sender',
];
const SMTP_NOT_CONFIGURED_MESSAGE = 'SMTP não configurado';

const isTestingRestrictionError = (status: number, body: string): boolean => {
  if (status !== 403) return false;
  const normalizedBody = body.toLowerCase();
  return TESTING_RESTRICTION_PATTERNS.some((pattern) => normalizedBody.includes(pattern));
};

const extractDisplayName = (from: string): string => {
  const trimmed = from.trim();
  const match = trimmed.match(/^(.+?)\s*<[^>]+>$/);
  const name = (match?.[1] || trimmed).trim();
  return name.length > 0 ? name : 'Simuladores Double TI';
};

const extractEmailAddress = (value: string): string => {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim().toLowerCase();
};

const extractEmailDomain = (value: string): string | null => {
  const email = extractEmailAddress(value);
  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1) return null;
  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  return domain.length > 0 ? domain : null;
};

const htmlToText = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h\d>/gi, '\n')
    .replace(/<li>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const isFromDomainError = (status: number, body: string): boolean => {
  if (status < 400) return false;
  const normalizedBody = body.toLowerCase();
  return FROM_DOMAIN_ERROR_PATTERNS.some((pattern) => normalizedBody.includes(pattern));
};

const getVerifiedDomains = async (apiKey: string): Promise<string[] | null> => {
  try {
    const response = await fetch('https://api.resend.com/domains', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) return null;

    const payload = await response.json();
    const domains = Array.isArray(payload?.data) ? payload.data : [];
    const isVerifiedDomain = (domain: any) => {
      const status = typeof domain?.status === 'string' ? domain.status.toLowerCase() : '';
      const canSend = domain?.capabilities?.sending === 'enabled';
      return status === 'verified' && canSend && typeof domain?.name === 'string' && domain.name.trim().length > 0;
    };

    return domains
      .filter(isVerifiedDomain)
      .map((domain: any) => String(domain.name).trim().toLowerCase())
      .filter((domain: string) => domain.length > 0);
  } catch {
    return null;
  }
};

const pickPreferredDomain = (domains: string[], preferredDomain: string): string | null => {
  if (domains.length === 0) return null;
  const exactMatch = domains.find((domain) => domain === preferredDomain);
  if (exactMatch) return exactMatch;
  const suffixMatch = domains.find((domain) => domain.endsWith(`.${preferredDomain}`));
  if (suffixMatch) return suffixMatch;
  return domains[0] || null;
};

const resolveFromUsingVerifiedDomain = async (
  apiKey: string,
  currentFrom: string,
  options?: { forceVerified?: boolean }
): Promise<{ from: string; fallbackFrom?: string | null; currentDomainVerified: boolean }> => {
  const verifiedDomains = await getVerifiedDomains(apiKey);
  const currentDomain = extractEmailDomain(currentFrom);
  const currentDomainVerified =
    !!currentDomain && Array.isArray(verifiedDomains)
      ? verifiedDomains.includes(currentDomain)
      : false;

  if (!verifiedDomains || verifiedDomains.length === 0) {
    return { from: currentFrom, fallbackFrom: null, currentDomainVerified };
  }

  const preferredDomain = pickPreferredDomain(verifiedDomains, PREFERRED_DOMAIN);
  const displayName = extractDisplayName(currentFrom);
  const fallbackFrom = preferredDomain ? `${displayName} <noreply@${preferredDomain}>` : null;

  if (currentDomainVerified && !options?.forceVerified) {
    return { from: currentFrom, fallbackFrom, currentDomainVerified };
  }

  if (fallbackFrom) {
    return { from: fallbackFrom, fallbackFrom, currentDomainVerified };
  }

  return { from: currentFrom, fallbackFrom: null, currentDomainVerified };
};

const getSmtpConfig = () => {
  const host = process.env.SMTP_HOST;
  const portRaw = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user || null;
  if (!host || !portRaw || !user || !pass || !from) return null;

  const port = Number(portRaw);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  return { host, port, user, pass, from, secure };
};

const sendSmtpEmail = async (input: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  text?: string;
}): Promise<SendResendEmailResult | null> => {
  const smtpConfig = getSmtpConfig();
  if (!smtpConfig) {
    return null;
  }

  const fromToUse = smtpConfig.from || input.from;
  try {
    console.log('📧 Tentando enviar via SMTP...');
    const transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
    });

    const info = await transporter.sendMail({
      from: fromToUse,
      to: input.to.join(', '),
      cc: input.cc && input.cc.length > 0 ? input.cc.join(', ') : undefined,
      replyTo: input.replyTo,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    console.log('✅ Email enviado via SMTP:', info.messageId || 'ok');
    return {
      success: true,
      status: 200,
      body: `SMTP: ${info.messageId || 'ok'}`,
      fromUsed: fromToUse,
    };
  } catch (error: any) {
    console.error('❌ Falha ao enviar via SMTP:', error?.message || error);
    return {
      success: false,
      status: 0,
      body: error?.message || 'Falha ao enviar via SMTP',
      fromUsed: fromToUse,
    };
  }
};

const performSend = async (input: {
  apiKey: string;
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
  from: string;
  replyTo?: string | null;
  text?: string | null;
}): Promise<SendResendEmailResult> => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      ...(input.cc && input.cc.length > 0 ? { cc: input.cc } : {}),
      ...(input.replyTo ? { reply_to: input.replyTo } : {}),
      subject: input.subject,
      ...(input.text ? { text: input.text } : {}),
      html: input.html,
    }),
  });

  const body = await response.text();
  return {
    success: response.ok,
    status: response.status,
    body,
    fromUsed: input.from,
  };
};

export const sendResendEmail = async ({
  to,
  cc,
  subject,
  html,
  from = DEFAULT_FROM,
  replyTo = DEFAULT_REPLY_TO,
  text,
}: SendResendEmailInput): Promise<SendResendEmailResult> => {
  console.log('📮 sendResendEmail chamada');
  console.log('  Para:', to);
  console.log('  CC:', cc || 'Nenhum');
  console.log('  Assunto:', subject);
  console.log('  From:', from);
  console.log('  Reply-To:', replyTo || 'Nenhum');

  const resolvedText = (typeof text === 'string' && text.trim().length > 0) ? text.trim() : htmlToText(html);
  const smtpAttempt = await sendSmtpEmail({ to, cc, subject, html, from, replyTo, text: resolvedText });
  if (smtpAttempt?.success) {
    return smtpAttempt;
  }
  if (!smtpAttempt) {
    console.log('ℹ️ SMTP não configurado, seguindo com Resend.');
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('❌ RESEND_API_KEY não configurada!');
    return smtpAttempt || {
      success: false,
      status: 0,
      body: 'RESEND_API_KEY não configurada',
      fromUsed: from,
    };
  }

  console.log('✅ RESEND_API_KEY encontrada');
  let effectiveFrom = from;
  const fromResolution = await resolveFromUsingVerifiedDomain(apiKey, effectiveFrom, {
    forceVerified: FORCE_VERIFIED_DOMAIN || effectiveFrom.toLowerCase().includes('resend.dev'),
  });
  effectiveFrom = fromResolution.from;
  if (effectiveFrom !== from) {
    console.log('✉️ From ajustado para domínio verificado:', effectiveFrom);
  }

  if (FORCE_VERIFIED_DOMAIN && effectiveFrom.toLowerCase().includes('resend.dev')) {
    console.error('❌ Nenhum domínio verificado encontrado para envio.');
    return smtpAttempt || {
      success: false,
      status: 0,
      body: 'Nenhum domínio verificado encontrado no Resend.',
      fromUsed: effectiveFrom,
    };
  }

  console.log('📤 Enviando primeira tentativa via Resend...');

  const firstAttempt = await performSend({
    apiKey,
    to,
    cc,
    subject,
    html,
    from: effectiveFrom,
    replyTo,
    text: resolvedText,
  });

  console.log('📬 Resultado da primeira tentativa:');
  console.log('  Sucesso:', firstAttempt.success);
  console.log('  Status:', firstAttempt.status);
  console.log('  Body:', firstAttempt.body);

  if (firstAttempt.success) {
    console.log('✅ Email enviado com sucesso na primeira tentativa!');
    return firstAttempt;
  }

  console.log('⚠️ Primeira tentativa falhou');

  if (!isTestingRestrictionError(firstAttempt.status, firstAttempt.body) && !isFromDomainError(firstAttempt.status, firstAttempt.body)) {
    console.log('❌ Erro não é de restrição de teste, retornando erro');
    return firstAttempt;
  }

  console.log('🔄 Erro de envio detectado, tentando com domínio verificado...');

  const fallbackFrom =
    (FALLBACK_FROM && FALLBACK_FROM.trim()) ||
    fromResolution.fallbackFrom ||
    (await resolveFromUsingVerifiedDomain(apiKey, from)).fallbackFrom;

  if (!fallbackFrom || fallbackFrom === from) {
    console.log('❌ Nenhum domínio verificado encontrado');
    return firstAttempt;
  }

  console.log('✅ Domínio verificado encontrado:', fallbackFrom);
  console.log('📤 Enviando segunda tentativa via Resend...');

  const secondAttempt = await performSend({
    apiKey,
    to,
    cc,
    subject,
    html,
    from: fallbackFrom,
    replyTo,
    text: resolvedText,
  });

  console.log('📬 Resultado da segunda tentativa:');
  console.log('  Sucesso:', secondAttempt.success);
  console.log('  Status:', secondAttempt.status);

  return secondAttempt;
};
