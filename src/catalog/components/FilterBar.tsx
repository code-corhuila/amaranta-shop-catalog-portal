import { CATEGORIES, type CategoryValue } from '../model/filters';

interface Props {
  readonly q: string;
  readonly category: CategoryValue | null;
  readonly active: boolean;
  readonly onChange: (next: { q: string; category: CategoryValue | null }) => void;
  readonly onClear: () => void;
}

/** A small picture for each category, drawn beside its name. It is decoration: the name says the same, so it is hidden from a screen reader. */
const CATEGORY_ICON: Record<CategoryValue, string> = {
  FOOD: '🍖',
  ACCESSORIES: '🎀',
  HYGIENE: '🧼',
  MEDICATION: '💊',
  TOYS: '🎾',
};

/**
 * The search and the categories of the catalog. Every category is a button that is always in sight, so choosing one is a single
 * click and the person sees all there is; the one chosen is marked with `aria-pressed`. It lives in the address, so a filtered view
 * can be shared and survives a reload.
 */
export function FilterBar({ q, category, active, onChange, onClear }: Props) {
  return (
    <form className="filter-bar" role="search" aria-label="Filtrar el catálogo" onSubmit={(event) => event.preventDefault()}>
      <div className="search-field">
        <label htmlFor="filter-q" className="sr-only">
          Buscar
        </label>
        <input
          id="filter-q"
          type="search"
          value={q}
          placeholder="Busca por nombre o descripción"
          onChange={(event) => onChange({ q: event.target.value, category })}
          autoComplete="off"
        />
      </div>
      <div className="category-chips" role="group" aria-label="Categoría">
        <button type="button" className="chip-filter" aria-pressed={category === null} onClick={() => onChange({ q, category: null })}>
          Todas
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.value} type="button" className="chip-filter" aria-pressed={category === c.value} onClick={() => onChange({ q, category: c.value })}>
            <span aria-hidden="true">{CATEGORY_ICON[c.value]}</span>
            {c.label}
          </button>
        ))}
        {active && (
          <button type="button" className="chip-clear" onClick={onClear}>
            Quitar filtros
          </button>
        )}
      </div>
    </form>
  );
}
