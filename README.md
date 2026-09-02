# HYUNDAI LIFE PASS

충전, 예측 정비, 안전한 OTA, 디지털 차량 여권을 하나의 경험으로 연결한 현대자동차 오너 플랫폼 콘셉트입니다. 소비자는 차를 보유하는 전 과정을 한 앱에서 관리하고, 운영자는 **CanaryDrive Control**에서 소프트웨어 배포 위험을 관리합니다.

> 포트폴리오용 비공식 콘셉트이며 현대자동차의 실제 서비스가 아닙니다.

## 핵심 가치

| 사용자 | 해결하는 문제 | 대표 기능 |
| --- | --- | --- |
| 차량 소유자 | 충전·정비·업데이트 정보가 흩어짐 | 충전소 탐색, 차량 건강 점수, 정비 예약, OTA 상태 |
| 중고차 구매자 | 차량 상태와 이력을 믿기 어려움 | 위변조 감지 해시, 검증 이력, 4단계 소유권 이전 |
| SDV 운영팀 | 대규모 OTA 실패가 큰 리스크가 됨 | Canary 배포, 이상 감지, 자동 보호 모드, 이벤트 스트림 |

## 기술 구성

- Frontend: React, Vite, Lucide Icons
- Backend: Kotlin, Spring Boot 3, Spring Data JPA
- Database: H2 demo profile, PostgreSQL-ready runtime dependency
- Integration: REST API with automatic demo-data fallback
- UX: responsive mobile-first layout, hash-based deep links, accessible dialogs and feedback

```text
React client
  ├─ Car Life: Home / Charge / Care / Passport
  └─ Developer Lab: CanaryDrive Control
          │
          ▼
Spring Boot REST API ── JPA ── H2 or PostgreSQL
          │
          └─ future adapters: connected-car / charging / map APIs
```

## 실행

프론트만 실행하면 별도 키 없이 데모 데이터로 동작합니다.

```bash
npm install
npm run dev
```

백엔드를 함께 실행한 뒤 `VITE_API_BASE_URL`을 지정하면 실제 REST 응답으로 전환됩니다.

```bash
cd backend
./gradlew bootRun
```

```bash
VITE_API_BASE_URL=http://localhost:8080 npm run dev
```

Windows PowerShell:

```powershell
$env:VITE_API_BASE_URL='http://localhost:8080'
npm run dev
```

## 실제 서비스 전환 시 필요한 연동

- 커넥티드카 API: 사용자 동의 기반 차량 상태, 주행거리, 배터리, 경고등
- 충전 인프라 API: 충전소 위치, 커넥터 상태, 요금
- 지도·경로 API: 예상 도착 시간과 충전 경로
- 인증·전자서명: 차량 여권 열람 및 소유권 이전

현재 외부 API 키가 없어도 전체 UX를 검토할 수 있으며, `src/api.js`의 adapter 경계를 통해 실제 공급자로 교체할 수 있습니다.

## 주요 API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/v1/vehicles` | 차량 목록 및 상태 |
| GET | `/api/v1/vehicles/{id}/passport` | 검증된 차량 여권 |
| GET/POST | `/api/v1/vehicles/{id}/events` | 차량 생애주기 이벤트 |
| GET | `/api/v1/releases` | OTA 릴리스 목록 |
| POST | `/api/v1/releases/{id}/start` | Canary 배포 시작 |

프로젝트에는 광고, 결제, 후원 UI가 없으며 Coders Donate도 사용하지 않습니다.
