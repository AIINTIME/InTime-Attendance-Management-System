import { useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Modal from "../Modals/Modal";
import PasskeyStep from "./PasskeyStep";
import { checkOutAttendance } from "../../Services/attendanceService";
import { getCurrentPosition } from "../../Utils/locationUtils";
import { formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import { extractErrorMessage } from "../../Utils/validation";

export default function CheckOutFlowModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState("passkey"); // passkey | location | submitting | success | error
  const [errorMessage, setErrorMessage] = useState("");
  const [attendance, setAttendance] = useState(null);

  const resetAndClose = () => {
    setStep("passkey");
    setErrorMessage("");
    setAttendance(null);
    onClose();
  };

  const handlePasskeyVerified = async (ticket) => {
    setStep("location");
    try {
      const pos = await getCurrentPosition();
      setStep("submitting");
      const result = await checkOutAttendance({
        passkeyTicket: ticket,
        latitude: pos.latitude,
        longitude: pos.longitude,
        accuracy: pos.accuracy,
      });
      setAttendance(result);
      setStep("success");
    } catch (err) {
      if (err.message === "LOCATION_PERMISSION_DENIED") {
        setErrorMessage("Location access is required to check out. Please allow location access.");
      } else {
        setErrorMessage(extractErrorMessage(err, "We couldn't check you out."));
      }
      setStep("error");
    }
  };

  const handleDone = () => {
    onSuccess(attendance);
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title="Check Out" size="sm">
      {step === "passkey" && (
        <PasskeyStep onVerified={handlePasskeyVerified} onCancel={resetAndClose} />
      )}

      {step === "location" && (
        <div className="flow-step">
          <div className="spinner" />
          <h3>Verifying location…</h3>
          <p className="muted small">Checking your coordinates for check-out verification…</p>
        </div>
      )}

      {step === "submitting" && (
        <div className="flow-step">
          <div className="spinner" />
          <h3>Recording check-out…</h3>
        </div>
      )}

      {step === "success" && (
        <div className="flow-step success-step">
          <div className="success-icon-circle">
            <CheckCircle2 size={40} />
          </div>
          <h3>Checked out</h3>
          <p>
            {formatTime(attendance?.checkOutTime)} · Total working time:{" "}
            {formatMinutesAsHours(attendance?.totalWorkingMinutes)}
          </p>
          <div className="modal-actions">
            <button type="button" className="btn btn-primary" onClick={handleDone}>
              Done
            </button>
          </div>
        </div>
      )}

      {step === "error" && (
        <div className="flow-step">
          <div className="passkey-icon-circle error">
            <AlertTriangle size={32} />
          </div>
          <h3>Check-out not recorded</h3>
          <p>{errorMessage}</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={resetAndClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
