import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));

test('all twelve scene destinations have both valid WebP delivery variants', () => {
  const source = readFileSync(`${root}src/MobilityBackdrop.jsx`, 'utf8');
  const assets = [...source.matchAll(/asset: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(new Set(assets).size, 12);
  for (const asset of assets) for (const width of [800, 1536]) {
    const bytes = readFileSync(`${root}public${asset}-${width}.webp`);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.ok(bytes.length > 1000);
  }
});

test('the eight active journey illustrations stay within a two megabyte combined delivery budget', () => {
  const source = readFileSync(`${root}src/MobilityBackdrop.jsx`, 'utf8');
  const activeAssets = [...source.matchAll(/asset: '(\/journey\/[^']+)'/g)].map((match) => match[1].split('/').pop());
  assert.equal(new Set(activeAssets).size, 8);
  const dir = `${root}public/journey`;
  const files = readdirSync(dir).filter((name) => name.endsWith('.webp'));
  const activeFiles = activeAssets.flatMap((asset) => [800, 1536].map((width) => `${asset}-${width}.webp`));
  assert.deepEqual(files.sort(), activeFiles.sort());
  assert.ok(activeFiles.reduce((bytes, name) => bytes + statSync(`${dir}/${name}`).size, 0) < 2_000_000);
});
