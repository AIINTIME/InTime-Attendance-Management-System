import { formatTime } from "../../Utils/dateUtils";

export const LATENESS_CRITERIA_CONFIG = {
  ON_TIME: {
    label: "On Time",
    dotClass: "dot-green",
    hex: "#10B981",
    badgeClass: "badge-ontime",
  },
  SLIGHT_LATE: {
    label: "Slight Late",
    dotClass: "dot-blue",
    hex: "#2563EB",
    badgeClass: "badge-slightlate",
  },
  LATE: {
    label: "Late",
    dotClass: "dot-orange",
    hex: "#F97316",
    badgeClass: "badge-late",
  },
  VERY_LATE: {
    label: "Very Late",
    dotClass: "dot-red",
    hex: "#EF4444",
    badgeClass: "badge-verylate",
  },
};

export function getLatenessCriteria(status) {
  if (!status) return LATENESS_CRITERIA_CONFIG.ON_TIME;
  return LATENESS_CRITERIA_CONFIG[status] || LATENESS_CRITERIA_CONFIG.ON_TIME;
}

/**
 * CheckInTime component renders check-in time with a colored status dot
 * aligned with the Organization's Late Status Criteria:
 * - On Time: Green (#10B981)
 * - Slight Late: Blue (#2563EB)
 * - Late: Orange (#F97316)
 * - Very Late: Red (#EF4444)
 */
export default function CheckInTime({
  time,
  latenessStatus,
  showLabel = false,
  className = "",
}) {
  if (!time) {
    return <span className="checkin-time-empty">—</span>;
  }

  const criteria = getLatenessCriteria(latenessStatus);

  return (
    <span
      className={`checkin-time-badge-wrap ${className}`}
      title={`${formatTime(time)} (${criteria.label})`}
    >
      <span
        className={`checkin-status-dot ${criteria.dotClass}`}
        aria-label={criteria.label}
      />
      <span className="checkin-time-val">{formatTime(time)}</span>
      {showLabel && (
        <span className={`checkin-status-tag ${criteria.badgeClass}`}>
          {criteria.label}
        </span>
      )}
    </span>
  );
}
