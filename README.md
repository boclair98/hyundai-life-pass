# HYUNDAI LIFE PASS

실시간 충전소, 현대자동차 서비스 거점, 동의 기반 실차 상태와 연결 기록을 하나의 경험으로 묶은 현대자동차 오너 서비스 플랫폼 파일럿입니다. 공개 API로 확인할 수 없는 예약·결제·진단·OTA 값은 소비자 화면에서 생성하지 않습니다.

> 포트폴리오용 비공식 콘셉트이며 현대자동차의 실제 서비스가 아닙니다.

현재 배포는 실제 사용자 검증을 위한 `PUBLIC BETA`입니다. 기술적 출시 보호 장치와 자동 검증 범위, 현대자동차 상용 승인 전 남은 조건은 [`docs/LAUNCH_READINESS.md`](docs/LAUNCH_READINESS.md)에서 구분해 관리합니다.

## 공개 파일럿

실행 주소: <https://hyundai-life-pass.coders.kr>

로그인 없이 `충전`과 `정비·점검`의 위치 기반 탐색을 먼저 사용할 수 있습니다. 현대자동차 오너는 공식 통합계정 동의 후 차량 상태·7종 경고·연결 기록을 확인할 수 있습니다. `주행 도구`와 `설정`은 매일 쓰는 화면을 방해하지 않도록 보조 메뉴로 두었고, 소프트웨어/품질 팀용 `#canary`(SDV 운영 데모)는 소비자 메뉴에서 분리했습니다. 검토용 제안·Canary 링크는 `?lab=1`을 붙였을 때만 하단에 표시됩니다.

이 링크는 현대자동차 내부 시스템이나 직원 전용 권한을 제공하지 않습니다. 실제 예약·결제·디지털 키·OTA 제어는 각 파트너 계약과 별도 상용 승인이 필요합니다.

## 오너가 실제로 쓰는 기능

| 우선순위 | 해결하는 문제 | 대표 기능 |
| --- | --- | --- |
| 매일 | 지금 출발해도 되는지 판단 | 내 차 상태, 배터리·주행 가능 거리, 안전 경고 |
| 바로 필요할 때 | 이동 중 충전·정비 거점 찾기 | 현재 위치 기반 충전소·블루핸즈, 실시간 상태, 전화·길찾기 |
| 오래 쓰기 | 관리 내용을 잊지 않기 | 차량에서 받은 기록과 직접 남긴 정비·지출·일정 |
| 필요할 때만 | 주행 준비와 계정 관리 | 주행·비용 계산, 출발 체크, 주차 위치, 현대 계정 연결·철회 |

## 오너 홈과 핵심 흐름

홈의 기본 메뉴는 `오늘 → 이동 → 케어 → 패스포트` 네 가지입니다. `이동` 안에서 충전소·주유·트립·주차 도구를 차량 종류에 맞게 이어갑니다. 첫 화면은 차량 상태를 나열하는 대시보드가 아니라 `오늘 내 차에 필요한 한 가지`를 먼저 제안하는 커맨드 센터입니다. 출발 준비도·다음 관리·최근 신뢰 기록과 연결 차량의 핵심 상태를 한 흐름에 보여주고, `트립 미션 → 케어 센터 → 차량 패스포트`로 바로 이어집니다. 주행 계산·체크리스트·주차 위치와 계정 설정은 보조 메뉴에서 필요할 때만 엽니다. 차량을 연결한 뒤에는 배터리 잔량, 주행 가능 거리, 누적 주행, 차량 경고를 커맨드 센터에서 확인합니다. 타이어 공기압은 위치별 카드를 제공하되, 현재 Hyundai Developers 승인 API가 차량 단위 경고만 반환하므로 개별 PSI는 `미제공`으로 표시합니다. 숫자를 추정하거나 샘플로 채우지 않고 실제 데이터 범위를 그대로 보여줍니다.

홈 하단의 `차량을 더 오래 잘 쓰는 기능`은 공식 생태계 링크·일정·비용·추가 도구를 접어 두어 핵심 판단을 방해하지 않도록 했습니다. 필요할 때만 펼치며, 첫 화면의 상태 판단과 충전·케어·기록 흐름은 항상 동일하게 유지됩니다.

첫 화면의 `내 차에 필요한 서비스를 한눈에` 영역은 상품 탐색형 정보 구조를 오너 서비스에 맞게 재구성했습니다. 충전·차량 케어·차량 기록을 사진이 비지 않는 넓은 카드로 비교하고, 필터와 상태 문구를 거쳐 각 실제 기능으로 바로 이동합니다. 데스크톱에서는 분류 탐색과 상세 카드를 나란히, 모바일에서는 가로 필터와 세로 카드로 바뀌며 모든 주요 이미지는 화면 폭에 맞는 WebP를 사용합니다. 생성 이미지의 출처와 최종 프롬프트는 [`docs/MOBILITY_MARKET_VISUALS.md`](docs/MOBILITY_MARKET_VISUALS.md)에 기록했습니다.

