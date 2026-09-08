import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import Modal from "../Modals/Modal";
import ReasonStep from "./ReasonStep";
import PasskeyStep from "./PasskeyStep";
import LocationStep from "./LocationStep";
import SuccessAnimation from "./SuccessAnimation";
import { registerOfficeAttendance, registerDistanceAttendance } from "../../Services/attendanceService";
import { extractErrorMessage } from "../../Utils/validation";

const TITLES = {
  OFFICE: "Office Login",
  DISTANCE: "Remote Login",
};

export default function AttendanceFlowModal({ mode, isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState(mode === "DISTANCE" ? "reason" : "passkey");
  const [reason, setReason] = useState("");
  const [passkeyTicket, setPasskeyTicket] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [attendance, setAttendance] = useState(null);

  const resetAndClose = () => {
    setStep(mode === "DISTANCE" ? "reason" : "passkey");
    setReason("");
    setPasskeyTicket(null);
    setErrorMessage("");
    setAttendance(null);
    onClose();
  };

  const handleReasonSubmit = (value) => {
    setReason(value);
    setStep("passkey");
  };

  const handlePasskeyVerified = (ticket) => {
    setPasskeyTicket(ticket);
    setStep("location");
  };

  const handleLocated = async (position) => {
    setStep("submitting");
    try {
      const result =
        mode === "OFFICE"
          ? await registerOfficeAttendance({ ...position, passkeyTicket })
          : await registerDistanceAttendance({ ...position, reason, passkeyTicket });
      setAttendance(result);
      setStep("success");
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, "We couldn't register your attendance."));
      setStep("error");
    }
  };

  const handleSuccessDone = () => {
    onSuccess(attendance);
    resetAndClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={TITLES[mode]} size="sm">
      {step === "reason" && <ReasonStep onSubmit={handleReasonSubmit} onCancel={resetAndClose} />}

      {step === "passkey" && (
        <PasskeyStep onVerified={handlePasskeyVerified} onCancel={resetAndClose} />
      )}

      {step === "location" && (
        <LocationStep mode={mode} onLocated={handleLocated} onCancel={resetAndClose} />
      )}

      {step === "submitting" && (
        <div className="flow-step">
          <div className="spinner" />
          <h3>Registering attendance…</h3>
        </div>
      )}

      {step === "success" && <SuccessAnimation attendance={attendance} onDone={handleSuccessDone} />}

      {step === "error" && (
        <div className="flow-step">
          <div className="passkey-icon-circle error">
            <AlertTriangle size={32} />
          </div>
          <h3>Attendance not registered</h3>
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
