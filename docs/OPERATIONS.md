# HYUNDAI LIFE PASS 운영 가이드

## 배포 구조

- `web`: Vite 정적 산출물을 Nginx로 제공하고 `/api/*`를 내부 API로 프록시
- `api`: Kotlin/Spring Boot/JPA 서비스
- `db`: Coders managed PostgreSQL 1Gi
- 인증: Coders gate가 변경 요청을 로그인 사용자로 제한하고 `X-Coders-User`를 API에 전달
- 운영자 권한: `LIFEPASS_OPERATOR_USERS` allow-list가 OTA 변경과 감사 로그 접근을 제한

## 운영 확인

1. `GET /actuator/health`가 `UP`인지 확인한다.
2. `GET /api/v1/vehicles`가 차량 데이터를 반환하는지 확인한다.
3. `GET /api/v1/platform/snapshot`의 공급자별 `mode`, `state`, `source`, `refreshedAt`를 확인한다.
4. 실제 공공 충전소에서는 길찾기만 열리고, 제휴 전 예약이 차단되는지 확인한다.
5. 운영자 화면에서 signed audit stream을 확인한다.

## 장애 대응

- 웹 502: Nginx runtime DNS와 `api.internal_url`을 확인한다.
- API 시작 실패: PostgreSQL datasource와 Flyway migration 결과를 확인한다.
- 쓰기 요청 로그인 반복: Coders native identity와 브라우저 세션을 확인한다.
- OTA 진행 정지: 릴리스 상태가 `PAUSED`인지, operator allow-list가 맞는지 확인한다.

## 외부 Provider 전환

차량과 충전소는 아래 adapter가 구현되어 있으며 키가 없으면 명시적 simulation 상태입니다.

- Hyundai Connected Vehicle Provider: OAuth, 제3자 제공 동의, 차량 상태·배터리·주행거리, 토큰 암호화·갱신, 철회 callback
- KECO Charging Provider: 위치·운영기관·충전용량·실시간 상태, 5분 캐시, 마지막 정상 응답 보존
- Kakao Map Provider: 런타임 키 기반 지도·마커, 길찾기 deep link
- Charging Reservation Provider: CPO 제휴 전 미구현이며 실제 데이터에서는 예약을 차단
- Dealer Service Provider: 블루핸즈 슬롯, 견적, 작업 상태
- Notification Provider: APNs/FCM, 이메일, SMS
- Signing Provider: KMS/HSM 기반 차량 여권 서명

Provider 장애 시 마지막 정상 데이터를 `STALE` 읽기 전용으로 제공한다. 정상 데이터가 한 번도 없으면 `ERROR`를 반환하고 샘플로 위장하지 않는다. CPO·블루핸즈 제휴 이후에는 idempotency key, webhook signature, outbox 재처리를 추가해야 한다.
