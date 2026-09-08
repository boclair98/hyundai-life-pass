# HYUNDAI LIFE PASS

실시간 충전소, 현대자동차 서비스 거점, 동의 기반 실차 상태와 연결 기록을 하나의 경험으로 묶은 현대자동차 오너 서비스 플랫폼 파일럿입니다. 공개 API로 확인할 수 없는 예약·결제·진단·OTA 값은 소비자 화면에서 생성하지 않습니다.

> 포트폴리오용 비공식 콘셉트이며 현대자동차의 실제 서비스가 아닙니다.

현재 배포는 실제 사용자 검증을 위한 `PUBLIC BETA`입니다. 기술적 출시 보호 장치와 자동 검증 범위, 현대자동차 상용 승인 전 남은 조건은 [`docs/LAUNCH_READINESS.md`](docs/LAUNCH_READINESS.md)에서 구분해 관리합니다.

## 공개 파일럿

실행 주소: <https://hyundai-life-pass.coders.kr>

로그인 없이 `충전`과 `내 차 케어`의 위치 기반 탐색을 먼저 사용할 수 있습니다. 현대자동차 오너는 공식 통합계정 동의 후 차량 상태·7종 경고·연결 기록을 확인할 수 있고, 소프트웨어/품질 팀은 `Canary Lab`에서 실차 명령 없이 SDV 배포 보호 규칙을 읽기 전용으로 검토할 수 있습니다. 홈과 Canary Lab의 공유 버튼은 모바일 공유 시트 또는 복사 링크로 공개 파일럿을 전달합니다.

이 링크는 현대자동차 내부 시스템이나 직원 전용 권한을 제공하지 않습니다. 실제 예약·결제·디지털 키·OTA 제어는 각 파트너 계약과 별도 상용 승인이 필요합니다.

## 핵심 가치

| 사용자 | 해결하는 문제 | 대표 기능 |
| --- | --- | --- |
| 차량 소유자 | 충전·정비 정보가 흩어짐 | 실시간 충전소, 블루핸즈 탐색, 동의 기반 차량 상태 |
| 중고차 구매자 | 차량 기록의 출처를 알기 어려움 | Life Pass에서 생성된 이벤트 서명과 연결 기록 |
| SDV 운영팀 | 대규모 OTA 실패가 큰 리스크가 됨 | Canary 배포, 이상 감지, 자동 보호 모드, 이벤트 스트림 |

## 차량 커맨드센터

차량을 연결한 뒤 홈에서 `MY HYUNDAI GARAGE`를 중심으로 운행 준비도, 배터리 잔량, 주행 가능 거리, 누적 주행, 충전 상태를 한 번에 확인합니다. 타이어 공기압은 위치별 카드를 제공하되, 현재 Hyundai Developers 승인 API가 차량 단위 경고만 반환하므로 개별 PSI는 `미제공`으로 표시합니다. 즉, 숫자를 추정하거나 샘플로 채우지 않고 실제 데이터 범위를 그대로 보여줍니다.

충전소와 블루핸즈는 현재 위치 기준으로 다시 검색할 수 있고, 차량 케어의 7종 경고·차량 여권·공유 링크로 바로 이어집니다. 로그인 전에도 위치 기반 충전·정비 탐색은 사용할 수 있어 첫 화면에서 서비스 가치를 확인할 수 있습니다.

홈과 주요 기능 화면은 충전 허브, 배터리 모듈, 휠 진단, 도심 주행, 주차 위치, 디지털 차량 기록을 각각 다른 구도와 피사체로 표현한 전용 이미지 세트를 사용합니다. 전체 색감은 딥 네이비·시안·실버로 통일하되 기능별 장면은 즉시 구분되도록 구성했습니다.

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

- `LIFEPASS_HYUNDAI_MODE=live`: 현대 통합계정 OAuth·프로필 식별, 개인정보 제3자 제공 동의, 차량 목록·주행거리·배터리·충전 상태(목표 충전량·남은 시간·플러그 유형 포함)·7종 차량 경고·커넥티드 서비스 계약일
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
| GET | `/api/v1/charging-stations` | 위도·경도 기준 전국 충전소 실시간 검색 |
| POST | `/api/v1/integrations/hyundai/authorize` | 현대 통합계정 OAuth 시작 |
| GET | `/api/v1/integrations/hyundai/agreement` | 개인정보 제3자 제공 동의 연결 |
| GET | `/api/v1/service-centers` | 위도·경도 기준 주변 현대자동차 서비스 거점 검색 |
| POST | `/api/v1/integrations/hyundai/sync` | 동의 차량 데이터 동기화 |
| POST | `/api/v1/integrations/hyundai/revoke` | 동의 철회 및 실차 데이터 삭제 |
| POST | `/api/v1/integrations/hyundai/callbacks/data-unavailable` | 탈퇴·차량 삭제·철회 callback |
| POST | `/api/v1/platform/charging-reservations` | 충전 예약 생성 |
| POST | `/api/v1/platform/service-bookings` | 정비 예약 생성 |
| POST | `/api/v1/platform/handovers` | 차량 인수인계 생성 |
| GET | `/actuator/health` | 서비스·DB 상태 확인 |

