export default function DataTable({ title, subtitle, columns, rows, badge, emptyMessage = 'Aucun résultat pour cette recherche.' }) {
  return (
    <section className="panel table-panel">
      <div className="panel__head">
        <div><p className="eyebrow">Détail</p><h2>{title}</h2><p className="panel__subtitle">{subtitle}</p></div>
        {badge && <span className="count-badge">{badge}</span>}
      </div>
      {rows.length === 0 ? (
        <div className="table-empty" role="status">{emptyMessage}</div>
      ) : (
        <div className="table-scroll">
          <table>
            <thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={row.id || row.name || rowIndex}>
                  {columns.map((column) => <td key={column.key} className={column.numeric ? 'numeric' : ''}>{column.render ? column.render(row[column.key], row) : (column.numeric ? Number(row[column.key]).toLocaleString('fr-FR') : row[column.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
