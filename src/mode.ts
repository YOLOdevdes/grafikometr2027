/**
 * Tryb aplikacji wynika z adresu:
 *   /p/<token>  → publiczny podgląd (tylko odczyt, dane z serwera, osobna baza w przeglądarce)
 *   reszta      → edycja po zalogowaniu
 */
const m = typeof location !== 'undefined' ? location.pathname.match(/^\/p\/([A-Za-z0-9_-]{8,})\/?$/) : null

export const PREVIEW_TOKEN: string | null = m?.[1] ?? null
export const READ_ONLY = PREVIEW_TOKEN !== null
