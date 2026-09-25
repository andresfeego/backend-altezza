const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

function configurePhotos(modules, config) {
  if (!Array.isArray(config?.images) || !config.images.length || config.images.some(image => typeof image !== 'string' || !image.trim()) || new Set(config.images).size !== config.images.length) throw new Error('Se requieren fotos distintas con rutas válidas.');
  const sorted = [...modules].sort((a, b) => a.order - b.order);
  const existing = sorted.filter(module => module.type === 'image_slider_1');
  if (existing.length > 1) throw new Error('Slider duplicado.');
  const next = sorted.filter(module => module.type !== 'image_slider_1');
  const quote = next.findIndex(module => module.type === 'biblical_quote');
  const passage = quote >= 0 ? quote : next.findIndex(module => module.type === 'welcome_message');
  if (passage < 0) throw new Error('Frase ausente.');
  next.splice(passage + 1, 0, { ...existing[0], type: 'image_slider_1', enabled: true, config: { ...existing[0]?.config, ...config } });
  return next.map((module, index) => ({ ...module, order: index + 1 }));
}

async function run() {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo base local.');
  const db = await require('mysql2/promise').createConnection({ host, port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER, password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME });
  try {
    await db.beginTransaction();
    const [events] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(events[0]?.nombre)) throw new Error('Identidad incorrecta.');
    const [rows] = await db.query('SELECT templateKey, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (rows.length !== 1 || rows[0].templateKey !== 'wedding_lemoncello') throw new Error('Plantilla incorrecta.');
    const before = typeof rows[0].modulesJson === 'string' ? rows[0].modulesJson : JSON.stringify(rows[0].modulesJson);
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8')).find(module => module.type === 'image_slider_1')?.config;
    const next = configurePhotos(JSON.parse(before), config);
    if (JSON.stringify(JSON.parse(before)) !== JSON.stringify(next)) {
      const backup = path.join(os.tmpdir(), `bodlauser-before-photos-${Date.now()}.json`);
      fs.writeFileSync(backup, before, { mode: 0o600 });
      await db.query('UPDATE evento_invitacion_publica SET modulesJson=?,updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [JSON.stringify(next), 'bodlauser']);
      console.log('Backup:', backup);
    }
    await db.commit();
    console.log(JSON.stringify({ event: 'bodlauser', modules: next.map(({ type, order }) => ({ type, order })), photos: config.images.length }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
module.exports = { configurePhotos };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
