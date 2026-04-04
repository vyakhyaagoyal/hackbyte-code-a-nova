const express = require('express');
const cors    = require('cors');
const fetch   = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ── Tutor Configuration ──
// Each tutor has a subject, system prompt, and ElevenLabs voice ID
const TUTORS = {
  science: {
    name: 'Dr. Aris',
    subject: 'science',
    voiceId: '21m00Tcm4TlvDq8ikWAM', // Rachel
    systemPrompt: 'You are Dr. Aris, a brilliant and friendly science tutor. Explain concepts clearly, use simple language, and ask engaging questions. Keep responses under 2 sentences.'
  },
  math: {
    name: 'Mr. Max',
    subject: 'math',
    voiceId: 'AZnzlk1XvdvUeBnXmlld', // Domi
    systemPrompt: 'You are Mr. Max, an enthusiastic math tutor. Break down problems step-by-step, use real-world examples, and celebrate progress. Keep responses under 2 sentences.'
  },
  history: {
    name: 'Professor Leo',
    subject: 'history',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Bella
    systemPrompt: 'You are Professor Leo, a passionate history teacher. Tell engaging stories, connect past to present, ask thought-provoking questions. Keep responses under 2 sentences.'
  },
  geography: {
    name: 'Geo Nova',
    subject: 'geography',
    voiceId: 'ErXwobaYiN019PkySvjV', // Antoni
    systemPrompt: 'You are Geo Nova, an adventurous geography guide. Paint vivid pictures of places, share interesting facts, inspire curiosity. Keep responses under 2 sentences.'
  },
  hindi: {
    name: 'Kai',
    subject: 'hindi',
    voiceId: 'MF3mGyEYCl7XYWbV9V6O', // Elli
    systemPrompt: 'You are Kai, a warm Hindi language teacher. Make learning fun, explain in context, use cultural references. Keep responses under 2 sentences.'
  }
};

// ── Route: Chat with tutor (LLM brain) ──
app.post('/chat', async (req, res) => {
  const { subject = 'science', message, focusLevel } = req.body;

  if (!message) return res.status(400).json({ error: 'message required' });

  const tutor = TUTORS[subject] || TUTORS.science;

  // If student is distracted, add context for LLM
  let contextualMessage = message;
  if (focusLevel && focusLevel !== 'focused') {
    contextualMessage = `[Student is currently ${focusLevel}. Keep response encouraging and brief.] ${message}`;
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
          { role: 'system', content: tutor.systemPrompt },
          { role: 'user', content: contextualMessage }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const reply = data.choices?.[0]?.message?.content || 'Let me help you with that.';
    res.json({ reply, tutor: tutor.name, subject });
  } catch (err) {
    console.error('[chat] error:', err.message);
    res.status(500).json({ error: 'chat failed', details: err.message });
  }
});

// ── Route: Text-to-Speech (voice output) ──
app.post('/speak', async (req, res) => {
  const { subject = 'science', text } = req.body;

  if (!text) return res.status(400).json({ error: 'text required' });

  const tutor = TUTORS[subject] || TUTORS.science;

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${tutor.voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': process.env.ELEVENLABS_API_KEY
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`ElevenLabs API error: ${err}`);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    response.body.pipe(res);
  } catch (err) {
    console.error('[speak] error:', err.message);
    res.status(500).json({ error: 'voice generation failed', details: err.message });
  }
});

// ── Route: Auto-intervention (when focus is lost) ──
app.post('/intervene', async (req, res) => {
  const { subject = 'science', reason = 'distracted' } = req.body;

  const tutor = TUTORS[subject] || TUTORS.science;

  const interventionPrompts = {
    distracted: 'Student looks distracted. Say something brief and warm to re-engage them in a fun way.',
    drowsy: 'Student looks sleepy. Suggest a quick energiser or tell a funny fact to wake them up.',
    absent: 'Student has left their desk. Say an encouraging message they will hear when they return.',
    posture: 'Student is slouching. Kindly remind them to sit up straight with humor.',
    break: 'It has been 45 minutes. Suggest a 5-minute break and hydration in a motivating way.'
  };

  const prompt = interventionPrompts[reason] || interventionPrompts.distracted;

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
          { role: 'system', content: tutor.systemPrompt },
          { role: 'user', content: prompt }
        ]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const reply = data.choices?.[0]?.message?.content || 'Hey, stay with me!';
    res.json({ reply, tutor: tutor.name, subject, reason });
  } catch (err) {
    console.error('[intervene] error:', err.message);
    res.status(500).json({ error: 'intervention failed', details: err.message });
  }
});


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🤖 FocusRoom bot server running on http://localhost:${PORT}`);
});
