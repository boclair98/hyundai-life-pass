# 실데이터·상용화 연동 체크리스트

실제 비밀키는 GitHub나 채팅에 올리지 않는다. 발급 후 Coders의 암호화 환경변수로만 등록한다.

## 먼저 가져올 것 요약

| 우선순위 | 발급처 | 가져올 값 | 용도 |
|---|---|---|---|
| 1 | Hyundai Developers 서비스 콘솔 | `Client ID`, `Client Secret` | 현대 통합계정 로그인과 Bluelink 차량 데이터 |
| 2 | 공공데이터포털 | 일반 인증키 **Decoding** | 전국 충전소 위치·충전기 상태 |
| 3 | Kakao Developers | JavaScript 키, REST API 키 | 모바일 지도·주소/장소 검색 |
| 이후 | Firebase Console | 프로젝트 ID, 서비스 계정 | 푸시 알림 |
| 제휴 후 | 충전사업자·현대차 파트너 채널 | 파트너 자격증명과 웹훅 규격 | 실제 충전 예약·결제, 블루핸즈 예약, 디지털 키 |

현대 계정 비밀번호, 발급된 Secret, 공공데이터 인증키 원문을 채팅에 보내지 않는다. 사용자가 배포 환경에 직접 등록한 뒤 “등록 완료”라고 알려주면 상태 코드만 확인한다.

## 1. 현대자동차 차량 데이터 — 필수

- 발급처: https://developers.hyundai.com/
- 콘솔: https://console.developers.hyundai.com/
- 이곳의 로그인은 두 가지다.
  - 개발자 본인: 서비스 콘솔에 들어가 프로젝트와 키를 발급받는 계정
  - 서비스 이용자: Life Pass의 `현대 통합계정으로 연결` 버튼을 눌러 자신의 Bluelink 차량 접근을 허용하는 계정
- 발급 절차: 우측 상단 **서비스 콘솔로 이동** → 현대 통합계정 로그인/Developers 회원 신청 → **신규 개발 프로젝트 등록** → 프로젝트 개요에서 Client ID/Client Secret 확인
- 계정 API Redirect URL: `https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callback`
- 데이터 API Redirect URL: `https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callback`
- 데이터 API Callback URL: `https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callbacks/data-unavailable?token={HYUNDAI_CALLBACK_SECRET}`
- 콘솔에서 가져올 값은 두 개뿐이다: `HYUNDAI_CLIENT_ID`, `HYUNDAI_CLIENT_SECRET`
- 코드에 고정할 값: `HYUNDAI_REDIRECT_URI=https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callback`
- 운영 모드: `LIFEPASS_HYUNDAI_MODE=live`, HTTPS 쿠키: `LIFEPASS_SESSION_COOKIE_SECURE=true`
- 요청 API: 통합계정 OAuth, 제3자 제공 동의, 내 차량 목록, 주행 가능 거리, 누적 운행 거리, EV 배터리 잔량, EV 충전 상태
- 상용화: 콘솔에서 상용화 신청과 심사를 거쳐야 한다. 사용자 차량 접근 동의, 개인정보 제3자 제공 동의, 동의 철회, 데이터 조회 불가 콜백이 필수다.

콘솔에는 위 Redirect URL을 철자까지 완전히 동일하게 넣는다. 로그인 요청의 Redirect URL과 콘솔 등록값이 다르면 현대 계정 화면에서 돌아오지 못한다. 개발 프로젝트로 먼저 실제 차량 연동을 검증한 뒤 상용화 승인을 받으면, 별도로 생성되는 상용화 프로젝트의 Client ID/Secret으로 교체한다.

차량 API는 사용자가 동의한 Bluelink 커넥티드 차량만 제공한다. 차량 배터리 SOH, 블루핸즈 실시간 예약, OTA 배포 제어는 공개 데이터 API에 포함되지 않으므로 별도 사내/제휴 연동이 필요하다.

