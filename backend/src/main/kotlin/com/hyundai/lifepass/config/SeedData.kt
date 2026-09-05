package com.hyundai.lifepass.config

import com.hyundai.lifepass.domain.EventType
import com.hyundai.lifepass.domain.Powertrain
import com.hyundai.lifepass.domain.Release
import com.hyundai.lifepass.domain.ReleaseStatus
import com.hyundai.lifepass.domain.Vehicle
import com.hyundai.lifepass.domain.VehicleEvent
import com.hyundai.lifepass.domain.UserNotification
import com.hyundai.lifepass.repository.NotificationRepository
import com.hyundai.lifepass.repository.ReleaseRepository
import com.hyundai.lifepass.repository.VehicleRepository
import org.springframework.boot.CommandLineRunner
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.time.Instant

@Configuration
class SeedData {
    @Bean
    fun seed(vehicleRepository: VehicleRepository, releaseRepository: ReleaseRepository, notificationRepository: NotificationRepository) = CommandLineRunner {
        if (vehicleRepository.count() == 0L) {
            val ioniq = vehicleRepository.save(
                Vehicle(
                    externalId = "ioniq6-0318",
                    name = "IONIQ 6",
                    trim = "Long Range AWD · 2026",
                    plate = "32가 0318",
                    powertrain = Powertrain.EV,
                    batterySoc = 72,
                    batterySoh = 92,
                    healthScore = 96,
                    rangeKm = 386,
                    odometerKm = 18342,
                    nextServiceKm = 1240,
                    location = "서울 성수동",
                    softwareVersion = "v2.4.0",
                    chargingState = "연결 안 됨",
                    chargingTargetSoc = 80,
                    chargingPlugType = "연결 안 됨",
                ),
            )
            val ioniq5 = vehicleRepository.save(
                Vehicle(
                    externalId = "ioniq5-1240",
                    name = "IONIQ 5",
                    trim = "Long Range Exclusive · 2025",
                    plate = "18나 1240",
                    powertrain = Powertrain.EV,
                    batterySoc = 38,
                    batterySoh = 91,
                    healthScore = 89,
                    rangeKm = 174,
                    odometerKm = 26710,
                    nextServiceKm = 630,
                    location = "경기 판교",
                    softwareVersion = "v2.4.0",
                    chargingState = "급속 충전 중",
                    chargingTargetSoc = 80,
                    chargingRemainingMinutes = 24,
                    chargingPlugType = "급속 충전기",
                ),
            )
            val kona = vehicleRepository.save(
                Vehicle(
                    externalId = "kona-5521",
                    name = "KONA Electric",
                    trim = "Inspiration · 2025",
                    plate = "41다 5521",
                    powertrain = Powertrain.EV,
                    batterySoc = 91,
                    batterySoh = 97,
                    healthScore = 98,
                    rangeKm = 404,
                    odometerKm = 9120,
                    nextServiceKm = 4820,
                    location = "부산 해운대",
                    softwareVersion = "v2.3.8",
                    chargingState = "완속 충전 중",
                    chargingTargetSoc = 90,
                    chargingRemainingMinutes = 58,
                    chargingPlugType = "일반 충전기",
                ),
            )
            val ioniqEvents = listOf(
                VehicleEvent(vehicle = ioniq, type = EventType.HEALTH_SNAPSHOT, title = "차량 건강도 스냅샷 서명", detail = "배터리 SOH 94% · 미해결 DTC 0건", tone = "mint", signature = "8b1d5a2c"),
                VehicleEvent(vehicle = ioniq, type = EventType.SOFTWARE_UPDATE, title = "OTA v2.4.0 업데이트 완료", detail = "배터리 열관리 안전 패치 · 검증 완료", tone = "violet", signature = "c1a4f119"),
                VehicleEvent(vehicle = ioniq, type = EventType.SERVICE, title = "블루핸즈 정기 점검 완료", detail = "타이어 위치 교환 · 브레이크 검사", tone = "sky", signature = "45a8d0e2"),
            )
            val ioniq5Events = listOf(
                VehicleEvent(vehicle = ioniq5, type = EventType.ALERT, title = "배터리 온도 편차 감지", detail = "IONIQ 5 · 2025 · 자동 확인", tone = "amber", signature = "69f05ac1"),
            )
            ioniq.events.addAll(ioniqEvents)
            ioniq5.events.addAll(ioniq5Events)
            vehicleRepository.saveAll(listOf(ioniq, ioniq5, kona))
        }
        if (releaseRepository.count() == 0L) {
            releaseRepository.saveAll(
                listOf(
                    Release(version = "v2.4.1", title = "ccNC 내비게이션 1.9", status = ReleaseStatus.ROLLING, target = "IONIQ 6 · 14,820대", progress = 37, risk = "Low", createdAt = Instant.now().minusSeconds(3600)),
                    Release(version = "v2.4.0", title = "배터리 열관리 안전 패치", status = ReleaseStatus.COMPLETE, target = "EV 전 차종 · 98,422대", progress = 100, risk = "Low", createdAt = Instant.now().minusSeconds(432000)),
                    Release(version = "v2.3.9", title = "고속도로 주행 보조 보정", status = ReleaseStatus.PAUSED, target = "IONIQ 5 · 4,920대", progress = 12, risk = "Review", createdAt = Instant.now().minusSeconds(691200)),
                ),
            )
        }
        if (notificationRepository.count() == 0L) {
            notificationRepository.saveAll(
                listOf(
                    UserNotification(actorId = "demo-owner", title = "차량 상태가 매우 좋아요", message = "IONIQ 6 건강도 96점 · 즉시 확인할 경고가 없습니다.", category = "CARE"),
                    UserNotification(actorId = "demo-owner", title = "야간 충전 추천", message = "오늘 23시 이후 충전하면 예상 비용을 약 18% 절약할 수 있어요.", category = "CHARGING"),
                ),
            )
        }
    }
}
