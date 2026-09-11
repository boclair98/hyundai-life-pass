import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const appSource = await readFile(new URL('src/App.jsx', root), 'utf8');
const ownerSource = await readFile(new URL('src/OwnerExperience.jsx', root), 'utf8');

function idsFromDeclaration(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `${name} declaration should exist`);
  return [...match[1].matchAll(/id: '([^']+)'/g)].map((item) => item[1]);
}

test('default navigation keeps the owner daily path visible', () => {
  assert.deepEqual(idsFromDeclaration(appSource, 'primaryNavigation'), ['home', 'charge', 'care', 'passport']);
  assert.deepEqual(idsFromDeclaration(appSource, 'secondaryNavigation'), ['drive', 'settings']);
  assert.match(appSource, /primaryNavigation\.map\(\(\{ id, label, icon: Icon \}\)/);
  assert.match(appSource, /mobile-drawer-label/);
});

test('proposal and SDV lab screens are not part of the default consumer footer', () => {
  assert.match(appSource, /get\('lab'\) === '1'/);
  assert.match(appSource, /labMode && <><button onClick=\{\(\) => navigate\('proposal'\)\}/);
  assert.match(appSource, /labMode && <><button onClick=\{\(\) => navigate\('proposal'\)\}.*navigate\('canary'\)/s);
});

test('home shortcuts focus on charging, vehicle care, service and records', () => {
  const match = ownerSource.match(/const shortcuts = \[([\s\S]*?)\n  \];/);
  assert.ok(match, 'owner shortcuts should exist');
  assert.deepEqual([...match[1].matchAll(/label: '([^']+)'/g)].map((item) => item[1]), ['충전소 찾기', '차량 상태', '정비소 찾기', '관리 기록']);
  assert.doesNotMatch(match[1], /주행 계산|주차 위치/);
});

test('service-centre location follows the same consent-first behavior as charging', () => {
  assert.match(appSource, /navigator\.permissions\.query\(\{ name: 'geolocation' \}\)/g);
  assert.match(appSource, /if \(active && permission\.state === 'granted'\) findFromCurrentLocation\(\)/);
  assert.match(appSource, /내 위치로 다시 찾기/);
  assert.match(appSource, /finishReject\(\{ code: 3 \}\), 25000\)/);
});
