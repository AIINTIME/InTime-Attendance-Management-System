import { useState } from "react";
import { ShieldCheck, XCircle } from "lucide-react";
import Modal from "../Modals/Modal";
import {
  registerPasskey,
  isWebAuthnSupported,
  webAuthnUnavailableMessage,
  guessDeviceNickname,
} from "../../Services/passkeyService";
import { extractErrorMessage } from "../../Utils/validation";

/**
 * Shown the first time an employee tries to give attendance without a
 * registered passkey yet. Once registration succeeds, onRegistered() lets
 * the caller immediately continue into the attendance flow the employee
 * originally asked for -- no need to click "Give Attendance" twice.
 */
export default function PasskeyRegistrationPrompt({ isOpen, onClose, onRegistered }) {
  const [status, setStatus] = useState("intro"); // intro | registering | error
  const [errorMessage, setErrorMessage] = useState("");

  const supported = isWebAuthnSupported();

  const handleRegister = async () => {
    setStatus("registering");
    setErrorMessage("");
    try {
      await registerPasskey(guessDeviceNickname());
      onRegistered();
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, err.message || "Passkey registration failed."));
      setStatus("error");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Register your Passkey" size="sm">
      {!supported ? (
        <div className="flow-step">
          <div className="passkey-icon-circle error">
            <XCircle size={32} />
          </div>
          <h3>Passkeys aren't available here</h3>
          <p>{webAuthnUnavailableMessage()}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flow-step passkey-step">
          <div className="passkey-icon-circle">
            <ShieldCheck size={36} />
          </div>
          <h3>Secure your account</h3>
          <p>
            Use your fingerprint, Face ID, device PIN, or screen lock to create a passkey. You'll
            only need to do this once -- after that, the same passkey verifies every attendance
            check-in on this device.
          </p>

          {status === "error" && <div className="form-error-banner">{errorMessage}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={status === "registering"}>
              Not now
            </button>
            <button type="button" className="btn btn-primary" onClick={handleRegister} disabled={status === "registering"}>
              {status === "registering" ? "Waiting for your device…" : "Register Passkey"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
