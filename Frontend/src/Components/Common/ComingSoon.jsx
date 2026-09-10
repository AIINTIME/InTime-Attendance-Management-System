import { Sparkles } from "lucide-react";

export default function ComingSoon({ icon: Icon = Sparkles, title, message }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        minHeight: "60vh",
        gap: 16,
        padding: "24px",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: "50%",
          background: "#E0EFFF",
          color: "#0074F1",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={32} strokeWidth={1.8} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", margin: 0 }}>{title}</h2>
      <p style={{ fontSize: 14, color: "#64748B", maxWidth: 380, margin: 0, lineHeight: 1.6 }}>
        {message || "This feature is under construction and will be available soon."}
      </p>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "5px 14px",
          borderRadius: 999,
          background: "#F1F5F9",
          color: "#475569",
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        Coming Soon
      </span>
    </div>
  );
}
