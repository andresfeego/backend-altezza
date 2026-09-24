/** Flatten the supplied photo folders without altering any original image bytes. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const eventRoot = path.resolve(__dirname, '../../../_local_storage/invitations/bodlauser');
const root = path.join(eventRoot, 'photos');
const manifestPath = path.join(eventRoot, 'photos-manifest.json');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const file = path.join(dir, item.name);
    if (item.isSymbolicLink()) throw new Error('Unexpected symbolic link in photos.');
    return item.isDirectory() ? walk(file) : [file];
  });
}

function run() {
  if (fs.existsSync(manifestPath)) {
    const saved = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const photo of saved.photos) {
      if (hash(path.join(root, photo.file)) !== photo.sha256) throw new Error(`Photo verification failed: ${photo.file}`);
    }
    console.log(JSON.stringify({ alreadyOrganized: true, photos: saved.photos.length, selected: saved.selected }));
    return;
  }
  const files = walk(root);
  const photos = files.filter(file => /\.(jpe?g|png|webp|heic)$/i.test(file)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const zips = files.filter(file => /\.zip$/i.test(file));
  if (photos.length < 7) throw new Error('At least seven photos are required.');
  const manifest = {
    photos: photos.map((file, index) => ({ original: path.relative(root, file), file: `${String(index + 1).padStart(3, '0')}${path.extname(file).toLowerCase()}`, sha256: hash(file) })),
    removedZips: zips.map(file => path.relative(root, file)),
  };
  const shuffled = [...new Map(manifest.photos.map(photo => [photo.sha256, photo.file])).values()];
  if (shuffled.length < 7) throw new Error('At least seven distinct photos are required.');
  for (let i = shuffled.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  manifest.selected = shuffled.slice(0, 7);
  // Persist the complete mapping before moving; refuse to overwrite any root photo.
  for (const photo of manifest.photos) if (fs.existsSync(path.join(root, photo.file))) throw new Error(`Destination already exists: ${photo.file}`);
  const pending = `${manifestPath}.pending`;
  fs.writeFileSync(pending, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  const moved = [];
  try {
    for (const photo of manifest.photos) {
      fs.renameSync(path.join(root, photo.original), path.join(root, photo.file));
      moved.push(photo);
    }
    for (const photo of manifest.photos) if (hash(path.join(root, photo.file)) !== photo.sha256) throw new Error('Original bytes changed.');
  } catch (error) {
    for (const photo of moved.reverse()) fs.renameSync(path.join(root, photo.file), path.join(root, photo.original));
    fs.unlinkSync(pending);
    throw error;
  }
  fs.renameSync(pending, manifestPath);
  // Explicitly requested deletion, limited to the ZIP files in this photo collection.
  for (const zip of zips) fs.unlinkSync(zip);
  const emptyDirectories = dir => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const child = path.join(dir, item.name);
      emptyDirectories(child);
      if (!fs.readdirSync(child).length) fs.rmdirSync(child);
    }
  };
  emptyDirectories(root);
  console.log(JSON.stringify({ photos: manifest.photos.length, deletedZips: zips.length, selected: manifest.selected, manifestPath }));
}
if (require.main === module) run();
module.exports = { run };
