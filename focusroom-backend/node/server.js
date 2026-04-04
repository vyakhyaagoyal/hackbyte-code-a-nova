const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Bot personalities (system prompts) ──
const BOT_PERSONAS = {
  Zara: {
    subject: 'science',
    prompt: `You are Zara, a chill and enthusiastic science tutor who talks like a knowledgeable friend.
You specialise in biology, chemistry, and physics.
Keep answers under 3 sentences unless the student asks for more detail.
Use casual language. No bullet points. Be warm and encouraging.
If told the student is distracted, say something like "hey, you zoned out — want me to recap that quickly?" `
  },
  Max: {
    subject: 'math',
    prompt: `You are Max, a friendly math buddy who makes numbers feel easy.
You cover algebra, calculus, stats, and geometry.
Keep answers concise. Walk through logic step by step but briefly.
If told the student is distracted, say "yo, lost you there — let's restart from the key idea."`
  },
  Leo: {
    subject: 'english',
    prompt: `You are Leo, a laid-back English coach who helps with writing, grammar, and literature.
Be warm, encouraging, and specific with feedback.
If told the student is distracted, gently say "hey, come back — we were on something good."`
  },
  Nova: {
    subject: 'computer science',
    prompt: `You are Nova, a sharp CS helper who explains algorithms, code, and theory clearly.
Keep it practical. Give examples over abstract explanations.
If told the student is distracted, say "hey, refocus — this part actually matters for interviews."`
  },
  Kai: {
    subject: 'focus coaching',
    prompt: `You are Kai, a calm focus coach. Your job is to keep the student grounded, motivated, and present.
You don't teach subjects — you help with mindset, breaks, and energy.
If told the student is distracted, say something gentle like "breathe. come back. one thing at a time."`
  },
  Sage: {
    subject: 'history',
    prompt: `You are Sage, a storytelling history guide who makes the past feel alive.
Cover world history, politics, and social movements.
If told the student is distracted, say "come back — the story was just getting good."`
  }
};

// ── Route: chat with bot ──
app.post('/bot/chat', async (req, res) => {
  const { bot = 'Zara', message, attentionState } = req.body;

  if (!message) return res.status(400).json({ error: 'message required' });

  const persona = BOT_PERSONAS[bot] || BOT_PERSONAS.Zara;

  // Inject attention context into message if distracted
  let userMessage = message;
  if (attentionState && attentionState !== 'focused') {
    userMessage = `[system: student is currently ${attentionState}] ${message}`;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 150,
        messages: [
          { role: 'system', content: persona.prompt },
          { role: 'user',   content: userMessage }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "hmm, let me think about that...";

    res.json({ reply, bot, subject: persona.subject });
  } catch (err) {
    console.error('[bot/chat] error:', err);
    res.status(500).json({ error: 'bot unavailable' });
  }
});

// ── Route: text-to-speech via ElevenLabs ──
app.post('/voice/speak', async (req, res) => {
  const { text, bot = 'Zara' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });

  // Map each bot to a different ElevenLabs voice ID
  // Replace these with your actual voice IDs from ElevenLabs dashboard
  const VOICE_IDS = {
    Zara: '21m00Tcm4TlvDq8ikWAM',  // Rachel
    Max:  'AZnzlk1XvdvUeBnXmlld',  // Domi
    Leo:  'EXAVITQu4vr4xnSDxMaL',  // Bella
    Nova: 'ErXwobaYiN019PkySvjV',  // Antoni
    Kai:  'MF3mGyEYCl7XYWbV9V6O',  // Elli
    Sage: 'TxGEqnHWrfWFTfGW9XjX'   // Josh
  };

  const voiceId = VOICE_IDS[bot] || VOICE_IDS.Zara;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_monolingual_v1',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'ElevenLabs error', details: err });
    }

    // Stream audio back to frontend
    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (err) {
    console.error('[voice/speak] error:', err);
    res.status(500).json({ error: 'voice unavailable' });
  }
});

// ── Route: attention alert → bot responds automatically ──
app.post('/bot/intervene', async (req, res) => {
  const { bot = 'Zara', reason = 'distracted' } = req.body;
  const persona = BOT_PERSONAS[bot] || BOT_PERSONAS.Zara;

  const interventionMessages = {
    distracted:   `The student looks distracted. Say something brief and warm to bring them back.`,
    absent:       `The student has left their desk. Leave a short encouraging message for when they return.`,
    looking_away: `The student is looking away from the screen. Gently nudge them back.`,
    drowsy:       `The student looks sleepy. Suggest a quick energiser without being harsh.`,
    posture:      `The student is slouching badly. Remind them kindly to sit up straight.`,
    water:        `It's been 20 minutes. Remind the student to drink water in a chill way.`,
    eye_break:    `Time for an eye break. Remind them about the 20-20-20 rule briefly.`
  };

  const prompt = interventionMessages[reason] || interventionMessages.distracted;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          { role: 'system', content: persona.prompt },
          { role: 'user',   content: prompt }
        ]
      })
    });

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "hey, stay focused!";
    res.json({ reply, bot, reason });
  } catch (err) {
    console.error('[bot/intervene] error:', err);
    res.status(500).json({ error: 'intervention failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 FocusRoom bot server running on http://localhost:${PORT}`);
});
