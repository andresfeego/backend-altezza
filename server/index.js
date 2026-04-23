const path = require('path')

try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') })
} catch {}

const express = require('express')
const cors = require('cors')

const app = express()
app.use(cors())
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true }))

// Local/prod file serving for event assets
const DATA_ROOT = process.env.ALTEZZA_DATA_ROOT || path.resolve(__dirname, '../data/altezza')
const EVENTOS_DIR = process.env.ALTEZZA_EVENTOS_DIR || path.join(DATA_ROOT, 'images/eventos')
const EVENTOS_PUBLIC_PATH = (process.env.ALTEZZA_EVENTOS_PUBLIC_PATH || '/scrAppaltezza/images/eventos').replace(/\/$/, '')
const INVITATIONS_DIR = process.env.ALTEZZA_INVITATIONS_DIR || path.join(DATA_ROOT, 'invitations')
const INVITATIONS_PUBLIC_PATH = (process.env.ALTEZZA_INVITATIONS_PUBLIC_PATH || '/scrAppaltezza/invitations').replace(/\/$/, '')
const TEMPLATES_DIR = process.env.ALTEZZA_TEMPLATES_DIR || path.join(DATA_ROOT, 'templates')
const TEMPLATES_PUBLIC_PATH = (process.env.ALTEZZA_TEMPLATES_PUBLIC_PATH || '/scrAppaltezza/templates').replace(/\/$/, '')

app.use(EVENTOS_PUBLIC_PATH, express.static(path.resolve(EVENTOS_DIR), { etag: false, maxAge: 0 }))
app.use(INVITATIONS_PUBLIC_PATH, express.static(path.resolve(INVITATIONS_DIR), { etag: false, maxAge: 0 }))
app.use(TEMPLATES_PUBLIC_PATH, express.static(path.resolve(TEMPLATES_DIR), { etag: false, maxAge: 0 }))

const altezza = require('./routes/routesAltezza')
app.use('/api/responseAltezza', altezza)

app.get('/health', (req, res) => res.json({ ok: true }))

const port = Number(process.env.PORT || 3022)
app.listen(port, '0.0.0.0', () => {
  console.log(`[backend-altezza] listening on ${port}`)
})
