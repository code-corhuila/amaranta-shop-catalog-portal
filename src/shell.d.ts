// What the shell lends to every portal (Annex H): the ONE HTTP client, already wired to the gateway and the session.
// It is loaded at run time through Module Federation; its types are written here because its code is not in this repository.
// A portal never calls `fetch` against the API and never handles a token: it asks for `/api/v1/...` through this.
declare module 'shell/apiClient' {
  export interface ShellApiResponse<T> {
    readonly status: number;
    readonly data: T;
    readonly location: string | null;
  }

  export interface ShellRequestOptions {
    /** A newer request cancels the older one with this, so the answer that arrives last cannot win. */
    readonly signal?: AbortSignal;
    /** One per intention, reused when the same intention is retried. */
    readonly idempotencyKey?: string;
  }

  export interface ShellApiClient {
    get<T = unknown>(path: string, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    post<T = unknown>(path: string, body?: unknown, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    put<T = unknown>(path: string, body?: unknown, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    patch<T = unknown>(path: string, body?: unknown, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
    delete<T = unknown>(path: string, options?: ShellRequestOptions): Promise<ShellApiResponse<T>>;
  }

  export const apiClient: ShellApiClient;
}
