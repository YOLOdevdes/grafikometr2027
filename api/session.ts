import { isAuthed, json, route, sessionCookie } from './_lib.js'

/** GET → czy zalogowany; przy okazji przedłuża sesję o godzinę (aplikacja woła to, gdy użytkownik jest aktywny). */
export const GET = route(async req => {
  if (!isAuthed(req)) return json({ authed: false })
  return json({ authed: true }, 200, { 'set-cookie': sessionCookie() })
})
