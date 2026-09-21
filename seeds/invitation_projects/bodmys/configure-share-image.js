/** Apply the captured hero as this event's social sharing image. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const SEO_IMAGE = '/invitations/oliva/mayra-samuel-hero-share-v1.jpg';
const PREVIOUS_IMAGE = '/invitations/oliva/mayra-samuel-cover.png';

async function main() {
  const backendRoot = path.resolve(__dirname, '../../..');
  const asset = path.resolve(backendRoot, '../altezza/public', `.${SEO_IMAGE}`);
  fs.accessSync(asset);
  require('dotenv').config({ path: path.join(backendRoot, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo se permite una base local.');
  const db = await require('mysql2/promise').createConnection({ host,
    port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER,
    password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME, charset: 'utf8mb4',
  });
  try {
    await db.beginTransaction();
    const [[event]] = await db.query('SELECT nombre FROM evento WHERE id=? FOR UPDATE', ['bodmys']);
    const [[before]] = await db.query('SELECT templateKey, seoTitle, seoDescription, seoImage, published, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodmys']);
    if (!before || !['Mayra & Samuel', 'Mayra y Samuel'].includes(event?.nombre)) throw new Error('No se encontró el evento esperado.');
    if (before.seoImage === SEO_IMAGE) {
      await db.rollback();
      console.log('La captura del hero ya está configurada para compartir.');
      return;
    }
    if (before.seoImage !== PREVIOUS_IMAGE) throw new Error('La portada fue editada después; se conserva su configuración.');
    const backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'altezza-bodmys-share-image-')), 'config-before.json');
    fs.writeFileSync(backup, JSON.stringify(before, null, 2) + '\n', { mode: 0o600 });
    await db.query('UPDATE evento_invitacion_publica SET seoImage=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [SEO_IMAGE, 'bodmys']);
    const [[after]] = await db.query('SELECT templateKey, seoTitle, seoDescription, seoImage, published, modulesJson FROM evento_invitacion_publica WHERE idEvento=?', ['bodmys']);
    if (JSON.stringify(after) !== JSON.stringify({ ...before, seoImage: SEO_IMAGE })) throw new Error('La actualización afectó otros campos.');
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodmys', seoImage: SEO_IMAGE, backup, preserved: ['modulesJson', 'templateKey', 'seoTitle', 'seoDescription', 'published'] }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { SEO_IMAGE };
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
