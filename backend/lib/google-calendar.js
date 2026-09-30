const { google } = require('googleapis');

let _prisma = null;
function getPrisma() {
  if (!_prisma) {
    const { PrismaClient } = require('@prisma/client');
    _prisma = new PrismaClient();
  }
  return _prisma;
}

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

const getAuthUrl = (userId) => {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state: userId
  });
};

const handleCallback = async (code, userId) => {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);

  await getPrisma().googleToken.upsert({
    where: { userId },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || undefined,
      scope: tokens.scope || SCOPES.join(' '),
      expiryDate: new Date(tokens.expiry_date)
    },
    create: {
      userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scope: tokens.scope || SCOPES.join(' '),
      expiryDate: new Date(tokens.expiry_date)
    }
  });

  return true;
};

const getAuthenticatedClient = async (userId) => {
  const record = await getPrisma().googleToken.findUnique({ where: { userId } });
  if (!record) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: record.accessToken,
    refresh_token: record.refreshToken,
    expiry_date: record.expiryDate.getTime()
  });

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await getPrisma().googleToken.update({
        where: { userId },
        data: {
          accessToken: tokens.access_token,
          expiryDate: new Date(tokens.expiry_date)
        }
      });
    }
  });

  return oauth2Client;
};

const isConnected = async (userId) => {
  const record = await getPrisma().googleToken.findUnique({ where: { userId } });
  return !!record;
};

const createEvent = async (userId, meeting, participants) => {
  const auth = await getAuthenticatedClient(userId);
  if (!auth) throw new Error('Google Calendar não conectado');

  const calendar = google.calendar({ version: 'v3', auth });

  const startDateTime = combineDateTime(meeting.scheduledDate, meeting.startTime);
  const endDateTime = combineDateTime(meeting.scheduledDate, meeting.endTime);

  const attendeeEmails = [];
  for (const p of participants) {
    if (p.user?.email) attendeeEmails.push({ email: p.user.email });
    if (p.contact?.email) attendeeEmails.push({ email: p.contact.email });
  }

  const event = {
    summary: meeting.title,
    description: buildDescription(meeting),
    start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
    attendees: attendeeEmails,
    conferenceData: meeting.platform === 'MEET' ? {
      createRequest: {
        requestId: `kickoff-${meeting.id}-${Date.now()}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' }
      }
    } : undefined,
    guestsCanSeeOtherGuests: true,
    guestsCanModify: false
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
    conferenceDataVersion: meeting.platform === 'MEET' ? 1 : 0,
    sendUpdates: 'all'
  });

  return {
    eventId: response.data.id,
    calendarId: 'primary',
    hangoutLink: response.data.hangoutLink || null
  };
};

const updateEvent = async (userId, eventId, meeting, participants) => {
  const auth = await getAuthenticatedClient(userId);
  if (!auth) throw new Error('Google Calendar não conectado');

  const calendar = google.calendar({ version: 'v3', auth });

  const startDateTime = combineDateTime(meeting.scheduledDate, meeting.startTime);
  const endDateTime = combineDateTime(meeting.scheduledDate, meeting.endTime);

  const attendeeEmails = [];
  for (const p of participants) {
    if (p.user?.email) attendeeEmails.push({ email: p.user.email });
    if (p.contact?.email) attendeeEmails.push({ email: p.contact.email });
  }

  const event = {
    summary: meeting.title,
    description: buildDescription(meeting),
    start: { dateTime: startDateTime, timeZone: 'America/Sao_Paulo' },
    end: { dateTime: endDateTime, timeZone: 'America/Sao_Paulo' },
    attendees: attendeeEmails
  };

  await calendar.events.update({
    calendarId: 'primary',
    eventId,
    resource: event,
    sendUpdates: 'all'
  });

  return true;
};

const deleteEvent = async (userId, eventId) => {
  const auth = await getAuthenticatedClient(userId);
  if (!auth) throw new Error('Google Calendar não conectado');

  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId: 'primary',
    eventId,
    sendUpdates: 'all'
  });

  return true;
};

const disconnect = async (userId) => {
  await getPrisma().googleToken.delete({ where: { userId } }).catch(() => null);
  return true;
};

function combineDateTime(date, time) {
  if (!date) return new Date().toISOString();
  const d = new Date(date);
  if (time) {
    const [hours, minutes] = time.split(':').map(Number);
    d.setHours(hours, minutes, 0, 0);
  }
  return d.toISOString();
}

function buildDescription(meeting) {
  const parts = [];
  if (meeting.description) parts.push(meeting.description);
  parts.push(`Fase: ${meeting.phase}`);
  parts.push(`Plataforma: ${meeting.platform}`);
  if (meeting.meetingLink) parts.push(`Link: ${meeting.meetingLink}`);
  if (meeting.number) parts.push(`Código: ${meeting.number}`);
  return parts.join('\n');
}

module.exports = {
  getAuthUrl,
  handleCallback,
  getAuthenticatedClient,
  isConnected,
  createEvent,
  updateEvent,
  deleteEvent,
  disconnect
};
