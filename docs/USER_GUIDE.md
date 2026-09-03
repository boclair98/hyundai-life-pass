# HYUNDAI LIFE PASS 사용 가이드

## 이 프로젝트는 무엇인가

HYUNDAI LIFE PASS는 현대차 오너가 흩어진 충전·정비·차량 기록을 한곳에서 이용하도록 설계한 모바일 우선 PWA입니다. 현대자동차 공식 운영 서비스가 아니라 Hyundai Developers 상용화를 제안하고 검증하기 위한 독립 포트폴리오 플랫폼입니다.

## 휴대폰에서 사용하는 순서

1. `https://hyundai-life-pass.coders.kr`을 연다.
2. **충전** 탭에서 **내 위치로 찾기**를 누르고 위치 권한을 허용한다.
3. 현재 위치의 시·도를 판별한 뒤 반경 30km 실제 충전소가 거리순으로 표시된다.
4. **내 차 케어** 탭에서는 로그인 없이 가까운 블루핸즈를 찾고 전화·길찾기를 할 수 있다.
5. **설정 → 현대 계정 연결**을 누르면 현대자동차 통합 로그인 화면으로 이동한다.
6. 공식 화면에서 로그인, 차량 접근 동의, 개인정보 제3자 제공 동의를 마치면 차량 데이터가 동기화된다.

위치가 이미 허용된 브라우저는 충전 화면 진입 시 자동으로 현재 위치를 다시 조회합니다. 위치를 거부하면 서울 성수 기본 위치 결과를 유지하며, 위치 좌표는 충전소 거리 계산에만 쓰고 브라우저 저장소에 보관하지 않습니다.

## 현재 실제로 작동하는 범위

| 영역 | 현재 동작 | 데이터 출처 |
|---|---|---|
| 충전소 | 현재 위치 기준 시·도 조회, 반경 30km 거리순 정렬, 충전기 상태, 지도, 길찾기 | 한국환경공단 + Kakao Local/Maps |
| 서비스센터 | 현재 위치 주변 현대자동차·블루핸즈 검색, 전화, 길찾기 | Kakao Local/Maps |
| 계정 | 현대 통합계정 OAuth, 프로필 식별, 기기 간 동일 계정 연결, 동의 상태, 철회·삭제 | Hyundai Developers |
| 내 차 | 동의 차량 목록, 배터리, 주행 가능 거리, 누적 주행거리, 충전 상태, 7종 차량 경고, 커넥티드 서비스 계약일 | Hyundai Developers 승인 범위 |
| 차량 여권 | Life Pass가 실제로 받은 차량 데이터 이벤트의 해시 서명 | Life Pass PostgreSQL |
| CanaryDrive | OTA 운영 구조를 보여주는 읽기 전용 시뮬레이터 | Life Pass 데모 데이터 |

## 운영에 필요한 외부 설정

### 이미 코드에 연결된 API

- Hyundai Developers: Client ID/Secret, 계정·데이터 Redirect URL, 데이터 제공 중단 Callback URL
- 공공데이터포털: 한국환경공단 전기자동차 충전소 정보 서비스키
- Kakao Developers: REST API 키, JavaScript 키, Web 허용 도메인

비밀키는 Git 저장소나 브라우저 번들에 넣지 않고 배포 환경변수로만 보관합니다. Kakao JavaScript 키는 도메인 제한을 전제로 브라우저에서 사용합니다.

### 현대 콘솔에서 반드시 확인할 값

- 계정 API Redirect URL: `https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callback`
- 데이터 API Redirect URL: `https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callback`
- 데이터 API Callback URL: 배포 환경의 `HYUNDAI_CALLBACK_SECRET`을 포함한 Life Pass callback 주소
- 개발 프로젝트에서 본인 차량 활성화 및 약관 동의
- 일반 고객 공개 전 Hyundai Developers **상용화 심사 승인**

로그인 화면이 열려도 Redirect URL이 콘솔 등록값과 다르거나 프로젝트/차량이 활성화되지 않으면 로그인 후 데이터 동의 또는 차량 조회가 완료되지 않습니다.

차량 경고는 저연료, 타이어 공기압, 등화 장치, 스마트키 배터리, 워셔액, 브레이크액, 엔진오일 7개 항목입니다. 차량이나 API 권한에 따라 제공되지 않는 항목은 `0` 또는 정상으로 추정하지 않고 **미제공**으로 표시합니다.

## 별도 제휴 전에는 할 수 없는 기능

- 충전 예약, 충전 시작, 결제와 실제 사업자별 요금
- 블루핸즈 예약 가능 시간, 견적, 예약·변경·취소
- 디지털 키 회수·이전과 실제 소유권 이전
- 차량 OTA 배포·중단·롤백

이 기능은 공개 데이터 API만으로 구현할 수 없습니다. 현대자동차, E-pit/CPO, 블루핸즈 파트너 계약과 별도 API 권한이 필요합니다.

## 기술 구성

- Frontend: React, Vite, PWA, Kakao Maps JavaScript SDK
- Backend: Java 21, Kotlin, Spring Boot, Spring Data JPA, Spring Session
- Database: PostgreSQL, Flyway
- Deployment: Docker 기반 Coders standalone 서비스
- Security: 서버 세션, HttpOnly/Secure 쿠키, OAuth state, AES-256-GCM 토큰 암호화, 요청 속도 제한
