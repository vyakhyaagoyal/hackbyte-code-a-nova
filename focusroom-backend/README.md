# FocusRoom — Setup Guide

## 📁 Project Structure
```
focusroom/
├── ml/
│   ├── app.py              ← Flask server (port 5001)
│   └── attention.py        ← MediaPipe analysis logic
├── node/
│   ├── server.js           ← Node.js bot + voice server (port 3001)
│   ├── package.json
│   └── .env
└── frontend/
    └── useAttentionTracker.js  ← React hook to drop into your app
```

---

## 🐍 ML Server (Python)

### Install dependencies
```bash
cd ml
pip install flask flask-cors mediapipe opencv-python numpy
```

### Run
```bash
python app.py
# → http://localhost:5001
```

### Test it
```bash
curl http://localhost:5001/health
# → {"status": "ok", "model": "mediapipe"}
```

---

## 🤖 Bot Server (Node.js)

### Install dependencies
```bash
cd node
npm init -y
npm install express cors node-fetch dotenv
```

### Create .env file
```
OPENAI_API_KEY=sk-your-key-here
ELEVENLABS_API_KEY=your-elevenlabs-key-here
```

### Run
```bash
node server.js
# → http://localhost:3001
```

---

## ⚛️ React Frontend

### Drop the hook into your project
```bash
cp frontend/useAttentionTracker.js src/hooks/
```

### Usage in your component
```jsx
import { useAttentionTracker, askBot } from './hooks/useAttentionTracker';

function StudyRoom() {
  const videoRef = useRef(null);
  const [sessionActive, setSessionActive] = useState(false);

  const { attention, posture, faceDetected, raw } = useAttentionTracker({
    videoRef,
    enabled: sessionActive && camActive,
    activeBot: 'Zara',
    intervalMs: 2000,
    onAlert: (type, message) => {
      // type: 'distraction' | 'posture' | 'drowsy' | 'absent' | 'bot_message'
      // show your alert overlay here
      triggerAlert(type, message);
    }
  });

  // Chat with bot
  const handleChat = async (message) => {
    const reply = await askBot({
      bot: 'Zara',
      message,
      attentionState: attention.state,
      speak: true  // uses ElevenLabs
    });
    addMessage('bot', reply);
  };

  return (
    <div>
      <video ref={videoRef} autoPlay muted />
      <p>Attention: {attention.state} ({attention.score}%)</p>
      <p>Posture: {posture.state} — {posture.details}</p>
    </div>
  );
}
```

---

## 🔬 What MediaPipe detects (no dataset needed)

| Signal | How | Threshold |
|--------|-----|-----------|
| Face absent | No landmarks found | > 2s |
| Head turned | Nose vs ear midpoint offset | yaw > 25° |
| Looking down | Nose vs chin/forehead | pitch > 20° |
| Eyes closing | Eye aspect ratio (EAR) | EAR < 0.18 |
| Gaze direction | Iris position vs eye corners | < 35% or > 65% |
| Shoulder tilt | L/R shoulder Y difference | > 6% frame height |
| Head forward | Ear vs shoulder X offset | > 8% frame width |
| Slouching | Ear vs shoulder Y ratio | > 78% |

---

## 🎤 ElevenLabs Voice IDs
Default voice IDs are set in server.js. Replace with your own from:
https://elevenlabs.io/speech-synthesis → pick a voice → copy its ID

---

## ⚡ Hackathon priority order
1. Run `python app.py` → verify /health responds
2. Test /analyze with a base64 image → check JSON response
3. Run `node server.js` → test /bot/chat with curl
4. Wire useAttentionTracker into frontend
5. Add ElevenLabs key → test voice
