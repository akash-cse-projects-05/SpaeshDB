const express = require('express');
const router = express.Router();
const aiBookingService = require('../services/aiBookingService');

// POST /api/webhooks/whatsapp
router.post('/whatsapp', async (req, res) => {
  try {
    const { From, Body } = req.body;
    if (!From || !Body) {
      return res.status(400).send('Missing From or Body parameter.');
    }

    // Process conversational booking
    const reply = await aiBookingService.handleIncomingMessage(From, Body);

    // Return TwiML with the reply so Twilio sends it back to the user's phone
    res.type('text/xml');
    res.send(`<Response><Message>${reply}</Message></Response>`);
  } catch (err) {
    console.error('❌ Webhook error:', err);
    res.status(500).send('Internal Server Error');
  }
});

// POST /api/webhooks/simulate-bot
router.post('/simulate-bot', async (req, res) => {
  try {
    const { From, Body } = req.body;
    if (!From || !Body) {
      return res.status(400).json({ error: 'Missing From or Body parameter.' });
    }

    const reply = await aiBookingService.handleIncomingMessage(From, Body);
    res.json({ reply });
  } catch (err) {
    console.error('❌ Simulator webhook error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
