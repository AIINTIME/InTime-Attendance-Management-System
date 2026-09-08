import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const certPath = path.join(dirname, '.cert', 'cert.pem')
const keyPath = path.join(dirname, '.cert', 'key.pem')

// Local HTTPS via mkcert (see README "WebAuthn / Passkey Setup"): passkeys
// need a secure context, and a plain LAN IP over http:// never qualifies,
// even on `npm run dev -- --host`. When Frontend/.cert/{cert,key}.pem exist
// (generated with `mkcert -key-file .cert/key.pem -cert-file .cert/cert.pem
// localhost 127.0.0.1 ::1 <your LAN IP>`), the dev server serves HTTPS
// instead of HTTP so passkeys work over the LAN too, not just through a
// tunnel. Falls back to plain HTTP automatically if the cert isn't there.
const httpsConfig =
  fs.existsSync(certPath) && fs.existsSync(keyPath)
    ? { cert: fs.readFileSync(certPath), key: fs.readFileSync(keyPath) }
    : undefined

// Serves the mkcert root CA (Frontend/public/mkcert-root-ca.crt) with the
// headers a phone browser actually needs to hand it off to the OS's
// certificate installer. Vite's static file serving sends no Content-Type
// for an unrecognized extension and no Content-Disposition, so Chrome just
// renders the PEM as plain text instead of downloading + installing it.
function mkcertDownloadHeaders() {
  return {
    name: 'mkcert-download-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] === '/mkcert-root-ca.crt') {
          res.setHeader('Content-Type', 'application/x-x509-ca-cert')
          res.setHeader('Content-Disposition', 'attachment; filename="mkcert-root-ca.crt"')
        }
        next()
      })
    },
  }
}

// Proxying /api and /uploads to the backend means the browser always talks
// to "whatever host is serving the frontend" (localhost, or a LAN IP when
// running `npm run dev -- --host`) on a single origin -- no CORS preflight,
// and auth cookies are set as same-origin instead of needing cross-site
// cookie config. Set VITE_API_URL to an absolute URL only for a production
// build served from a different origin than the API.
export default defineConfig({
  plugins: [react(), mkcertDownloadHeaders()],
  server: {
    https: httpsConfig,
    // Allows Vite's dev server to accept requests through a tunnel host
    // (ngrok/Cloudflare Tunnel/etc, which use random-looking hostnames) --
    // dev-only convenience, not something a production build needs.
    allowedHosts: true,
    proxy: {
      '/api': { target: 'http://localhost:5055', changeOrigin: true, secure: false },
      '/uploads': { target: 'http://localhost:5055', changeOrigin: true, secure: false },
    },
  },
})
