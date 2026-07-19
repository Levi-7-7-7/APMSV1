import React, { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import "../css/BootLoader.css";

// Full-screen loader shown while a persisted login (token already in
// localStorage from a previous visit) is being re-verified against the
// backend. The backend runs on a free hosting tier that spins itself down
// after inactivity, so the very first request after that can take
// anywhere up to ~60 seconds to "wake" the server back up. Previously
// nothing was rendered during that wait — this keeps something calm and
// reassuring on screen instead of a blank white page, and only mentions
// the cold-start possibility once the wait is actually running long.
//
// Pass `fadingOut` once a response has come back, so this can play a
// brief fade before the app swaps in the destination page.
export default function BootLoader({ fadingOut = false }) {
  const [phase, setPhase] = useState(0); // 0 = connecting, 1 = taking a while, 2 = cold start likely

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 4000);
    const t2 = setTimeout(() => setPhase(2), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const messages = [
    "Connecting…",
    "Still connecting…",
    "Waking up the server — this can take up to a minute on the first request.",
  ];

  return (
    <div className={`bootloader${fadingOut ? " bootloader-out" : ""}`} role="status" aria-live="polite">
      <div className="bootloader-orbit">
        <span className="bootloader-ring"></span>
        <span className="bootloader-ring bootloader-ring-2"></span>
        <span className="bootloader-mark"><GraduationCap size={26} /></span>
      </div>
      <p className="bootloader-title">Activity Points</p>
      <p className="bootloader-status">{messages[phase]}</p>
    </div>
  );
}
