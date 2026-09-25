/** Configure the captured Hero for sharing and the event list, without changing the invitation. */
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const IMAGE_NAME = 'laura-sergio-hero-share-square-v2.jpg';
const SEO_IMAGE = `/scrAppaltezza/invitations/bodlauser/cover/${IMAGE_NAME}`;
const EVENT_IMAGE = `/bodlauser/datos_evento/${IMAGE_NAME}`;
const PREVIOUS_SEO_IMAGE = '/scrAppaltezza/invitations/bodlauser/cover/laura-sergio-hero-share-v1.jpg';
const PREVIOUS_EVENT_IMAGE = '/bodlauser/datos_evento/laura-sergio-hero-share-v1.jpg';

async function run() {
  const root = path.resolve(__dirname, '../../..');
  require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
  const host = process.env.ALTEZZA_DB_HOST || '127.0.0.1';
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) throw new Error('Solo base local.');
  const storage = process.env.ALTEZZA_DATA_ROOT || path.join(root, '_local_storage');
  const cover = path.join(process.env.ALTEZZA_INVITATIONS_DIR || path.join(storage, 'invitations'), 'bodlauser/cover', IMAGE_NAME);
  const eventCopy = path.join(process.env.ALTEZZA_EVENTOS_DIR || path.join(storage, 'images/eventos'), EVENT_IMAGE);
  const image = fs.readFileSync(cover);
  if (!image.equals(fs.readFileSync(eventCopy))) throw new Error('Las dos copias de la captura deben ser idénticas.');
  const metadata = await require('sharp')(image).metadata();
  if (metadata.width !== 1200 || metadata.height !== 1200 || metadata.format !== 'jpeg') throw new Error('La portada debe ser JPEG de 1200 × 1200.');
  const db = await require('mysql2/promise').createConnection({ host,
    port: Number(process.env.ALTEZZA_DB_PORT || 3306), user: process.env.ALTEZZA_DB_USER,
    password: process.env.ALTEZZA_DB_PASS, database: process.env.ALTEZZA_DB_NAME,
  });
  try {
    await db.beginTransaction();
    const [[event]] = await db.query('SELECT * FROM evento WHERE id=? FOR UPDATE', ['bodlauser']);
    const [[config]] = await db.query('SELECT templateKey, seoTitle, seoDescription, seoImage, published, modulesJson FROM evento_invitacion_publica WHERE idEvento=? FOR UPDATE', ['bodlauser']);
    if (!['Laura & Sergio', 'Laura y Sergio'].includes(event?.nombre) || config?.templateKey !== 'wedding_lemoncello') throw new Error('Identidad o plantilla incorrecta.');
    if (![null, '', EVENT_IMAGE, PREVIOUS_EVENT_IMAGE].includes(event.imagenPrincipal) || ![null, '', SEO_IMAGE, PREVIOUS_SEO_IMAGE].includes(config.seoImage)) throw new Error('La portada fue modificada; se conserva su configuración.');
    let backup = null;
    if (event.imagenPrincipal !== EVENT_IMAGE || config.seoImage !== SEO_IMAGE) {
      backup = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'bodlauser-share-image-')), 'before.json');
      fs.writeFileSync(backup, JSON.stringify({ event, config }, null, 2) + '\n', { mode: 0o600 });
      await db.query('UPDATE evento SET imagenPrincipal=? WHERE id=?', [EVENT_IMAGE, 'bodlauser']);
      await db.query('UPDATE evento_invitacion_publica SET seoImage=?, updatedAt=CURRENT_TIMESTAMP WHERE idEvento=?', [SEO_IMAGE, 'bodlauser']);
    }
    const [[afterEvent]] = await db.query('SELECT * FROM evento WHERE id=?', ['bodlauser']);
    const [[afterConfig]] = await db.query('SELECT templateKey, seoTitle, seoDescription, seoImage, published, modulesJson FROM evento_invitacion_publica WHERE idEvento=?', ['bodlauser']);
    if (JSON.stringify(afterEvent) !== JSON.stringify({ ...event, imagenPrincipal: EVENT_IMAGE }) ||
        JSON.stringify(afterConfig) !== JSON.stringify({ ...config, seoImage: SEO_IMAGE })) throw new Error('Se modificaron campos ajenos a las portadas.');
    await db.commit();
    console.log(JSON.stringify({ eventId: 'bodlauser', seoImage: SEO_IMAGE, imagenPrincipal: EVENT_IMAGE, backup }, null, 2));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}

module.exports = { SEO_IMAGE, EVENT_IMAGE, run };
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
