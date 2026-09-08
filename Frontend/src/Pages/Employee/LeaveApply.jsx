import { CalendarClock } from "lucide-react";
import EmptyState from "../../Components/Common/EmptyState";

export default function LeaveApply() {
  return (
    <div className="page-stack">
      <div className="page-heading">
        <h2>Leave Apply</h2>
        <p className="muted">Request and track time off.</p>
      </div>

      <div className="card">
        <EmptyState
          icon={CalendarClock}
          title="Leave management is coming soon"
          message="Applying for leave isn't available yet. Contact your administrator for now if you need time off."
        />
      </div>
    </div>
  );
}
