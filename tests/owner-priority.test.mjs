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
  assert.match(appSource, /if \(!navigator\.permissions\?\.query\) \{\s*\/\/ Safari on iOS does not expose Permissions API\. Ask for the real location[\s\S]*?findFromCurrentLocation\(\);/);
  assert.match(appSource, /내 위치로 다시 찾기/);
  assert.match(appSource, /finishReject\(\{ code: 3 \}\), 25000\)/);
});

test('charging location does not silently use the Seoul default on Safari', () => {
  assert.match(appSource, /\/\/ Safari on iOS does not expose Permissions API\. Still request the browser's[\s\S]*?if \(!navigator\.permissions\?\.query\) \{[\s\S]*?findFromCurrentLocation\(\);/);
  assert.match(appSource, /A permission lookup can fail even when geolocation itself is available\.[\s\S]*?if \(active\) findFromCurrentLocation\(\);/);
});

test('Kakao directions use a fresh current location as the origin', () => {
  assert.match(appSource, /function kakaoDirectionsUrl\(origin, destination\)/);
  assert.match(appSource, /sName: '현재 위치'/);
  assert.match(appSource, /sX: String\(origin\.longitude\)/);
  assert.match(appSource, /sY: String\(origin\.latitude\)/);
  assert.match(appSource, /openKakaoDirections\(station, notify\)/);
  assert.match(appSource, /현재 위치에서 길찾기 시작/);
});

test('home readiness translates only received signals into a next action', () => {
  assert.match(ownerSource, /function readinessModel\(vehicle\)/);
  assert.match(ownerSource, /score: null/);
  assert.match(ownerSource, /현대차를 연결하면 출발 준비도를 확인할 수 있어요/);
  assert.match(ownerSource, /warningCount > 0 \? `경고 \$\{warningCount\}건 확인`/);
  assert.match(ownerSource, /배터리 \$\{battery\}% · 충전 권장/);
  assert.match(ownerSource, /점검 기준 미제공/);
  assert.match(ownerSource, /현대차에서 받은 신호 기준/);
});

test('care can prepare an honest service handoff brief without inventing diagnostics', () => {
  assert.match(appSource, /function ServiceHandoffBrief\(\{ vehicle, notify \}\)/);
  assert.match(appSource, /정비 방문 브리프/);
  assert.match(appSource, /공식 정비 이력·예약·진단 결과가 아닙니다/);
  assert.match(appSource, /navigator\.clipboard\?\.writeText/);
  assert.match(appSource, /navigator\.share\(\{ title: `\$\{vehicle\.name\} 정비 방문 브리프`/);
  assert.match(appSource, /<ServiceHandoffBrief vehicle=\{vehicle\} notify=\{notify\} \/>/);
});

test('care keeps a device-local vehicle signal timeline and compares only received values', () => {
  assert.match(appSource, /VEHICLE_SIGNAL_HISTORY_KEY = 'hyundai-life-pass:vehicle-signals:v1'/);
  assert.match(appSource, /function readVehicleSignalHistory\(vehicleId\)/);
  assert.match(appSource, /function buildVehicleSignalSnapshot\(vehicle\)/);
  assert.match(appSource, /function VehicleSignalTimeline\(\{ vehicle, actions, busy \}\)/);
  assert.match(appSource, /window\.localStorage\.setItem\(VEHICLE_SIGNAL_HISTORY_KEY/);
  assert.match(appSource, /signalDelta\(latest\?\.batterySoc, previous\?\.batterySoc, '%'\)/);
  assert.match(appSource, /최대 30회 · 오래된 기록부터 자동 정리/);
  assert.match(appSource, /공식 정비 이력·진단·주행 허가가 아니며, 미제공 값은 추정하지 않습니다/);
  assert.match(appSource, /<VehicleSignalTimeline vehicle=\{vehicle\} actions=\{actions\} busy=\{busy\} \/>/);
});

test('mobile browser back and forward keep the hash route in sync', () => {
  assert.match(appSource, /window\.addEventListener\('popstate', syncFromLocation\)/);
  assert.match(appSource, /window\.removeEventListener\('popstate', syncFromLocation\)/);
});

test('a sleeping API gets one automatic recovery attempt after the shell loads', () => {
  assert.match(appSource, /initialRetryScheduled = useRef\(false\)/);
  assert.match(appSource, /Promise\.allSettled\(\[refreshPlatform\(\), refreshVehicles\(\)\]\)/);
  assert.match(appSource, /4500\)/);
});