충전소와 블루핸즈는 위치 권한을 이미 허용한 경우 현재 위치로 자동 검색하고, iOS Safari처럼 권한 조회 API가 없거나 조회에 실패하는 브라우저에서도 실제 위치 권한을 요청합니다. 권한을 거부했거나 위치 확인에 실패한 경우에는 기본 지역을 `지역 예시 기준`으로 명확히 표시하며 현재 위치처럼 가장하지 않습니다. 화면의 `현재 위치 사용` 버튼으로 언제든 재시도할 수 있습니다. 차량 케어의 7종 경고·차량 여권·공유 링크로 바로 이어집니다. 로그인 전에도 위치 기반 충전·정비 탐색은 사용할 수 있어 첫 화면에서 서비스 가치를 확인할 수 있습니다.

충전소 상세의 `현재 위치에서 길찾기 시작`은 버튼을 누른 순간 휴대폰 GPS를 다시 확인해 카카오맵의 출발지(`현재 위치`)와 선택한 충전소의 도착지를 함께 엽니다. 위치 권한을 허용하지 않으면 길찾기를 열지 않고 원인을 안내합니다.

운영 API가 절전 상태에서 첫 요청을 늦게 처리하거나 일시적인 게이트웨이 오류를 반환하면 화면에 보이는 앱 셸이 멈추지 않도록 한 번 자동 재시도합니다. 메뉴 이동은 해시 딥링크를 사용하며 모바일 브라우저의 뒤로가기·앞으로가기도 현재 화면과 동기화됩니다.

홈의 `오늘의 차량 브리핑`은 받은 신호를 우선순위로 읽어 다음 행동 하나를 제안합니다. 경고가 있으면 안전 점검, 배터리가 20% 이하이면 충전소, 다음 점검이 1,000km 이내이면 서비스 거점으로 연결하며, 값이 없을 때는 추정하지 않고 동기화 상태를 안내합니다. 현대차 검토자를 위한 `#proposal` 화면에서는 문제·가치·오너 흐름·파일럿 확장 원칙을, `#canary` 화면에서는 실제 릴리스 API 응답과 상용 전환에 필요한 운영 연결을 제품 화면 안에서 확인할 수 있습니다.

차량 상태 화면에서는 `정비 방문 브리프`를 열어 현재 수신된 차종·주행거리·배터리·경고·타이어 상태와 마지막 수신 시각을 한 번에 확인하고 복사·공유할 수 있습니다. 상담 준비를 줄이는 참고용 요약이며 공식 정비 이력이나 예약·진단 결과로 표시하지 않습니다.

같은 화면의 `내 차의 변화를 한 화면에`는 현대차에서 수신한 차량 신호를 최대 30회까지 이 기기에만 기록하고, 직전 수신과 달라진 배터리·주행 가능 거리·누적 주행·경고 수를 비교합니다. 충전 상태 변화와 각 수신 시각을 함께 보여줘 새로고침을 반복하지 않아도 흐름을 이해할 수 있습니다. 서버로 전송하거나 없는 값을 채우지 않으며, 공식 정비 이력·진단·주행 허가를 대신하지 않습니다. 기기를 바꾸거나 브라우저 저장소를 지우면 기록도 사라집니다.

차량 상태 화면에는 현대자동차 긴급출동 고객센터(080-600-6000)로 바로 전화를 거는 공식 지원 연결도 제공합니다. 앱 안에서 출동을 접수했다고 가장하지 않고, 전화 상담원이 위치와 차량 상태를 확인하는 실제 지원 채널로 명확히 연결합니다.

관리 기록의 월별 리포트는 서버에서 해당 월의 `DONE` 기록만 조회해 계산합니다. 합계와 평균은 소유자가 금액을 실제 입력한 기록만 사용하며, 금액을 입력하지 않은 완료 기록은 별도 건수로 표시합니다. 이 리포트는 소유자 입력 데이터이며 현대자동차 공식 정비 이력이나 비용 명세가 아닙니다.

홈에는 `오늘 출발 준비도`가 추가되어 안전·에너지·케어 3개 축을 실제로 수신한 신호만으로 계산합니다. 경고·배터리·점검 기준이 일부만 들어오면 점수를 부풀리지 않고 확인된 항목 수와 미수신 항목을 함께 보여주며, 가장 먼저 필요한 안전 점검·충전소·서비스 거점으로 바로 이동할 수 있습니다. 점수는 공식 진단이나 주행 허가가 아니라 오너의 확인 순서를 돕는 앱 기준입니다. 전체 제품 방향과 현대차 파일럿·제휴 이후 확장 항목은 [`docs/PRODUCT_EVOLUTION_PLAN.md`](docs/PRODUCT_EVOLUTION_PLAN.md)에 정리했습니다.

## 현대차 맞춤화 레이어

