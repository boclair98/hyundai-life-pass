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

export const stations = [
  { id: 1, name: '현대 EV 스테이션 강동', address: '서울 강동구 천호대로 1221', distance: '2.4km', available: 7, total: 8, speed: '350kW', price: '347원/kWh', eta: '8분' },
  { id: 2, name: '성수 E-pit', address: '서울 성동구 아차산로 17길', distance: '3.1km', available: 3, total: 6, speed: '200kW', price: '340원/kWh', eta: '11분' },
  { id: 3, name: '서울숲 공영주차장', address: '서울 성동구 뚝섬로 273', distance: '4.6km', available: 11, total: 16, speed: '100kW', price: '324원/kWh', eta: '14분' },
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
