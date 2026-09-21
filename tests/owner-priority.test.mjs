import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const appSource = await readFile(new URL('src/App.jsx', root), 'utf8');
const ownerSource = await readFile(new URL('src/OwnerExperience.jsx', root), 'utf8');
const vehicleProfileSource = await readFile(new URL('src/vehicleProfile.js', root), 'utf8');
const monetizationPlanSource = await readFile(new URL('docs/MONETIZATION_PLAN.md', root), 'utf8');

function idsFromDeclaration(source, name) {
  const match = source.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\n\\];`));
  assert.ok(match, `${name} declaration should exist`);
  return [...match[1].matchAll(/id: '([^']+)'/g)].map((item) => item[1]);
}

test('default navigation keeps the owner daily path visible', () => {
  assert.deepEqual(idsFromDeclaration(appSource, 'primaryNavigation'), ['home', 'charge', 'care', 'passport']);
  assert.match(appSource, /id: 'charge', label: '이동'/);
  assert.deepEqual(idsFromDeclaration(appSource, 'secondaryNavigation'), ['drive', 'settings']);
  assert.match(appSource, /primaryNavigation\.map\(\(\{ id, label, icon: Icon \}\)/);
  assert.match(appSource, /mobile-drawer-label/);
});

test('proposal and SDV lab screens are not part of the default consumer footer', () => {
  assert.match(appSource, /get\('lab'\) === '1'/);
  assert.match(appSource, /labMode && <><button onClick=\{\(\) => navigate\('proposal'\)\}/);
  assert.match(appSource, /labMode && <><button onClick=\{\(\) => navigate\('proposal'\)\}.*navigate\('canary'\)/s);
});

test('home service market keeps the three owner jobs visible and actionable', () => {
  assert.match(ownerSource, /function MobilityServiceMarket\(\{ vehicle, navigate, setModal, journal \}\)/);
  assert.match(ownerSource, /MY MOBILITY, ONE PLACE/);
  assert.match(ownerSource, /내 차에 필요한 서비스를 한눈에/);
  assert.match(ownerSource, /id: 'charge', category: 'energy'/);
  assert.match(ownerSource, /id: 'care', category: 'care'/);
  assert.match(ownerSource, /id: 'passport', category: 'record'/);
  assert.match(ownerSource, /navigate\('charge'\)/);
  assert.match(ownerSource, /navigate\('care', vehicle \? 'status' : 'centers'\)/);
  assert.match(ownerSource, /vehicle \? navigate\('passport'\) : setModal\('connect'\)/);
  assert.match(ownerSource, /동의한 차량 데이터만/);
  assert.match(ownerSource, /공식 서비스로 연결/);
  assert.match(ownerSource, /<MobilityServiceMarket vehicle=\{vehicle\}/);
});

test('home command center makes the trust loop the first owner decision', () => {
  assert.match(ownerSource, /function TodayCommandCenter\(\{ vehicle, navigate, setModal, journal, passport \}\)/);
  assert.match(ownerSource, /오늘 내 차에 필요한 한 가지/);
  assert.match(ownerSource, /트립 미션/);
  assert.match(ownerSource, /케어 센터/);
  assert.match(ownerSource, /차량 패스포트/);
  assert.match(ownerSource, /현대차에서 받은 값과 오너가 직접 남긴 기록을 구분/);
  assert.match(ownerSource, /home-secondary-details/);
  assert.match(ownerSource, /today-command-metrics/);
  assert.match(ownerSource, /연결된 차량 핵심 상태/);
  assert.doesNotMatch(ownerSource, /<VehicleReadiness vehicle=\{vehicle\}/);
  assert.doesNotMatch(ownerSource, /<VehicleCareSummary vehicle=\{vehicle\}/);
});

test('latest owner flow adapts energy copy to vehicle type and promotes the next scheduled task', () => {
  assert.match(vehicleProfileSource, /export function vehiclePowertrain\(vehicle\)/);
  assert.match(vehicleProfileSource, /return 'HYBRID'/);
  assert.match(vehicleProfileSource, /return 'EV'/);
  assert.match(vehicleProfileSource, /return 'ICE'/);
  assert.match(ownerSource, /const energy = vehicleEnergyProfile\(vehicle\)/);
  assert.match(ownerSource, /if \(tasks\.length\) return/);
  assert.match(ownerSource, /NEXT CARE/);
  assert.match(ownerSource, /차량 종류 맞춤 준비/);
  assert.match(appSource, /fuel-mode/);
  assert.match(appSource, /현재 주유소 데이터는 연결되어 있지 않아 충전소 화면은 EV 기준/);
});

test('service-centre location follows the same consent-first behavior as charging', () => {
  assert.match(appSource, /navigator\.permissions\.query\(\{ name: 'geolocation' \}\)/g);
  assert.match(appSource, /if \(active && permission\.state === 'granted'\) findFromCurrentLocation\(\)/);
  assert.match(appSource, /if \(!navigator\.permissions\?\.query\) \{\s*\/\/ Safari on iOS does not expose Permissions API\. Ask for the real location[\s\S]*?findFromCurrentLocation\(\);/);
  assert.match(appSource, /현재 위치 사용/);
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
  assert.match(ownerSource, /배터리 \$\{energy\.value\}% · 충전 권장/);
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
  assert.match(appSource, /방문 기록 남기기/);
  assert.match(appSource, /navigate\('passport'\)/);
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

test('care provides a clear bridge to official roadside support without pretending to submit a request', () => {
  assert.match(appSource, /function OfficialAssistanceCard\(\)/);
  assert.match(appSource, /OFFICIAL SUPPORT/);
  assert.match(appSource, /href="tel:080-600-6000"/);
  assert.match(appSource, /앱에서 출동 접수·처리가 완료됐다고 표시하지 않습니다/);
  assert.match(appSource, /<OfficialAssistanceCard \/>/);
});

test('owner value hub keeps monetization useful, official and transparent', () => {
  assert.match(ownerSource, /function OwnerValueHub\(\{ vehicle, navigate, spent, journal \}\)/);
  assert.match(ownerSource, /OWNER VALUE LOOP/);
  assert.match(ownerSource, /직접 남긴 완료 지출 기준입니다/);
  assert.match(ownerSource, /bluemembers-point/);
  assert.match(ownerSource, /service-reservation-search\/service-network-reservation/);
  assert.match(ownerSource, /제휴 준비 중/);
  assert.match(ownerSource, /안전 알림과 기본 차량 상태는 유료로 막지 않습니다/);
  assert.match(ownerSource, /<OwnerValueHub vehicle=\{vehicle\} navigate=\{navigate\} spent=\{spent\} journal=\{journal\} \/>/);
});

test('home is explicitly tailored to the Hyundai owner ecosystem', () => {
  assert.match(appSource, /HYUNDAI OWNER CARE · CONCEPT/);
  assert.match(ownerSource, /function HyundaiOwnerRail\(\{ vehicle, navigate, setModal \}\)/);
  assert.match(ownerSource, /HYUNDAI ECOSYSTEM/);
  assert.match(ownerSource, /BLUELINK/);
  assert.match(ownerSource, /BLUE MEMBERS/);
  assert.match(ownerSource, /BLUEHANDS/);
  assert.match(ownerSource, /MYHYUNDAI/);
  assert.match(ownerSource, /현대 통합계정 연결/);
  assert.match(ownerSource, /service-membership\/bluemembers/);
  assert.match(ownerSource, /myhyundai-information/);
  assert.match(ownerSource, /<HyundaiOwnerRail vehicle=\{vehicle\} navigate=\{navigate\} setModal=\{setModal\} \/>/);
  assert.match(ownerSource, /현대차 오너의<br \/><em>차량 라이프/);
});

test('Hyundai ecosystem rail participates in the cinematic reveal without breaking reduced motion', async () => {
  const cinematicSource = await readFile(new URL('src/CinematicHome.jsx', root), 'utf8');
  const cinematicCss = await readFile(new URL('src/cinematic.css', root), 'utf8');
  assert.match(cinematicSource, /\.hyundai-owner-rail/);
  assert.match(cinematicCss, /\.cinematic-home \.hyundai-owner-rail/);
  assert.match(cinematicCss, /prefers-reduced-motion:reduce/);
  assert.match(cinematicCss, /\.cinematic-home\[data-motion-ready=true\] \.hyundai-owner-rail/);
});

test('monetization plan separates product value from future revenue gates', () => {
  assert.match(monetizationPlanSource, /수익화는 목적이고, 신뢰받는 오너 경험이 먼저다/);
  assert.match(monetizationPlanSource, /공식 케어 제휴 수수료/);
  assert.match(monetizationPlanSource, /선택형 LIFE PASS\+/);
  assert.match(monetizationPlanSource, /가짜 할인, 가짜 포인트, 가짜 예약번호·결제번호/);
  assert.match(monetizationPlanSource, /현재 추가로 필요한 키는 없다/);
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