홈의 기본 언어와 다음 행동을 현대차 오너가 실제로 익숙하게 느끼는 순서로 맞췄습니다. `HYUNDAI OWNER CARE`는 LIFE PASS의 콘셉트 레이어이며 현대자동차의 공식 앱이나 내부 시스템을 의미하지 않습니다.

- **현대 통합계정·Bluelink**: 동의한 차량 신호를 연결하고, 받은 값만 차량 상태 화면과 로컬 변화 기록에 반영합니다.
- **블루멤버스**: 포인트·멤버십 혜택은 값을 복제하거나 임의로 계산하지 않고 [현대 공식 블루멤버스](https://www.hyundai.com/kr/ko/service-membership/bluemembers)로 이동합니다.
- **블루핸즈**: 현재 위치 기반 현대 서비스 거점 탐색, 전화, 카카오맵 길찾기를 LIFE PASS 안에서 제공하고 예약 완료로 오인시키지 않습니다.
- **MyHyundai**: 차량 관리·카라이프·현대샵 같은 공식 생활 서비스는 [MyHyundai 안내](https://www.hyundai.com/kr/ko/digital-customer-support/app/myhyundai/myhyundai-information)로 이어집니다.

이 네 가지를 `HYUNDAI ECOSYSTEM` 카드로 묶어 차량 연결 → 상태 확인 → 공식 혜택·케어로 이동하는 흐름을 홈에서 바로 이해하게 했습니다. 실제 계정·예약·포인트·원격제어 권한은 현대자동차의 별도 승인과 운영 API가 제공될 때만 내부 기능으로 전환합니다.

홈과 주요 기능 화면은 충전 허브, 배터리 모듈, 휠 진단, 도심 주행, 주차 위치, 디지털 차량 기록을 각각 다른 구도와 피사체로 표현한 전용 이미지 세트를 사용합니다. 전체 색감은 딥 네이비·시안·실버로 통일하되 기능별 장면은 즉시 구분되도록 구성했습니다.

## 수익화로 이어지는 제품 구조

최종 목표는 수익화지만, 현재 공개 버전은 결제나 가짜 할인부터 붙이지 않습니다. 오너가 차량 상태 확인 → 충전·케어 탐색 → 관리 기록을 반복해서 쓰게 만든 뒤, 실제 비용이 발생하는 지점에만 선택형 제휴·구독을 연결합니다. 홈의 `내 차 혜택을 한곳에서`는 다음 세 가지를 출처별로 구분해 보여줍니다.

- 직접 입력한 이번 달 지출: 실제 기록만 계산하고 절감액을 추정하지 않음
- 현대 공식 혜택: 블루멤버스 포인트·공식 정비 예약 페이지로 이동
- 파트너 케어: 정비·세차·충전 예약·결제는 계약과 API가 준비되기 전까지 `제휴 준비 중`으로 표시

상용화 순서는 `공식 케어 거래 수수료 → 선택형 LIFE PASS+ → 현대샵·용품 제휴 → 법인·플릿 운영`입니다. 안전 알림과 기본 차량 상태를 유료로 잠그지 않고, 위치·차량 데이터를 광고나 제휴사에 판매하지 않습니다. 필요한 계약, 결제, 데이터 동의, 측정 지표와 출시 게이트는 [`docs/MONETIZATION_PLAN.md`](docs/MONETIZATION_PLAN.md)에 정리했습니다.

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

### 차량 없이 화면 검수하기

공개 배포 화면에서 `?demo=1#home`을 붙이면 실제 현대차 계정과 분리된 시연용 샘플 차량으로 연결 후 화면을 확인할 수 있습니다. 샘플 차량·충전소·서비스 거점·관리 기록·차량 여권을 제공하지만, 인증·서버 저장·위치 권한·외부 길찾기는 실행하지 않습니다. 화면 상단의 `DEMO` 배너로 실제 데이터가 아님을 표시합니다.

예: `https://hyundai-life-pass.coders.kr/?demo=1#home`

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
- CanaryDrive → 공개 소비자 메뉴와 분리된 읽기 전용 릴리스 상태 데모(`#canary`)

## 주요 API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/v1/vehicles` | 차량 목록 및 상태 |
| GET | `/api/v1/vehicles/{id}/passport` | 검증된 차량 여권 |
| GET/POST | `/api/v1/vehicles/{id}/events` | 차량 생애주기 이벤트 |
| GET | `/api/v1/vehicles/{id}/journal` | 소유자 입력 관리 기록 |
| GET | `/api/v1/vehicles/{id}/journal/report?month=YYYY-MM` | 월별 관리 지출 리포트 |
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

현대 마이현대·쏘카·한화에어로스페이스·넥토리얼을 기준으로 전체 사용자 흐름을 점검한 결과는 [`docs/PLATFORM_AUDIT.md`](docs/PLATFORM_AUDIT.md)에 정리했습니다.


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
