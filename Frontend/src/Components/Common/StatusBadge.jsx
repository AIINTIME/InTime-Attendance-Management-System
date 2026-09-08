import { ATTENDANCE_STATUS } from "../../Utils/constants";

export default function StatusBadge({ status, insufficientHours }) {
  const meta = ATTENDANCE_STATUS[status] || { label: status, color: "neutral" };

  if (insufficientHours) {
    return (
      <span className="badge-group">
        <span className={`badge badge-${meta.color}`}>{meta.label}</span>
        <span className="badge badge-danger">Insufficient Hours</span>
      </span>
    );
  }

  return <span className={`badge badge-${meta.color}`}>{meta.label}</span>;
}
