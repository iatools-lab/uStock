export default function Logo({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="upOwa">
      <span className="brand__up">up</span>
      <span className="brand__o">O</span>
      <span className="brand__wa">wa</span>
      {!compact && <span className="brand__tagline">Tracking & pilotage</span>}
    </div>
  );
}
