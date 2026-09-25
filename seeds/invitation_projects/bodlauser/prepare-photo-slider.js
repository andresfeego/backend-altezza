/** Delivery copies only: keep every original photo intact in photos/. */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

async function run() {
  const root = path.resolve(__dirname, '../../../_local_storage/invitations/bodlauser');
  const modules = JSON.parse(fs.readFileSync(path.join(__dirname, 'modules.json'), 'utf8'));
  const images = modules.find(module => module.type === 'image_slider_1')?.config.images || [];
  const delivery = path.join(root, 'image_slider_1');
  fs.mkdirSync(delivery, { recursive: true });
  for (const image of images) {
    const name = path.basename(image);
    if (!/^\d{3}\.webp$/.test(name)) throw new Error('Unexpected delivery photo name.');
    const source = path.join(root, 'photos', name.replace(/\.webp$/, '.jpeg'));
    await sharp(source).rotate().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 88 }).toFile(path.join(delivery, name));
  }
  console.log(`Prepared ${images.length} WebP delivery copies; originals untouched.`);
}
if (require.main === module) run().catch(error => { console.error(error.message); process.exitCode = 1; });
