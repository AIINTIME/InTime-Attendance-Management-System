import { useState } from "react";

const MAX_LENGTH = 300;

export default function ReasonStep({ onSubmit, onCancel }) {
  const [reason, setReason] = useState("");
  const trimmed = reason.trim();

  return (
    <div className="flow-step reason-step">
      <p className="reason-intro">Please provide a reason for marking attendance remotely.</p>

      <label htmlFor="reason" className="sr-only">
        Reason for Distance Attendance
      </label>
      <textarea
        id="reason"
        value={reason}
        maxLength={MAX_LENGTH}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Please explain why you are marking attendance remotely..."
        rows={5}
      />
      <div className="char-count">
        {reason.length} / {MAX_LENGTH}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!trimmed}
          onClick={() => onSubmit(trimmed)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
