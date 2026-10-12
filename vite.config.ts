import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Lokalnie (npm run dev) obsługuje /api/* tymi samymi handlerami co Vercel,
 * z magazynem w pliku .data/store.json zamiast Redisa. Zmienne z .env.local.
 */
function devApi(): Plugin {
  return {
    name: 'grafikometr-dev-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
        if (!url.pathname.startsWith('/api/')) return next()
        const name = url.pathname.slice(5)
        if (!/^[a-z]+$/.test(name)) return void ((res.statusCode = 404), res.end())
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.ts`)
          const handler = mod[req.method ?? 'GET'] as ((r: Request) => Promise<Response>) | undefined
          if (!handler) return void ((res.statusCode = 405), res.end())
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
          const out = await handler(new Request(url, { method: req.method, headers, body: hasBody ? Buffer.concat(chunks) : undefined }))
          res.statusCode = out.status
          out.headers.forEach((v, k) => k !== 'set-cookie' && res.setHeader(k, v))
          const cookies = out.headers.getSetCookie()
          if (cookies.length) res.setHeader('set-cookie', cookies)
          res.end(Buffer.from(await out.arrayBuffer()))
        } catch (e) {
          if (e instanceof Error && /Failed to load url/.test(e.message)) return void ((res.statusCode = 404), res.end())
          next(e)
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // handlery API czytają process.env — w dev ładujemy tam .env / .env.local
  Object.assign(process.env, { GM_DEV_STORE: '.data/store.json' }, loadEnv(mode, process.cwd(), ''))
  return {
    plugins: [react(), devApi()],
    server: { port: 5178 },
  }
})
