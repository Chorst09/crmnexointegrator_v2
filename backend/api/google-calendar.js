const express = require('express');
const { authenticateToken } = require('../lib/auth');
const googleCalendar = require('../lib/google-calendar');

const router = express.Router();

// GET /api/google-calendar/status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const connected = await googleCalendar.isConnected(req.user.userId);
    res.json({ connected });
  } catch (error) {
    console.error('Erro ao verificar status Google Calendar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/google-calendar/auth-url
router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    const url = googleCalendar.getAuthUrl(req.user.userId);
    res.json({ url });
  } catch (error) {
    console.error('Erro ao gerar URL de autorização:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/google-calendar/callback?code=...&state=userId
router.get('/callback', async (req, res) => {
  try {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
      return res.status(400).send('Parâmetros code e state são obrigatórios');
    }

    await googleCalendar.handleCallback(code, userId);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/kickoff?google_calendar=connected`);
  } catch (error) {
    console.error('Erro no callback Google Calendar:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/kickoff?google_calendar=error`);
  }
});

// DELETE /api/google-calendar/disconnect
router.delete('/disconnect', authenticateToken, async (req, res) => {
  try {
    await googleCalendar.disconnect(req.user.userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao desconectar Google Calendar:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
