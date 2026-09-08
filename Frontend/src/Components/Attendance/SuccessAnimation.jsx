import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { formatDate, formatTime } from "../../Utils/dateUtils";

const CONFETTI_PIECES = [
  { left: "18%", color: "var(--color-primary)", delay: "0s" },
  { left: "32%", color: "var(--color-warning)", delay: "0.3s" },
  { left: "48%", color: "var(--color-success)", delay: "0.15s" },
  { left: "64%", color: "var(--color-primary)", delay: "0.45s" },
  { left: "78%", color: "var(--color-warning)", delay: "0.05s" },
  { left: "58%", color: "var(--color-success)", delay: "0.6s" },
];

export default function SuccessAnimation({ attendance, onDone }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="flow-step success-step">
      {CONFETTI_PIECES.map((piece, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={{ left: piece.left, background: piece.color, animationDelay: piece.delay }}
        />
      ))}

      <div className="success-icon-circle">
        <CheckCircle2 size={40} />
      </div>
      <h3>Attendance registered</h3>
      <p>
        {formatDate(attendance?.checkInTime || attendance?.date)}
        <br />
        {formatTime(attendance?.checkInTime)} · {attendance?.loginType === "OFFICE" ? "Office Login" : "Remote Login"}
      </p>
      <div className="flow-hint">Returning to Home…</div>
    </div>
  );
}
