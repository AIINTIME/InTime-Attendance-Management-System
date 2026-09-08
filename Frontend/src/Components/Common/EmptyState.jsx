import { Inbox } from "lucide-react";

export default function EmptyState({ icon: Icon = Inbox, title, message }) {
  return (
    <div className="empty-state">
      <Icon size={36} strokeWidth={1.5} />
      <h4>{title}</h4>
      {message && <p>{message}</p>}
    </div>
  );
}
