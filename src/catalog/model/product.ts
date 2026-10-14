// The types of the portal reflect the contract of catalog-api with the SAME field names (Annex H, rule 2).

export interface Product {
  readonly id: string;
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly category: string;
  /** Whole pesos. An integer: the portal never multiplies or divides money. */
  readonly price: number;
  /** What the service already formatted, e.g. "$ 189.000". The portal shows it as it comes. */
  readonly priceFormatted: string;
  readonly stockQuantity: number;
  readonly inStock: boolean;
  readonly imageUrl: string | null;
}

export interface PageMeta {
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

/** A page of anything the services list: `{data, meta}`. */
export interface Page<T> {
  readonly data: readonly T[];
  readonly meta: PageMeta;
}
