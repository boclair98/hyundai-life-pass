export const demoVehicles = [
  {
    id: 'ioniq6-0318',
    name: 'IONIQ 6',
    trim: 'Long Range AWD · 2026',
    plate: '32가 0318',
    color: 'Serenity White Pearl',
    batterySoc: 72,
    batterySoh: 94,
    healthScore: 96,
    range: 386,
    odometer: 18342,
    location: '서울 성수동',
    softwareVersion: 'v2.4.0',
    nextServiceKm: 1240,
    chargingState: '연결 안 됨',
  },
  {
    id: 'ioniq5-1240',
    name: 'IONIQ 5',
    trim: 'Long Range Exclusive · 2025',
    plate: '18나 1240',
    color: 'Atlas White',
    batterySoc: 38,
    batterySoh: 91,
    healthScore: 89,
    range: 174,
    odometer: 26710,
    location: '경기 판교',
    softwareVersion: 'v2.4.0',
    nextServiceKm: 630,
    chargingState: '급속 충전 중',
  },
  {
    id: 'kona-5521',
    name: 'KONA Electric',
    trim: 'Inspiration · 2025',
    plate: '41다 5521',
    color: 'Abyss Black Pearl',
    batterySoc: 91,
    batterySoh: 97,
    healthScore: 98,
    range: 404,
    odometer: 9120,
    location: '부산 해운대',
    softwareVersion: 'v2.3.8',
    nextServiceKm: 4820,
    chargingState: '완속 충전 중',
  },
];