API 발급값이 아닌 서버 비밀값 두 개도 직접 생성한다. 아래 출력은 채팅이나 GitHub에 복사하지 말고 배포 환경변수에만 저장한다.

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)) # HYUNDAI_TOKEN_ENCRYPTION_KEY
[Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32)).ToLower() # HYUNDAI_CALLBACK_SECRET
```

Life Pass는 브라우저에 토큰을 저장하지 않는다. OAuth state는 10분 만료·1회 사용이며, Access/Refresh Token은 AES-256-GCM으로 암호화해 PostgreSQL에 저장한다. 사용자 구분은 30일 만료 HttpOnly/SameSite=Lax 서버 세션으로 유지된다.

## 2. 전국 충전소 위치·상태 — 필수

- 발급처: https://www.data.go.kr/data/15013115/standard.do
- 활용신청: `한국환경공단_전기자동차 충전소 정보`
- 개발/운영 승인: 자동승인
- 필요한 값: 공공데이터포털의 **일반 인증키(Encoding 또는 Decoding)** → `DATA_GO_KR_SERVICE_KEY` (서버가 한 번만 정규화)
- 활성화: `LIFEPASS_EV_CHARGER_MODE=live`
- 제공 범위: 충전소·충전기 위치, 운영기관, 충전용량, 실시간 충전기 상태
- 제공하지 않는 범위: 실제 요금, 예약 확정, 결제

개발 기본 한도는 일 1,000회다. 서버는 5분 캐시와 마지막 정상 응답 보존을 사용하며, 상용 운영 전 활용사례 등록으로 트래픽 증설을 신청한다.

## 3. 지도·주소·길찾기 — 필수

- 발급처: https://developers.kakao.com/
- 앱 생성 후 플랫폼 키에서 JavaScript 키와 REST API 키 확인
- Web 플랫폼 사이트 도메인: `https://hyundai-life-pass.coders.kr`
- 필요한 값: 배포 런타임 `KAKAO_JAVASCRIPT_KEY`, 로컬 개발 `VITE_KAKAO_JAVASCRIPT_KEY`, 서버 검색용 `KAKAO_REST_API_KEY`

JavaScript 키를 넣으면 충전 화면이 실제 Kakao 지도와 충전소 마커로 전환된다. 키가 없으면 `SAMPLE DATA` 도식 지도로 유지된다. REST API 장소검색은 다음 단계의 서버 검색용이며 현재 화면은 공공데이터 좌표를 사용한다.

## 4. 충전 예약·결제 — 제휴 필수

한국환경공단 API로는 충전기를 예약하거나 결제할 수 없다. E-pit 또는 개별 CPO와 B2B 제휴 후 아래 값이 필요하다.

- `CPO_RESERVATION_PROVIDER`
- `CPO_CLIENT_ID`
- `CPO_CLIENT_SECRET`
- 운영사가 제공하는 예약·취소·요금·결제·웹훅 규격

제휴 전에는 실제 충전소를 `조회·길찾기`까지만 제공하며 예약 버튼을 노출하지 않는다.

## 5. 블루핸즈 예약 — 제휴 필수

일반 개발자에게 공개된 블루핸즈 예약 API는 확인되지 않는다. 현대자동차 상용화 담당자에게 Life Pass 시나리오와 함께 파트너 연동을 요청한다.

- 문의: `developers@hyundai.com`
- 필요한 항목: 센터 목록, 가용 슬롯, 견적, 예약/변경/취소, 완료 정비내역, 웹훅

제휴 전에는 정비 필요 시점과 예상 항목만 제공하고 실제 예약 확정으로 표현하지 않는다.

## 6. 운영 서비스

- 푸시: Firebase Console에서 프로젝트와 서비스 계정을 발급해 `FCM_PROJECT_ID`, `FCM_SERVICE_ACCOUNT_JSON_BASE64` 등록
- 결제: Toss Payments 개발자센터에서 클라이언트 키/시크릿 키 발급. 실제 충전 결제는 CPO 계약과 함께 설계
- 정책: 개인정보처리방침, 서비스 이용약관, 위치기반서비스 이용약관, 고객 문의 이메일 필요

## 키 전달 방법

키 문자열을 채팅이나 GitHub에 붙이지 않는다. 로컬 `.env` 또는 Coders 암호화 환경변수에 직접 등록한 뒤 "등록 완료"라고 알려준다. 연결 검증 시에는 키 원문을 출력하지 않고 공급자 상태와 API 응답 코드만 확인한다.
