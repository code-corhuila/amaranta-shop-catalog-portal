import { describe, expect, it } from 'vitest';

/**
 * The rule Annex H builds the whole split on: the HTTP client and the session live in the shell, and only there. A portal
 * that makes its own client ends up with one more place that handles a token, and its requests leave with no token and no
 * correlation id, in silence. These read the source of the portal and fail the build if it breaks the rule.
 */
const files = import.meta.glob(['./**/*.ts', './**/*.tsx', '!./**/*.test.ts', '!./**/*.test.tsx', '!./test/**', '!./**/*.d.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Comments may explain the rule, so they are not what is checked. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const forbidden: [string, RegExp][] = [
  ['its own HTTP call (fetch)', /(^|[^.\w])fetch\s*\(/],
  ['its own HTTP call (XMLHttpRequest)', /XMLHttpRequest/],
  ['an HTTP library of its own', /from ['"](axios|ky|got|superagent|node-fetch)['"]/],
  ['a token handled here (Authorization / Bearer)', /Authorization|Bearer/],
  ['browser storage, where a token could be kept', /localStorage|sessionStorage|document\.cookie/],
  ['the address of the gateway', /localhost:8000|\/\/gateway/],
  ['an internal route of a service', /\/internal\//],
];

describe('the portal obeys the rule of the shell (Annex H)', () => {
  it('has source files to check', () => {
    expect(Object.keys(files).length).toBeGreaterThan(5);
  });

  it.each(forbidden)('contains no %s', (_name, pattern) => {
    const offenders = Object.entries(files)
      .filter(([, source]) => pattern.test(code(source)))
      .map(([path]) => path);
    expect(offenders).toEqual([]);
  });

  it('reaches the API only through shell/apiClient', () => {
    const users = Object.entries(files)
      .filter(([, source]) => /\/api\/v1\//.test(code(source)))
      .map(([path]) => path);
    expect(users).toEqual(['./catalog/api/catalogApi.ts']);
    expect(code(files['./catalog/api/catalogApi.ts'] ?? '')).toContain("from 'shell/apiClient'");
  });
});
