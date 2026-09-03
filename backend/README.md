# HYUNDAI LIFE PASS API

차량 상태, 디지털 차량 여권, OTA Canary 배포를 제공하는 Kotlin/Spring Boot/JPA REST API입니다.

## 실행 및 테스트

```bash
./gradlew bootRun
./gradlew test
```

기본값은 H2 인메모리 DB입니다. 운영 환경은 PostgreSQL datasource 설정만 주입해 전환할 수 있습니다.

## API

| Method | Endpoint | 설명 |
| --- | --- | --- |
| GET | `/api/v1/vehicles` | 차량 목록 |
| GET | `/api/v1/vehicles/{id}` | 차량 상태 |
| GET | `/api/v1/vehicles/{id}/events` | 서명된 차량 이벤트 |
| POST | `/api/v1/vehicles/{id}/events` | 차량 이벤트 추가 |
| GET | `/api/v1/vehicles/{id}/passport` | 차량 여권 |
| GET | `/api/v1/releases` | OTA 릴리스 목록 |
| POST | `/api/v1/releases/{id}/start|advance|pause` | Canary 상태 변경 |
| GET | `/api/v1/platform/snapshot` | 사용자 플랫폼 상태 |
| POST | `/api/v1/platform/vehicles/{id}/connect` | 차량 연결 |
| POST | `/api/v1/platform/charging-reservations` | 충전 예약 |
| POST | `/api/v1/platform/service-bookings` | 정비 예약 |
| POST | `/api/v1/platform/handovers` | 인수인계 시작 |
| POST | `/api/v1/platform/handovers/{id}/advance` | 인수인계 단계 진행 |
| GET | `/api/v1/platform/audit-logs` | 운영자 감사 로그 |
| GET | `/actuator/health` | 운영 상태 확인 |

Flyway가 스키마 버전을 관리하며, Coders 배포에서는 PostgreSQL과 native identity를 사용합니다. 외부 차량 데이터는 service 계층 앞에 provider adapter를 추가하고, 수신 이벤트를 `VehicleEvent`로 정규화하는 구조로 확장합니다.
