export default function TopHolders({ holders }) {
  return (
    <section className="panel">
      <div className="panel__heading">
        <div>
          <span className="eyebrow">Détention</span>
          <h2>Principaux détenteurs</h2>
        </div>
      </div>
      <div className="holder-list">
        {holders.map((holder, index) => (
          <div className="holder-list__item" key={`${holder.name}-${index}`}>
            <div className="rank">{String(index + 1).padStart(2, '0')}</div>
            <div className="holder-list__identity">
              <strong>{holder.name}</strong>
              <span>{holder.type} · {holder.region}</span>
            </div>
            <strong className="holder-list__value">{holder.value.toLocaleString('fr-FR')}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}
