# HYUNDAI LIFE PASS

실시간 충전소, 현대자동차 서비스 거점, 동의 기반 실차 상태와 연결 기록을 하나의 경험으로 묶은 현대자동차 오너 서비스 플랫폼 파일럿입니다. 공개 API로 확인할 수 없는 예약·결제·진단·OTA 값은 소비자 화면에서 생성하지 않습니다.

> 포트폴리오용 비공식 콘셉트이며 현대자동차의 실제 서비스가 아닙니다.

## 핵심 가치

| 사용자 | 해결하는 문제 | 대표 기능 |
| --- | --- | --- |
| 차량 소유자 | 충전·정비 정보가 흩어짐 | 실시간 충전소, 블루핸즈 탐색, 동의 기반 차량 상태 |
| 중고차 구매자 | 차량 기록의 출처를 알기 어려움 | Life Pass에서 생성된 이벤트 서명과 연결 기록 |
| SDV 운영팀 | 대규모 OTA 실패가 큰 리스크가 됨 | Canary 배포, 이상 감지, 자동 보호 모드, 이벤트 스트림 |

## 기술 구성

- Frontend: React, Vite, Lucide Icons
- Backend: Kotlin, Spring Boot 3, Spring Data JPA
- Database: H2 local profile, PostgreSQL production runtime
- Integration: Hyundai Developers OAuth/consent adapter, 한국환경공단 charger adapter, Kakao Maps runtime adapter
- Live utility: Kakao Local API 기반 현재 위치 주변 현대자동차·블루핸즈 검색, 전화 및 길찾기
- Runtime boundary: 자체 Hyundai OAuth를 위한 coders.kr `standalone` 모드, API 요청 ID·보안 헤더·속도 제한
- Identity: Hyundai OAuth 기반 소비자 세션 + 별도 운영자 토큰
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

프론트만 실행하면 UI는 열리지만 실제 차량·충전소·서비스 거점 데이터는 표시하지 않습니다. 실제 공급자 응답이 없는 값을 샘플 데이터로 대체하지 않습니다.

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
- 현대 계정 동의 완료 → 차량 자동 동기화
- 차량 새로고침 → 사용자가 동의한 제공 범위의 차량 상태 갱신
- 연결 해제·데이터 삭제 → 현대 동의 철회와 로컬 토큰·실차 데이터 삭제
- 소비자 기능 → 충전소·서비스 거점 조회, 전화, 길찾기
- CanaryDrive → 공개 소비자 메뉴와 분리된 읽기 전용 기술 시뮬레이터

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

프로젝트에는 광고, 결제, 후원 UI가 없으며 Coders Donate도 사용하지 않습니다. 설치형 PWA manifest와 오프라인 앱 셸을 포함하며 `/api/*` 응답은 서비스 워커에 저장하지 않습니다.

배포·장애 대응·외부 API 전환 기준은 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)에 정리했습니다.

발급 위치와 필요한 환경변수는 [`docs/API_KEYS.md`](docs/API_KEYS.md)에 정리했습니다.

내일 출시 범위, 사용자 여정, 기능 우선순위와 출시 게이트는 [`docs/PRODUCT_RELEASE_PLAN.md`](docs/PRODUCT_RELEASE_PLAN.md)에 정리했습니다.
