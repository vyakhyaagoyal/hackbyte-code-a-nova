// useAttentionTracker.js
// Drop this hook into your React app.
// It captures webcam frames every 2 seconds,
// sends them to the Flask ML server,
// and returns live attention + posture states.

import { useEffect, useRef, useState, useCallback } from 'react';

const ML_URL   = 'http://localhost:5001/analyze';
const BOT_URL  = 'http://localhost:3001';

const DEFAULTS = {
  attention: { state: 'unknown', score: 0, reason: '' },
  posture:   { state: 'unknown', score: 100, details: '' },
  faceDetected: false,
  raw: {}
};

export function useAttentionTracker({
  videoRef,          // ref to <video> element
  enabled = false,   // only track when true (session active + cam on)
  activeBot = 'Zara',
  intervalMs = 2000, // how often to sample frames
  onAlert = () => {} // callback(type: string, message: string)
}) {
  const [data, setData]       = useState(DEFAULTS);
  const [error, setError]     = useState(null);
  const canvasRef             = useRef(null);
  const intervalRef           = useRef(null);
  const alertCooldown         = useRef({});  // prevent alert spam

  // Canvas for frame capture (hidden, not in DOM)
  useEffect(() => {
    canvasRef.current = document.createElement('canvas');
  }, []);

  const captureFrame = useCallback(() => {
    const video  = videoRef?.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;

    canvas.width  = video.videoWidth  || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Return as base64 JPEG (quality 0.7 keeps it small)
    return canvas.toDataURL('image/jpeg', 0.7);
  }, [videoRef]);

  const canAlert = useCallback((type, cooldownMs = 15000) => {
    const now = Date.now();
    if (alertCooldown.current[type] && now - alertCooldown.current[type] < cooldownMs) {
      return false;
    }
    alertCooldown.current[type] = now;
    return true;
  }, []);

  const handleResult = useCallback(async (result) => {
    setData(result);

    const { attention, posture } = result;

    // ── Attention alerts ──
    if (attention.state === 'absent' && canAlert('absent', 10000)) {
      onAlert('absent', 'you left the room!');
    }

    if (['distracted', 'looking_away'].includes(attention.state) && canAlert('distracted')) {
      onAlert('distraction', attention.reason);
      // Ask bot to intervene
      try {
        const r = await fetch(`${BOT_URL}/bot/intervene`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot: activeBot, reason: attention.state })
        });
        const d = await r.json();
        if (d.reply) onAlert('bot_message', d.reply);
      } catch {}
    }

    if (attention.state === 'drowsy' && canAlert('drowsy', 20000)) {
      onAlert('drowsy', attention.reason);
    }

    // ── Posture alerts ──
    if (posture.state === 'bad' && canAlert('posture', 20000)) {
      onAlert('posture', posture.details);
      try {
        const r = await fetch(`${BOT_URL}/bot/intervene`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bot: activeBot, reason: 'posture' })
        });
        const d = await r.json();
        if (d.reply) onAlert('bot_message', d.reply);
      } catch {}
    }

    if (posture.state === 'slouching' && canAlert('slouching', 30000)) {
      onAlert('posture', 'slight slouch detected — straighten up a little');
    }
  }, [activeBot, canAlert, onAlert]);

  const analyzeFrame = useCallback(async () => {
    const frame = captureFrame();
    if (!frame) return;

    try {
      const response = await fetch(ML_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame })
      });

      if (!response.ok) throw new Error(`ML server returned ${response.status}`);
      const result = await response.json();
      await handleResult(result);
      setError(null);
    } catch (err) {
      setError(err.message);
      // Don't crash — just skip this frame
    }
  }, [captureFrame, handleResult]);

  // Start/stop polling
  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(analyzeFrame, intervalMs);
      analyzeFrame(); // immediate first check
    } else {
      clearInterval(intervalRef.current);
      setData(DEFAULTS);
    }
    return () => clearInterval(intervalRef.current);
  }, [enabled, intervalMs, analyzeFrame]);

  return { ...data, error };
}


// ── Helper: speak text via ElevenLabs ──
export async function speakText(text, bot = 'Zara') {
  try {
    const response = await fetch(`${BOT_URL}/voice/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, bot })
    });

    if (!response.ok) return;

    const blob = await response.blob();
    const url  = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.play();
    audio.onended = () => URL.revokeObjectURL(url);
  } catch (err) {
    console.warn('[speakText] error:', err);
  }
}

// ── Helper: send message to bot and optionally speak reply ──
export async function askBot({ bot = 'Zara', message, attentionState = 'focused', speak = true }) {
  try {
    const response = await fetch(`${BOT_URL}/bot/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bot, message, attentionState })
    });

    const data = await response.json();
    if (speak && data.reply) {
      await speakText(data.reply, bot);
    }
    return data.reply;
  } catch (err) {
    console.warn('[askBot] error:', err);
    return null;
  }
}
