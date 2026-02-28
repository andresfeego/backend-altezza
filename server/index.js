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

const altezza = require('./routes/routesAltezza')
app.use('/api/responseAltezza', altezza)

app.get('/health', (req, res) => res.json({ ok: true }))

const port = Number(process.env.PORT || 3022)
app.listen(port, '0.0.0.0', () => {
  console.log(`[backend-altezza] listening on ${port}`)
})
