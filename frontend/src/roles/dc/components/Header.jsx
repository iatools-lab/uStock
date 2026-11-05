import { Bell, Search } from 'lucide-react';
import { useState } from 'react';

export default function Header({ title, subtitle, role, lastSync, onSearch, searchPlaceholder = 'Rechercher un acteur...' }) {
  const [searchValue, setSearchValue] = useState('');

  const submit = (event) => {
    event.preventDefault();
    if (onSearch) onSearch(searchValue);
  };

  return (
    <header className="topbar">
      <div>
        <p className="page-kicker">{role}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      <div className="topbar__actions">
        {onSearch && (
          <form className="global-search" onSubmit={submit}>
            <Search size={16} />
            <input
              value={searchValue}
              onChange={(event) => {
                const value = event.target.value;
                setSearchValue(value);
                onSearch(value);
              }}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
            <kbd>Entrée</kbd>
          </form>
        )}
        <div className="sync-chip"><i /> UPYA <strong>Synchronisé</strong><span>{lastSync}</span></div>
        <button className="icon-button" type="button" aria-label="Notifications"><Bell size={17} /></button>
      </div>
    </header>
  );
}
