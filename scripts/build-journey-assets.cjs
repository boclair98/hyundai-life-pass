// Responsive delivery variants only; generated artwork is not altered or cropped.
const sharp = require(process.env.SHARP_MODULE || 'sharp');
const fs = require('node:fs');
const path = require('node:path');
const source = process.argv[2];
if (!source) throw new Error('Pass the generated image directory.');
const assets = {
  charge: 'exec-5bcb7ae3-2991-4cea-81ca-2172d9d24b25.png',
  battery: 'exec-db8cc57a-d6a7-4418-a307-f9862c68d435.png',
  tires: 'exec-f33bd11c-d984-41a8-aacf-cf8cb4796d60.png',
  road: 'exec-f3a074dd-98bf-41b4-aa28-df602dc34c91.png',
  parking: 'exec-23b976d9-2572-4ceb-aefe-92f2b8f0099f.png',
  care: 'exec-5d3a2e2d-19fb-4c77-8c7b-df2039239d9a.png',
  journal: 'exec-59354583-78f9-4112-83fc-be136faf98c8.png',
  connect: 'exec-319f35d9-a973-4bd4-991d-b0fa3068aead.png',
};
const dest = path.resolve(__dirname, '../public/journey');
fs.mkdirSync(dest, { recursive: true });
Promise.all(Object.entries(assets).map(async ([name, original]) => {
  for (const width of [800, 1536]) {
    const output = path.join(dest, `${name}-v1-${width}.webp`);
    if (fs.existsSync(output)) throw new Error(`Refusing to overwrite ${output}`);
    await sharp(path.join(source, original)).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(output);
    console.log(path.basename(output), fs.statSync(output).size);
  }
})).catch((error) => { console.error(error.message); process.exitCode = 1; });
