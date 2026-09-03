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
3. 사용자 화면에서 충전 또는 정비 예약을 만든다.
4. `GET /api/v1/platform/snapshot`에서 예약·알림 상태를 확인한다.
5. 운영자 화면에서 signed audit stream을 확인한다.

## 장애 대응

- 웹 502: Nginx runtime DNS와 `api.internal_url`을 확인한다.
- API 시작 실패: PostgreSQL datasource와 Flyway migration 결과를 확인한다.
- 쓰기 요청 로그인 반복: Coders native identity와 브라우저 세션을 확인한다.
- OTA 진행 정지: 릴리스 상태가 `PAUSED`인지, operator allow-list가 맞는지 확인한다.

## 외부 Provider 전환

현재 차량·충전소 데이터는 플랫폼 시뮬레이션 provider입니다. 실제 운영 전에는 다음 adapter를 구현해야 합니다.

- Connected Vehicle Provider: 차량 상태, 배터리, DTC, 주행거리
- Charging Provider: 충전기 가용 상태, 요금, 예약 확정·취소
- Dealer Service Provider: 블루핸즈 슬롯, 견적, 작업 상태
- Notification Provider: APNs/FCM, 이메일, SMS
- Signing Provider: KMS/HSM 기반 차량 여권 서명

Provider 장애 시 마지막 정상 데이터를 읽기 전용으로 제공하고, 변경 요청은 idempotency key와 outbox 재처리로 보호하는 것이 다음 운영 단계입니다.
