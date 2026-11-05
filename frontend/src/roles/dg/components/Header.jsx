import { Bell, Cloud, RefreshCw, Search } from 'lucide-react';
import { useState } from 'react';

export default function Header({
  meta,
  onSearch,
  title = 'Tableau de bord Directeur Général',
  subtitle = 'Vue consolidée du stock upOwa issue d’UPYA.',
  kicker = 'Tracking national',
  searchPlaceholder = 'Rechercher un kit…'
}) {
  const [searchValue, setSearchValue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (onSearch) onSearch(searchValue);
  };

  return (
    <header className="topbar">
      <div>
        <p className="page-kicker">{kicker}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div className="topbar__actions">
        {onSearch && (
          <form className="global-search" onSubmit={submit}>
            <Search size={18} />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
            <kbd>Entrée</kbd>
          </form>
        )}
        <div className="sync-chip" title={`Dernière synchronisation : ${meta.lastSync}`}>
          <Cloud size={16} />
          <span>{meta.apiSource}</span>
          <i />
          <strong>{meta.syncStatus}</strong>
        </div>
        <button type="button" className="icon-button" aria-label="Actualiser"><RefreshCw size={18} /></button>
        <button type="button" className="icon-button" aria-label="Notifications"><Bell size={18} /></button>
      </div>
    </header>
  );
}
