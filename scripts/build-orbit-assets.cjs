// Re-encode generated originals without changing their artwork; originals stay untouched.
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs');
const path = require('node:path');
const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/build-orbit-assets.cjs <generated-image-directory> (requires sharp)');
const destination = path.resolve(__dirname, '../public/orbit');
const assets = {
  'orbit-hero-v1': 'exec-e7083f98-47ad-443c-b868-56311a22cd53.png',
  'orbit-charge-v1': 'exec-62f1b431-baf0-4543-b328-2ec01ccf6d72.png',
  'orbit-road-v1': 'exec-5acef9b3-ae9b-49f0-bca7-09a2d7db0f55.png',
  'orbit-care-v1': 'exec-b9152e59-458c-427c-92b3-b496acc874ea.png',
};
fs.mkdirSync(destination, { recursive: true });
Promise.all(Object.entries(assets).map(async ([name, file]) => {
  for (const width of [800, 1536]) {
    const output = path.join(destination, `${name}-${width}.webp`);
    await sharp(path.join(source, file)).resize({ width, withoutEnlargement: true }).webp({ quality: 84 }).toFile(output);
    console.log(path.basename(output), fs.statSync(output).size);
  }
})).catch((error) => { console.error(error.message); process.exitCode = 1; });