// Public review fixture. This is intentionally separate from API responses so
// a reviewer can inspect the connected-owner flow without a Hyundai account.
const demoToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
const demoDate = (days = 0) => {
  const value = new Date(`${demoToday()}T12:00:00+09:00`);
  value.setDate(value.getDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(value);
};
const demoUpdatedAt = new Date().toISOString();

export const demoVehicle = {
  databaseId: 9001,
  id: 'demo-ioniq6',
  externalId: 'demo-ioniq6',
  source: 'DEMO',
  name: 'IONIQ 6',
  trim: 'Long Range AWD · 2026',
  plate: '시연 0318',
  color: 'Serenity White Pearl',
  batterySoc: 72,
  batterySoh: 94,
  healthScore: 96,
  range: 386,
  odometer: 18342,
  location: '서울 성수동',
  softwareVersion: 'v2.4.0',
  nextServiceKm: 1240,
  chargingState: '충전 대기',
  chargingTargetSoc: 80,
  chargingRemainingMinutes: 42,
  chargingPlugType: 'DC 급속',
  warningCount: 0,
  checkedWarnings: 7,
  tirePressureWarning: false,
  tirePressure: { unit: 'kPa', exactValuesAvailable: true, values: { frontLeft: 275, frontRight: 276, rearLeft: 274, rearRight: 275 } },
  healthChecks: [
    { id: 'BATTERY', label: '구동 배터리', state: 'CLEAR' },
    { id: 'TIRE_PRESSURE', label: '타이어 공기압', state: 'CLEAR' },
    { id: 'BRAKE', label: '브레이크 시스템', state: 'CLEAR' },
    { id: 'COOLANT', label: '냉각수', state: 'CLEAR' },
    { id: 'LIGHT', label: '등화 장치', state: 'CLEAR' },
    { id: 'DOOR', label: '도어·트렁크', state: 'CLEAR' },
    { id: 'SOFTWARE', label: '차량 소프트웨어', state: 'CLEAR' },
  ],
  connectedService: { subscribeDate: '20260115', endDate: '20270115' },
  updatedAt: demoUpdatedAt,
  dataTimestamp: '20260914083000',
};

export const demoJournalEntries = [
  { id: 9101, vehicleId: 9001, category: 'MAINTENANCE', title: '정기 점검 완료', note: '타이어 위치 교환 · 브레이크 검사', entryDate: demoDate(-2), amount: 78000, odometer: 18120, status: 'DONE', createdAt: demoUpdatedAt, updatedAt: demoUpdatedAt },
  { id: 9102, vehicleId: 9001, category: 'CHARGE', title: '급속 충전', note: '성수 E-pit · 20% → 80%', entryDate: demoDate(-5), amount: 13400, odometer: 18042, status: 'DONE', createdAt: demoUpdatedAt, updatedAt: demoUpdatedAt },
  { id: 9103, vehicleId: 9001, category: 'WASH', title: '세차', note: '다음 비 예보 전 외부 세차', entryDate: demoDate(-8), amount: 35000, odometer: null, status: 'DONE', createdAt: demoUpdatedAt, updatedAt: demoUpdatedAt },
  { id: 9104, vehicleId: 9001, category: 'INSURANCE', title: '자동차 보험 갱신', note: '갱신일 전에 보장 범위를 확인하세요.', entryDate: demoDate(19), amount: null, odometer: null, status: 'PLANNED', createdAt: demoUpdatedAt, updatedAt: demoUpdatedAt },
];

export const demoPlatform = {
  environment: 'DEMO',
  providers: [
    { id: 'hyundai-connected-car', name: 'Hyundai Connected Car', mode: 'LIVE', state: 'CONNECTED', source: 'DEMO', refreshedAt: demoUpdatedAt, accountName: '시연용 오너', accountEmailMasked: 'demo••@example.com', message: '실제 현대차 계정과 연결되지 않은 샘플 차량입니다.' },
    { id: 'ev-charger', name: 'EV Charger Network', mode: 'LIVE', state: 'CONNECTED', source: 'DEMO', refreshedAt: demoUpdatedAt, message: '시연용 충전소 데이터입니다.' },
  ],
  stations: [
    { id: 9101, providerStationId: 'demo-station-seongsu', name: '성수 E-pit', address: '서울 성동구 아차산로 17길', latitude: 37.5467, longitude: 127.0643, distanceKm: 3.1, available: 3, total: 6, speedKw: 200, pricePerKwh: 340, etaMinutes: 11, operator: '현대자동차', statusLabel: '사용 가능', source: 'DEMO', reservable: false, statusUpdatedAt: demoUpdatedAt },
    { id: 9102, providerStationId: 'demo-station-gangdong', name: '현대 EV 스테이션 강동', address: '서울 강동구 천호대로 1221', latitude: 37.5365, longitude: 127.1330, distanceKm: 5.8, available: 7, total: 8, speedKw: 350, pricePerKwh: 347, etaMinutes: 18, operator: '현대자동차', statusLabel: '사용 가능', source: 'DEMO', reservable: false, statusUpdatedAt: demoUpdatedAt },
    { id: 9103, providerStationId: 'demo-station-seoulforest', name: '서울숲 공영주차장', address: '서울 성동구 뚝섬로 273', latitude: 37.5444, longitude: 127.0374, distanceKm: 6.4, available: 11, total: 16, speedKw: 100, pricePerKwh: 324, etaMinutes: 21, operator: '서울시설공단', statusLabel: '사용 가능', source: 'DEMO', reservable: false, statusUpdatedAt: demoUpdatedAt },
  ],
  serviceBookings: [],
  chargingReservations: [],
  handovers: [],
  notifications: [{ id: 'demo-notification-1', category: '차량 상태', title: '시연용 차량 데이터가 준비됐어요', message: '실제 계정과 분리된 샘플 화면입니다.', read: false, createdAt: demoUpdatedAt, source: 'DEMO' }],
  unreadNotifications: 1,
};

export const demoServiceCenters = [
  { id: 'demo-center-seongsu', name: '성수 현대서비스', address: '서울 성동구 성수이로 88', phone: '02-460-1234', distanceKm: 2.8, placeUrl: 'https://map.kakao.com/' },
  { id: 'demo-center-gangnam', name: '강남 블루핸즈', address: '서울 강남구 영동대로 731', phone: '02-555-5678', distanceKm: 6.2, placeUrl: 'https://map.kakao.com/' },
];

export const demoPassport = {
  signedEvents: 4,
  trustScore: 98,
  batterySoh: 94,
  software: 'v2.4.0',
  hash: 'demo-8b1d-e42c',
  events: [
    { id: 'demo-passport-1', occurredAt: demoDate(-2), type: '차량 상태', title: '차량 건강도 스냅샷 서명', detail: '배터리 SOH 94% · 미해결 경고 0건' },
    { id: 'demo-passport-2', occurredAt: demoDate(-7), type: '소프트웨어', title: 'OTA v2.4.0 업데이트 완료', detail: '배터리 열관리 안전 패치 · 무결성 검증' },
    { id: 'demo-passport-3', occurredAt: demoDate(-18), type: '정비', title: '블루핸즈 정기 점검 완료', detail: '타이어 위치 교환 · 브레이크 검사' },
    { id: 'demo-passport-4', occurredAt: demoDate(-42), type: '소유권', title: '시연용 차량 기록 발급', detail: '실제 소유권이나 현대차 계정과 무관한 샘플 기록' },
  ],
};

export const stations = [
  { id: 1, name: '현대 EV 스테이션 강동', address: '서울 강동구 천호대로 1221', latitude: 37.5365, longitude: 127.1330, distance: '2.4km', available: 7, total: 8, speed: '350kW', price: '347원/kWh', eta: '8분' },
  { id: 2, name: '성수 E-pit', address: '서울 성동구 아차산로 17길', latitude: 37.5467, longitude: 127.0643, distance: '3.1km', available: 3, total: 6, speed: '200kW', price: '340원/kWh', eta: '11분' },
  { id: 3, name: '서울숲 공영주차장', address: '서울 성동구 뚝섬로 273', latitude: 37.5444, longitude: 127.0374, distance: '4.6km', available: 11, total: 16, speed: '100kW', price: '324원/kWh', eta: '14분' },
];

export const passportEvents = [
  { date: '2026. 09. 03', category: '차량 상태', title: '차량 건강도 스냅샷 서명', detail: '배터리 SOH 94% · 미해결 경고 0건', hash: '8b1d…e42c', state: 'verified' },
  { date: '2026. 08. 28', category: '소프트웨어', title: 'OTA v2.4.0 업데이트 완료', detail: '배터리 열관리 안전 패치 · 무결성 검증', hash: 'c1a4…7f19', state: 'verified' },
  { date: '2026. 08. 19', category: '정비', title: '블루핸즈 정기 점검 완료', detail: '타이어 위치 교환 · 브레이크 검사', hash: '45a8…d0e2', state: 'verified' },
  { date: '2026. 07. 04', category: '소유권', title: '최초 차량 여권 발급', detail: '차량 신원·소유자 연결 기록 생성', hash: '73cf…912a', state: 'verified' },
];

export const releases = [
  { id: 1, version: 'v2.4.1', title: 'ccNC 내비게이션 1.9', cohort: 'IONIQ 6 · 2026', status: '진행 중', progress: 37, vehicles: '14,820대', anomaly: '0.18%', tone: 'active' },
  { id: 2, version: 'v2.4.0', title: '배터리 열관리 안전 패치', cohort: 'EV 전 차종', status: '완료', progress: 100, vehicles: '98,422대', anomaly: '0.04%', tone: 'done' },
  { id: 3, version: 'v2.3.9', title: '고속도로 주행 보조 보정', cohort: 'IONIQ 5 · 2025', status: '자동 중지', progress: 12, vehicles: '4,920대', anomaly: '1.92%', tone: 'paused' },
];
