# HYUNDAI LIFE PASS

충전, 예측 정비, 안전한 OTA, 디지털 차량 여권을 하나의 경험으로 연결한 현대자동차 오너 서비스 플랫폼 콘셉트입니다. 소비자는 차를 보유하는 전 과정을 한 앱에서 관리하고, 운영자는 **CanaryDrive Control**에서 소프트웨어 배포 위험을 관리합니다.

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
- Database: H2 local profile, PostgreSQL production runtime
- Integration: Hyundai Developers OAuth/consent adapter, 한국환경공단 charger adapter, Kakao Maps runtime adapter
- Live utility: Kakao Local API 기반 현재 위치 주변 현대자동차·블루핸즈 검색, 전화 및 길찾기
- Runtime boundary: 자체 Hyundai OAuth를 위한 coders.kr `standalone` 모드, API 요청 ID·보안 헤더·속도 제한
- Identity: Coders native identity (`X-Coders-User`) + operator allow-list
- Data lifecycle: Flyway migrations, signed audit log, transactional domain events
- Operations: Actuator health/metrics, scheduled OTA rollout progression
- UX: responsive mobile-first layout, hash-based deep links, accessible dialogs and feedback

```text
React client
  ├─ Car Life: Home / Charge / Care / Passport
  └─ Developer Lab: CanaryDrive Control
          │
          ▼
Spring Boot REST API ── JPA/Flyway ── H2 or PostgreSQL
          ├─ Hyundai Developers: OAuth → 제3자 제공 동의 → 차량 상태 동기화
          ├─ 한국환경공단: 충전소 위치·충전기 상태 + 5분 캐시
          └─ 개인정보 철회/차량 삭제 callback → 실차 데이터 즉시 삭제
```

## 실행

프론트만 실행하면 별도 키 없이 `SAMPLE DATA`로 명시된 사용 시나리오가 동작합니다.

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

## 실제 서비스 전환

- `LIFEPASS_HYUNDAI_MODE=live`: 현대 통합계정 OAuth, 개인정보 제3자 제공 동의, 차량 목록·주행거리·배터리·충전 상태
- 현대 로그인 세션: PostgreSQL-backed 30일 HttpOnly/SameSite=Lax 쿠키. 운영에서는 Secure 쿠키를 강제하며 임의 사용자 헤더를 신뢰하지 않음
- `LIFEPASS_EV_CHARGER_MODE=live`: 한국환경공단 충전소 위치·실시간 충전기 상태
- `KAKAO_JAVASCRIPT_KEY`: 모바일 실지도 표시; 키가 없으면 사용 예시 지도만 표시
- Hyundai Callback: 계정 탈퇴·차량 삭제·동의 철회 시 연결 차량과 토큰 즉시 삭제

화면은 공급자별 데이터 출처를 항상 표시합니다. API 키가 없는 데이터는 `SAMPLE DATA`로 명시하며, 한국환경공단 연동 시에만 충전소를 `LIVE DATA`로 표시합니다. 공공 API가 제공하지 않는 예약·결제는 CPO 제휴 전에는 활성화하지 않습니다.

## 실제 상태 변경 흐름

- 차량 연결 → 소유자 연결, 알림, 감사 로그 생성
- 충전 예약·취소 → 예약 상태, 차량 충전 상태, 차량 여권 이벤트 동기화
- 블루핸즈 예약·취소 → 정비 오더, 알림, 차량 이력 동기화
- 차량 인수인계 → 개인정보 삭제, 여권 서명, 최종 전달의 4단계 상태 머신
- OTA 운영 → 시작·확대·중지 API와 20초 주기 rollout progression
- 모든 변경 작업 → 사용자 ID와 SHA-256 서명이 포함된 감사 로그 저장

## 주요 API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/v1/vehicles` | 차량 목록 및 상태 |
| GET | `/api/v1/vehicles/{id}/passport` | 검증된 차량 여권 |
| GET/POST | `/api/v1/vehicles/{id}/events` | 차량 생애주기 이벤트 |
| GET | `/api/v1/releases` | OTA 릴리스 목록 |
| POST | `/api/v1/releases/{id}/start` | Canary 배포 시작 |
| GET | `/api/v1/platform/snapshot` | 사용자별 예약·알림·이전 상태 |
| POST | `/api/v1/integrations/hyundai/authorize` | 현대 통합계정 OAuth 시작 |
| GET | `/api/v1/integrations/hyundai/agreement` | 개인정보 제3자 제공 동의 연결 |
| GET | `/api/v1/service-centers` | 위도·경도 기준 주변 현대자동차 서비스 거점 검색 |
| POST | `/api/v1/integrations/hyundai/sync` | 동의 차량 데이터 동기화 |
| POST | `/api/v1/integrations/hyundai/revoke` | 동의 철회 및 실차 데이터 삭제 |

`coders.yaml`은 `mode: standalone`을 사용한다. 이 서비스는 coders.kr 방문자 로그인이 아니라 Hyundai Developers OAuth를 자체 신원 흐름으로 사용하기 때문이다. `native` 모드로 바꾸면 소비자 POST 요청이 coders.kr 로그인 게이트로 이동해 차량 연결·동기화가 중단된다.
| POST | `/api/v1/integrations/hyundai/callbacks/data-unavailable` | 탈퇴·차량 삭제·철회 callback |
| POST | `/api/v1/platform/charging-reservations` | 충전 예약 생성 |
| POST | `/api/v1/platform/service-bookings` | 정비 예약 생성 |
| POST | `/api/v1/platform/handovers` | 차량 인수인계 생성 |
| GET | `/actuator/health` | 서비스·DB 상태 확인 |

프로젝트에는 광고, 결제, 후원 UI가 없으며 Coders Donate도 사용하지 않습니다.

배포·장애 대응·외부 API 전환 기준은 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)에 정리했습니다.

발급 위치와 필요한 환경변수는 [`docs/API_KEYS.md`](docs/API_KEYS.md)에 정리했습니다.
