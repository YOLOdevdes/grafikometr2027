import { HttpError, checkPassword, clientIp, json, route, sessionCookie, store } from './_lib.js'

const MAX_FAILS = 10 // po tylu błędnych próbach z jednego IP…
const LOCK_S = 15 * 60 // …blokada na 15 minut

/** POST { password } → ustawia ciasteczko sesji. */
export const POST = route(async req => {
  const key = `gm:fail:${clientIp(req)}`
  if (Number(await store.get(key)) >= MAX_FAILS) throw new HttpError(429, 'Za dużo prób — spróbuj za kwadrans')
  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown }
  if (typeof password !== 'string' || !checkPassword(password)) {
    await store.hit(key, LOCK_S)
    await new Promise(r => setTimeout(r, 600)) // spowalnia zgadywanie
    throw new HttpError(401, 'Złe hasło')
  }
  await store.del(key)
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie() })
})
