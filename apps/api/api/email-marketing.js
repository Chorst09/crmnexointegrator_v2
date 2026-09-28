import { prisma } from '../lib/prisma.js';

// Simulação de integração com plataformas de e-mail marketing
export default async function handler(req) {
  if (req.method === 'POST') {
    const { action, ...data } = await req.json();

    try {
      switch (action) {
        case 'send_campaign':
          return await sendCampaign(data);
        case 'create_contact':
          return await createContact(data);
        case 'add_to_list':
          return await addToList(data);
        case 'send_transactional':
          return await sendTransactional(data);
        default:
          return Response.json({ error: 'Invalid action' }, { status: 400 });
      }
    } catch (error) {
      console.error('Email Marketing API Error:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }
  }

  if (req.method === 'GET') {
    const { type } = req.query || {};
    
    if (type === 'campaigns') {
      return await getCampaigns();
    }
    
    if (type === 'lists') {
      return await getLists();
    }
    
    return Response.json({ error: 'Invalid type' }, { status: 400 });
  }

  return new Response('Method not allowed', { status: 405 });
}

async function sendCampaign({ campaignName, subject, content, listId, companyIds }) {
  const campaignId = `camp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Simular envio para empresas específicas ou lista
  let recipients = [];
  
  if (companyIds && companyIds.length > 0) {
    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      include: {
        contacts: {
          where: { isPrimary: true }
        }
      }
    });
    
    recipients = companies.map(company => ({
      email: company.contacts[0]?.email,
      name: company.contacts[0]?.name,
      company: company.name
    })).filter(r => r.email);
  }

  // Log da campanha
  await prisma.integrationLog.create({
    data: {
      integrationId: await getEmailIntegrationId(),
      action: 'send_campaign',
      status: 'SUCCESS',
      message: `Campanha ${campaignName} enviada para ${recipients.length} contatos`,
      data: {
        campaignId,
        campaignName,
        subject,
        recipientCount: recipients.length,
        listId
      }
    }
  });

  // Criar atividades para cada empresa
  for (const recipient of recipients) {
    if (recipient.company) {
      const company = await prisma.company.findFirst({
        where: { name: recipient.company }
      });
      
      if (company) {
        await prisma.activity.create({
          data: {
            type: 'EMAIL',
            subject: `Campanha enviada: ${subject}`,
            description: `Campanha de e-mail marketing "${campaignName}" enviada para ${recipient.email}`,
            status: 'COMPLETED',
            priority: 'MEDIUM',
            completedAt: new Date(),
            companyId: company.id,
            assignedToId: await getDefaultUserId()
          }
        });
      }
    }
  }

  return Response.json({
    success: true,
    campaignId,
    recipientCount: recipients.length,
    status: 'sent'
  });
}

async function createContact({ email, name, companyName, tags }) {
  const contactId = `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await prisma.integrationLog.create({
    data: {
      integrationId: await getEmailIntegrationId(),
      action: 'create_contact',
      status: 'SUCCESS',
      message: `Contato ${email} criado na plataforma de e-mail`,
      data: {
        contactId,
        email,
        name,
        companyName,
        tags
      }
    }
  });

  return Response.json({
    success: true,
    contactId,
    email,
    status: 'created'
  });
}

async function addToList({ email, listId, listName }) {
  await prisma.integrationLog.create({
    data: {
      integrationId: await getEmailIntegrationId(),
      action: 'add_to_list',
      status: 'SUCCESS',
      message: `Contato ${email} adicionado à lista ${listName}`,
      data: {
        email,
        listId,
        listName
      }
    }
  });

  return Response.json({
    success: true,
    email,
    listId,
    status: 'added'
  });
}

async function sendTransactional({ to, subject, template, data: templateData, companyId }) {
  const messageId = `trans_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  await prisma.integrationLog.create({
    data: {
      integrationId: await getEmailIntegrationId(),
      action: 'send_transactional',
      status: 'SUCCESS',
      message: `E-mail transacional enviado para ${to}`,
      data: {
        messageId,
        to,
        subject,
        template,
        companyId
      }
    }
  });

  // Criar atividade se vinculado a uma empresa
  if (companyId) {
    await prisma.activity.create({
      data: {
        type: 'EMAIL',
        subject: `E-mail enviado: ${subject}`,
        description: `E-mail transacional enviado para ${to}`,
        status: 'COMPLETED',
        priority: 'MEDIUM',
        completedAt: new Date(),
        companyId,
        assignedToId: await getDefaultUserId()
      }
    });
  }

  return Response.json({
    success: true,
    messageId,
    status: 'sent'
  });
}

async function getCampaigns() {
  // Simular campanhas existentes
  const campaigns = [
    {
      id: 'camp_1',
      name: 'Newsletter Mensal',
      subject: 'Novidades do mês',
      status: 'sent',
      sentAt: new Date(Date.now() - 86400000).toISOString(),
      recipients: 150,
      opens: 45,
      clicks: 12
    },
    {
      id: 'camp_2',
      name: 'Promoção Black Friday',
      subject: 'Descontos imperdíveis!',
      status: 'scheduled',
      scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      recipients: 200
    }
  ];

  return Response.json(campaigns);
}

async function getLists() {
  // Simular listas de contatos
  const lists = [
    {
      id: 'list_1',
      name: 'Clientes Ativos',
      description: 'Lista de clientes com contratos ativos',
      contactCount: 120
    },
    {
      id: 'list_2',
      name: 'Prospects Qualificados',
      description: 'Prospects com alto potencial de conversão',
      contactCount: 85
    },
    {
      id: 'list_3',
      name: 'Newsletter Geral',
      description: 'Lista geral para newsletter',
      contactCount: 300
    }
  ];

  return Response.json(lists);
}

async function getEmailIntegrationId() {
  const integration = await prisma.integration.findFirst({
    where: { type: 'EMAIL_MARKETING' }
  });
  return integration?.id || 'default';
}

async function getDefaultUserId() {
  const user = await prisma.user.findFirst({
    where: { role: 'ADMIN' }
  });
  return user?.id || 'default';
}