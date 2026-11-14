import { CATEGORIES, type CategoryValue } from '../model/filters';

interface Props {
  readonly q: string;
  readonly category: CategoryValue | null;
  readonly active: boolean;
  readonly onChange: (next: { q: string; category: CategoryValue | null }) => void;
  readonly onClear: () => void;
}

/** The search and the category of the catalog. It lives in the address, so a filtered view can be shared and survives a reload. */
export function FilterBar({ q, category, active, onChange, onClear }: Props) {
  return (
    <form className="filter-bar" role="search" aria-label="Filtrar el catálogo" onSubmit={(event) => event.preventDefault()}>
      <div className="field">
        <label htmlFor="filter-q">Buscar</label>
        <input id="filter-q" type="search" value={q} onChange={(event) => onChange({ q: event.target.value, category })} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="filter-category">Categoría</label>
        <select
          id="filter-category"
          value={category ?? ''}
          onChange={(event) => onChange({ q, category: CATEGORIES.find((c) => c.value === event.target.value)?.value ?? null })}
        >
          <option value="">Todas</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      {active && (
        <button type="button" onClick={onClear}>
          Quitar filtros
        </button>
      )}
    </form>
  );
}
