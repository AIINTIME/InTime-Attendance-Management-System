import { useEffect, useRef, useState } from "react";
import { Fingerprint, XCircle } from "lucide-react";
import { verifyPasskey } from "../../Services/passkeyService";

/**
 * Runs the WebAuthn assertion ceremony as soon as it mounts and reports the
 * resulting passkeyTicket via onVerified. Works identically on desktop
 * (Windows Hello / Touch ID) and mobile (Face ID / Android biometrics) since
 * it's plain WebAuthn -- the browser/OS decides which platform authenticator
 * prompt to show.
 */
export default function PasskeyStep({ onVerified, onCancel }) {
  const [status, setStatus] = useState("prompting"); // prompting | error
  const [errorMessage, setErrorMessage] = useState("");
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;
    runVerification();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runVerification() {
    setStatus("prompting");
    setErrorMessage("");
    try {
      const ticket = await verifyPasskey();
      onVerified(ticket);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err.message || "Passkey verification failed.");
    }
  }

  return (
    <div className="flow-step passkey-step">
      {status === "prompting" && (
        <>
          <div className="passkey-icon-circle">
            <Fingerprint size={36} />
          </div>
          <h3>Secure your check-in</h3>
          <p>Use your fingerprint, Face ID, device PIN, or screen lock to verify it's really you.</p>
          <div className="flow-hint">Waiting for your device…</div>
        </>
      )}

      {status === "error" && (
        <>
          <div className="passkey-icon-circle error">
            <XCircle size={36} />
          </div>
          <h3>Verification failed</h3>
          <p>{errorMessage}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={runVerification}>
              Try Again
            </button>
          </div>
        </>
      )}
    </div>
  );
}
