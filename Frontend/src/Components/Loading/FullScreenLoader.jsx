export default function FullScreenLoader({ label = "Loading…" }) {
  return (
    <div className="full-screen-loader">
      <div className="spinner" />
      <p>{label}</p>
    </div>
  );
}
