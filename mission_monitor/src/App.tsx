import { useState } from "react";
import "./App.css";

export default function App() {

  const [page] = useState("/bodhasetu_landing_page/code.html");

  return (
    <div className="app">

      {/* <nav className="nav">
        <button onClick={() => setPage("/bodhasetu_landing_page/code.html")}>
          Landing
        </button>

        <button onClick={() => setPage("/bodhasetu_onboarding/code.html")}>
          Onboarding
        </button>

        <button onClick={() => setPage("/bodhasetu_dashboard/code.html")}>
          Dashboard
        </button>

        <button onClick={() => setPage("/bodhasetu_focus_mode/code.html")}>
          Focus Room
        </button>

        <button onClick={() => setPage("/bodhasetu_ai_study_room/code.html")}>
          AI Tutors
        </button>
      </nav> */}

      <iframe
        src={page}
        title="SelfSync"
        className="frame"
      />

      <h1>My Video</h1>
      <video controls width="720" preload="metadata">
        <source
          src="https://res.cloudinary.com/dy2xqqfza/video/upload/v1775341916/WhatsApp_Video_2026-04-05_at_12.42.27_AM_ga8x99.mp4"
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>

    </div>
  );
}