`coders.yaml`은 `mode: standalone`을 사용한다. 이 서비스는 coders.kr 방문자 로그인이 아니라 Hyundai Developers OAuth를 자체 신원 흐름으로 사용하기 때문이다. `native` 모드로 바꾸면 소비자 POST 요청이 coders.kr 로그인 게이트로 이동해 차량 연결·동기화가 중단된다.

프로젝트에는 광고, 결제, 후원 UI가 없으며 Coders Donate도 사용하지 않습니다. 설치형 PWA manifest와 오프라인 앱 셸을 포함하며 `/api/*` 응답은 서비스 워커에 저장하지 않습니다.

배포·장애 대응·외부 API 전환 기준은 [`docs/OPERATIONS.md`](docs/OPERATIONS.md)에 정리했습니다.

발급 위치와 필요한 환경변수는 [`docs/API_KEYS.md`](docs/API_KEYS.md)에 정리했습니다.

내일 출시 범위, 사용자 여정, 기능 우선순위와 출시 게이트는 [`docs/PRODUCT_RELEASE_PLAN.md`](docs/PRODUCT_RELEASE_PLAN.md)에 정리했습니다.

휴대폰에서 쓰는 순서와 실제/제휴 기능 구분은 [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md)에 정리했습니다.


## 품질 검증과 운영 기준

StockPilot README의 운영 문서 구성을 참고해, 공개 파일럿의 기능 범위와 검증 명령을 한곳에 모았습니다. README의 설명과 실제 구현이 다르면 코드를 기준으로 문서를 먼저 바로잡습니다.

### 로컬 검증

프런트엔드와 백엔드는 각각 다음 명령으로 검증합니다.

```bash
npm ci
npm run check
node --test tests/*.test.mjs

cd backend
./gradlew test bootJar --no-daemon
```

동일한 검사는 [GitHub Actions CI](https://github.com/boclair98/hyundai-life-pass/actions/workflows/ci.yml)에서 실행됩니다. 이미지 예산·파일 무결성 테스트가 실패하면 배포하지 않고 원인을 먼저 수정합니다.

### 주요 환경변수

실제 값은 저장소나 채팅에 기록하지 않고 Coders.kr의 암호화 환경변수에 등록합니다. 전체 발급처와 운영 전환 조건은 [`docs/API_KEYS.md`](docs/API_KEYS.md)를 따릅니다.

| 이름 | 용도 | 기본/필수 범위 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 프런트엔드 API 주소 | 로컬 선택 |
| `VITE_KAKAO_JAVASCRIPT_KEY` | 로컬 지도 표시 | 지도 사용 시 |
| `KAKAO_REST_API_KEY` | 장소·서비스 거점 검색 | 운영 지도/검색 |
| `DATA_GO_KR_SERVICE_KEY` | 공공 충전소 API | 실데이터 운영 |
| `LIFEPASS_EV_CHARGER_MODE` | 충전소 adapter 모드 | 운영은 `live` |
| `LIFEPASS_HYUNDAI_MODE` | 현대 OAuth/차량 adapter 모드 | 운영은 `live` |
| `HYUNDAI_CLIENT_ID` / `HYUNDAI_CLIENT_SECRET` | 현대 Developers OAuth | 상용 연동 필수 |
| `HYUNDAI_TOKEN_ENCRYPTION_KEY` | 서버 토큰 암호화 | 운영 필수 |
| `HYUNDAI_CALLBACK_SECRET` | 데이터 삭제 callback 검증 | 운영 필수 |

### 배포·저장소 경계

- 원본 저장소: [`boclair98/hyundai-life-pass`](https://github.com/boclair98/hyundai-life-pass)
- 조직 포크: [`coders-kr/hyundai-life-pass`](https://github.com/coders-kr/hyundai-life-pass)
- 소스 오브 트루스와 배포 원본은 `boclair98`입니다. 포크에서 기능을 직접 개발하지 않습니다.
- 변경은 원본에서 검증·Merge한 뒤 포크 동기화와 기존 Coders.kr 배포 흐름을 거칩니다.
- 배포 후 `GET /actuator/health`, 비로그인 탐색, 로그인 전환, 충전소·서비스 거점 조회를 확인합니다.
- 예약·결제·디지털 키·실제 OTA 제어는 제휴와 공식 승인이 없으므로 구현 완료로 표시하지 않습니다.

### 반응형 확인 체크리스트

공개 URL을 업데이트할 때 다음 화면 폭에서 가로 넘침·잘린 버튼·겹치는 고정 요소·읽기 어려운 한국어 줄바꿈이 없는지 확인합니다.

- 모바일: 약 `360×800`, `390×844`
- 데스크톱: 약 `1440×900`
- 핵심 여정: 게스트 탐색 → 충전/서비스 거점 상세 → 길찾기 → 현대 계정 연결 안내
- 오류·빈 상태·공급자 미연동 상태가 실제 기능처럼 오해되지 않는지 확인

자세한 장애 대응과 공급자별 상태 표시는 [`docs/OPERATIONS.md`](docs/OPERATIONS.md), 사용자 여정과 출시 게이트는 [`docs/PRODUCT_RELEASE_PLAN.md`](docs/PRODUCT_RELEASE_PLAN.md)에서 관리합니다.
