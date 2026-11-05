import { useSearchParams } from 'react-router-dom';
import { EMPTY_FILTERS, FILTERS } from '../domain/stock.js';
import { useMemo } from 'react';

export default function useStockFilters() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => Object.fromEntries(FILTERS.map(([key]) => [key, params.get(key) || EMPTY_FILTERS[key]])), [params]);
  const update = next => {
    const result = new URLSearchParams(params);
    result.delete('city');
    FILTERS.forEach(([key]) => { if (next[key]) result.set(key, next[key]); else result.delete(key); });
    setParams(result);
  };
  return [filters, update];
}