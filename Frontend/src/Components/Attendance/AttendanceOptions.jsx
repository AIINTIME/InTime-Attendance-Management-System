import { useCallback, useEffect, useState } from "react";
import { Building2, MapPinned, CheckCircle2, LogOut } from "lucide-react";
import { useAuth } from "../../Context/AuthContext";
import { useToast } from "../../Context/ToastContext";
import { getTodayAttendance } from "../../Services/attendanceService";
import { OFFICE_LOCATION } from "../../Utils/constants";
import { formatTime, formatMinutesAsHours } from "../../Utils/dateUtils";
import StatusBadge from "../Common/StatusBadge";
import CheckInTime from "../Common/CheckInTime";
import PasskeyRegistrationPrompt from "./PasskeyRegistrationPrompt";
import AttendanceFlowModal from "./AttendanceFlowModal";
import CheckOutFlowModal from "./CheckOutFlowModal";

export default function AttendanceOptions({ onAttendanceRegistered }) {
  const { user, updateUser } = useAuth();
  const toast = useToast();

  const [todayAttendance, setTodayAttendance] = useState(undefined); // undefined = loading
  const [pendingMode, setPendingMode] = useState(null); // "OFFICE" | "DISTANCE" | "CHECKOUT" | null
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false);
  const [activeFlow, setActiveFlow] = useState(null); // "OFFICE" | "DISTANCE" | null
  const [showCheckOut, setShowCheckOut] = useState(false);

  const refreshToday = useCallback(async () => {
    try {
      const attendance = await getTodayAttendance();
      setTodayAttendance(attendance || null);
    } catch {
      setTodayAttendance(null);
    }
  }, []);

  useEffect(() => {
    refreshToday();
  }, [refreshToday]);

  const handleGiveAttendance = (mode) => {
    if (todayAttendance) {
      toast.info("Attendance already registered for today.");
      return;
    }
    setPendingMode(mode);
    if (!user?.passkeyRegistered) {
      setShowPasskeyPrompt(true);
    } else {
      setActiveFlow(mode);
    }
  };

  const handleCheckOut = () => {
    if (!todayAttendance || todayAttendance.checkOutTime) return;
    setPendingMode("CHECKOUT");
    if (!user?.passkeyRegistered) {
      setShowPasskeyPrompt(true);
    } else {
      setShowCheckOut(true);
    }
  };

  const handlePasskeyRegistered = () => {
    updateUser({ passkeyRegistered: true });
    setShowPasskeyPrompt(false);
    toast.success("Passkey registered. You can now verify attendance with it.");
    if (pendingMode === "CHECKOUT") {
      setShowCheckOut(true);
    } else {
      setActiveFlow(pendingMode);
    }
  };

  const handleFlowSuccess = (attendance) => {
    setActiveFlow(null);
    setTodayAttendance(attendance);
    toast.success("Attendance registered successfully!");
    onAttendanceRegistered?.(attendance);
  };

  const handleCheckOutSuccess = (attendance) => {
    setShowCheckOut(false);
    setTodayAttendance(attendance);
    toast.success("Checked out successfully!");
    onAttendanceRegistered?.(attendance);
  };

  return (
    <>
      {todayAttendance && (
        <div className="today-status-banner success">
          <CheckCircle2 size={20} />
          <div className="flex-1">
            <strong>
              You're marked{" "}
              <StatusBadge
                status={todayAttendance.latenessStatus}
                insufficientHours={todayAttendance.insufficientHours}
              />{" "}
              today
            </strong>
            <div className="muted" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", marginTop: "4px" }}>
              <span>Checked in at</span>
              <CheckInTime
                time={todayAttendance.checkInTime}
                latenessStatus={todayAttendance.latenessStatus}
              />
              <span>· {todayAttendance.loginType === "OFFICE" ? "Office Login" : "Remote Login"}</span>
              {todayAttendance.checkOutTime && (
                <>
                  <span>· Checked out at {formatTime(todayAttendance.checkOutTime)}</span>
                  <span>· {formatMinutesAsHours(todayAttendance.totalWorkingMinutes)} worked</span>
                </>
              )}
            </div>
          </div>
          {!todayAttendance.checkOutTime && (
            <button type="button" className="btn btn-secondary btn-xs" onClick={handleCheckOut}>
              <LogOut size={14} /> Check Out
            </button>
          )}
        </div>
      )}

      <div className="attendance-option-grid">
        <div className="option-card">
          <div className="option-card-head">
            <div className="option-icon office">
              <Building2 size={22} />
            </div>
            <span className="option-pill">{OFFICE_LOCATION.radiusMeters}M RADIUS</span>
          </div>
          <h3>Office Login</h3>
          <p>Mark attendance from the office using secure passkey verification and office location.</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={!!todayAttendance}
            onClick={() => handleGiveAttendance("OFFICE")}
          >
            {todayAttendance ? "Already Marked" : "Give Attendance"}
          </button>
        </div>

        <div className="option-card">
          <div className="option-card-head">
            <div className="option-icon distance">
              <MapPinned size={22} />
            </div>
            <span className="option-pill warning">REASON REQUIRED</span>
          </div>
          <h3>Remote Login</h3>
          <p>Mark attendance remotely by providing a reason and verifying your identity.</p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={!!todayAttendance}
            onClick={() => handleGiveAttendance("DISTANCE")}
          >
            {todayAttendance ? "Already Marked" : "Give Attendance"}
          </button>
        </div>
      </div>

      <PasskeyRegistrationPrompt
        isOpen={showPasskeyPrompt}
        onClose={() => {
          setShowPasskeyPrompt(false);
          setPendingMode(null);
        }}
        onRegistered={handlePasskeyRegistered}
      />

      {activeFlow && (
        <AttendanceFlowModal
          mode={activeFlow}
          isOpen={!!activeFlow}
          onClose={() => setActiveFlow(null)}
          onSuccess={handleFlowSuccess}
        />
      )}

      {showCheckOut && (
        <CheckOutFlowModal
          isOpen={showCheckOut}
          onClose={() => setShowCheckOut(false)}
          onSuccess={handleCheckOutSuccess}
        />
      )}
    </>
  );
}
