/**
 * Tryb aplikacji wynika z adresu:
 *   /podglad (oraz stare linki /p/<kod>) → publiczny podgląd: tylko odczyt, bez logowania,
 *                                          dane z serwera, osobna baza w przeglądarce
 *   reszta                               → edycja po zalogowaniu
 */
export const PREVIEW_PATH = '/podglad'

const path = typeof location !== 'undefined' ? location.pathname : ''
export const READ_ONLY = /^\/podglad\/?$/.test(path) || /^\/p\/[A-Za-z0-9_-]+\/?$/.test(path)
