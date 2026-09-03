package com.hyundai.lifepass.service

import com.hyundai.lifepass.api.AuditLogResponse
import com.hyundai.lifepass.api.ChargingReservationResponse
import com.hyundai.lifepass.api.CreateChargingReservationRequest
import com.hyundai.lifepass.api.CreateHandoverRequest
import com.hyundai.lifepass.api.CreateServiceBookingRequest
import com.hyundai.lifepass.api.HandoverResponse
import com.hyundai.lifepass.api.NotificationResponse
import com.hyundai.lifepass.api.PlatformSnapshotResponse
import com.hyundai.lifepass.api.ServiceBookingResponse
import com.hyundai.lifepass.api.StationResponse
import com.hyundai.lifepass.domain.AuditLog
import com.hyundai.lifepass.domain.ChargingReservation
import com.hyundai.lifepass.domain.EventType
import com.hyundai.lifepass.domain.HandoverStatus
import com.hyundai.lifepass.domain.ReservationStatus
import com.hyundai.lifepass.domain.ServiceBooking
import com.hyundai.lifepass.domain.ServiceStatus
import com.hyundai.lifepass.domain.UserNotification
import com.hyundai.lifepass.domain.VehicleEvent
import com.hyundai.lifepass.domain.VehicleHandover
import com.hyundai.lifepass.repository.AuditLogRepository
import com.hyundai.lifepass.repository.ChargingReservationRepository
import com.hyundai.lifepass.repository.HandoverRepository
import com.hyundai.lifepass.repository.NotificationRepository
import com.hyundai.lifepass.repository.ServiceBookingRepository
import com.hyundai.lifepass.repository.VehicleEventRepository
import com.hyundai.lifepass.repository.VehicleRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.util.UUID

@Service
class PlatformService(
    private val vehicleRepository: VehicleRepository,
    private val chargingRepository: ChargingReservationRepository,
    private val serviceRepository: ServiceBookingRepository,
    private val handoverRepository: HandoverRepository,
    private val notificationRepository: NotificationRepository,
    private val auditRepository: AuditLogRepository,
    private val eventRepository: VehicleEventRepository,
    private val chargingStationProvider: ChargingStationProvider,
    private val hyundaiIntegrationService: HyundaiIntegrationService,
    @Value("\${lifepass.sample-data-enabled:true}") private val sampleDataEnabled: Boolean,
) {
    @Transactional(readOnly = true)
    fun snapshot(actor: String): PlatformSnapshotResponse {
        val notifications = notificationRepository.findTop20ByActorIdOrderByCreatedAtDesc(actor).map(::toNotification)
        val stationFeed = chargingStationProvider.getStations()
        val vehicleProvider = hyundaiIntegrationService.providerStatus(actor)
        val liveProviders = listOf(vehicleProvider, stationFeed.provider).count { it.mode == "LIVE" && it.state in setOf("CONNECTED", "STALE") }
        val environment = when (liveProviders) { 2 -> "LIVE"; 1 -> "HYBRID"; else -> "SIMULATION" }
        return PlatformSnapshotResponse(
            actor = actor,
            environment = environment,
            providers = listOf(vehicleProvider, stationFeed.provider),
            stations = stationFeed.stations,
            chargingReservations = chargingRepository.findTop10ByActorIdOrderByCreatedAtDesc(actor).map(::toCharging),
            serviceBookings = serviceRepository.findTop10ByActorIdOrderByCreatedAtDesc(actor).map(::toService),
            handovers = handoverRepository.findTop10ByActorIdOrderByUpdatedAtDesc(actor).map(::toHandover),
            notifications = notifications,
            unreadNotifications = notifications.count { !it.read },
        )
    }

    @Transactional
    fun connectVehicle(actor: String, externalId: String): Map<String, String> {
        val vehicle = requireVehicle(actor, externalId)
        vehicle.ownerId = actor
        vehicle.updatedAt = Instant.now()
        vehicleRepository.save(vehicle)
        audit(actor, "VEHICLE_CONNECTED", "Vehicle", vehicle.id.toString(), externalId)
        notify(actor, "차량 연결이 완료됐어요", "${vehicle.name}의 실시간 상태와 차량 여권을 동기화합니다.", "VEHICLE")
        return mapOf("status" to "CONNECTED", "vehicleExternalId" to externalId, "actor" to actor)
    }

    @Transactional
    fun reserveCharging(actor: String, request: CreateChargingReservationRequest): ChargingReservationResponse {
        val vehicle = requireVehicle(actor, request.vehicleExternalId)
        val station = chargingStationProvider.getStations().stations.find { it.id == request.stationId } ?: throw NoSuchElementException("Station ${request.stationId} was not found")
        if (!station.reservable) throw OperationNotSupportedException("이 충전소는 실시간 조회만 가능합니다. 예약·결제를 위해 충전사업자 제휴 API를 연결해 주세요.")
        val estimate = ((request.targetSoc - vehicle.batterySoc).coerceAtLeast(5) * 0.72 * station.pricePerKwh).toInt()
        val saved = chargingRepository.save(ChargingReservation(actorId = actor, vehicle = vehicle, stationId = station.id, stationName = station.name, scheduledAt = request.scheduledAt, targetSoc = request.targetSoc, estimatedCost = estimate))
        vehicle.chargingState = "예약 완료 · ${station.name}"
        vehicle.updatedAt = Instant.now()
        vehicleRepository.save(vehicle)
        val sample = station.source == "SAMPLE"
        recordEvent(vehicle.id, vehicle, EventType.CHARGING, if (sample) "충전 예약 사용 예시" else "충전 예약 확정", "${if (sample) "샘플 · " else ""}${station.name} · 목표 ${request.targetSoc}%", "sky")
        notify(actor, if (sample) "샘플 충전 예약 흐름을 완료했어요" else "충전 예약이 확정됐어요", "${station.name} · ${request.targetSoc}%까지 충전", "CHARGING")
        audit(actor, "CHARGING_RESERVED", "ChargingReservation", saved.id.toString(), "${vehicle.externalId}|${station.id}|${request.scheduledAt}")
        return toCharging(saved)
    }

    @Transactional
    fun cancelCharging(actor: String, id: Long): ChargingReservationResponse {
        val reservation = chargingRepository.findByIdOrNull(id)?.takeIf { it.actorId == actor } ?: throw NoSuchElementException("Charging reservation $id was not found")
        reservation.status = ReservationStatus.CANCELLED
        val vehicle = reservation.vehicle!!
        vehicle.chargingState = "연결 안 됨"
        vehicleRepository.save(vehicle)
        audit(actor, "CHARGING_CANCELLED", "ChargingReservation", id.toString(), vehicle.externalId)
        return toCharging(chargingRepository.save(reservation))
    }

    @Transactional
    fun bookService(actor: String, request: CreateServiceBookingRequest): ServiceBookingResponse {
        if (!sampleDataEnabled) throw OperationNotSupportedException("블루핸즈 파트너 예약 API 연결 전에는 실제 예약을 생성할 수 없습니다.")
        val vehicle = requireVehicle(actor, request.vehicleExternalId)
        val saved = serviceRepository.save(ServiceBooking(actorId = actor, vehicle = vehicle, centerName = request.centerName, serviceType = request.serviceType, scheduledAt = request.scheduledAt, estimatedCost = 84000))
        recordEvent(vehicle.id, vehicle, EventType.SERVICE, "블루핸즈 예약 시나리오", "파트너 API 연결 전 샘플 · ${request.centerName} · ${request.serviceType}", "mint")
        notify(actor, "샘플 정비 예약 흐름을 완료했어요", "파트너 연동 전 사용 예시 · ${request.centerName}", "SERVICE")
        audit(actor, "SERVICE_BOOKED", "ServiceBooking", saved.id.toString(), "${vehicle.externalId}|${request.scheduledAt}")
        return toService(saved)
    }

    @Transactional
    fun cancelService(actor: String, id: Long): ServiceBookingResponse {
        val booking = serviceRepository.findByIdOrNull(id)?.takeIf { it.actorId == actor } ?: throw NoSuchElementException("Service booking $id was not found")
        booking.status = ServiceStatus.CANCELLED
        audit(actor, "SERVICE_CANCELLED", "ServiceBooking", id.toString(), booking.vehicle!!.externalId)
        return toService(serviceRepository.save(booking))
    }

    @Transactional
    fun startHandover(actor: String, request: CreateHandoverRequest): HandoverResponse {
        if (!sampleDataEnabled) throw OperationNotSupportedException("디지털 키 회수·소유권 이전 제휴 API 연결 전에는 실제 인수인계를 시작할 수 없습니다.")
        val vehicle = requireVehicle(actor, request.vehicleExternalId)
        val saved = handoverRepository.save(VehicleHandover(actorId = actor, vehicle = vehicle, transferCode = UUID.randomUUID().toString().replace("-", "").take(10).uppercase(), buyerEmailMasked = maskEmail(request.buyerEmail)))
        notify(actor, "차량 인수인계를 시작했어요", "개인정보 삭제 단계부터 안전하게 진행합니다.", "HANDOVER")
        audit(actor, "HANDOVER_STARTED", "VehicleHandover", saved.id.toString(), "${vehicle.externalId}|${saved.buyerEmailMasked}")
        return toHandover(saved)
    }

    @Transactional
    fun advanceHandover(actor: String, id: Long): HandoverResponse {
        val handover = handoverRepository.findByIdOrNull(id)?.takeIf { it.actorId == actor } ?: throw NoSuchElementException("Handover $id was not found")
        handover.status = when (handover.status) {
            HandoverStatus.INITIATED -> HandoverStatus.PRIVACY_CLEARED
            HandoverStatus.PRIVACY_CLEARED -> HandoverStatus.PASSPORT_SIGNED
            HandoverStatus.PASSPORT_SIGNED -> HandoverStatus.COMPLETED
            else -> handover.status
        }
        handover.updatedAt = Instant.now()
        if (handover.status == HandoverStatus.COMPLETED) {
            val vehicle = handover.vehicle!!
            recordEvent(vehicle.id, vehicle, EventType.OWNERSHIP, "차량 인수인계 완료", "개인정보 삭제 및 차량 여권 전달 완료", "violet")
            notify(actor, "인수인계가 완료됐어요", "차량 여권과 검증 이력이 구매자에게 전달됐습니다.", "HANDOVER")
        }
        audit(actor, "HANDOVER_ADVANCED", "VehicleHandover", id.toString(), handover.status.name)
        return toHandover(handoverRepository.save(handover))
    }

    @Transactional
    fun readNotification(actor: String, id: Long): NotificationResponse {
        val notification = notificationRepository.findByIdOrNull(id)?.takeIf { it.actorId == actor } ?: throw NoSuchElementException("Notification $id was not found")
        notification.read = true
        return toNotification(notificationRepository.save(notification))
    }

    @Transactional(readOnly = true)
    fun audits(): List<AuditLogResponse> = auditRepository.findTop30ByOrderByCreatedAtDesc().map { AuditLogResponse(it.id, it.actorId, it.action, it.resourceType, it.resourceId, it.detail, it.signature, it.createdAt) }

    private fun requireVehicle(actor: String, externalId: String): com.hyundai.lifepass.domain.Vehicle {
        val vehicle = vehicleRepository.findByExternalId(externalId) ?: throw NoSuchElementException("Vehicle $externalId was not found")
        if ((vehicle.source == "SAMPLE" && !sampleDataEnabled) || (vehicle.source != "SAMPLE" && vehicle.ownerId != actor)) {
            throw org.springframework.security.access.AccessDeniedException("이 차량 데이터에 접근할 권한이 없습니다.")
        }
        return vehicle
    }
    private fun notify(actor: String, title: String, message: String, category: String) = notificationRepository.save(UserNotification(actorId = actor, title = title, message = message, category = category))
    private fun audit(actor: String, action: String, resourceType: String, resourceId: String, detail: String) = auditRepository.save(AuditLog(actorId = actor, action = action, resourceType = resourceType, resourceId = resourceId, detail = detail, signature = sign("$actor|$action|$resourceId|$detail|${Instant.now()}")))
    private fun recordEvent(vehicleId: Long, vehicle: com.hyundai.lifepass.domain.Vehicle, type: EventType, title: String, detail: String, tone: String) = eventRepository.save(VehicleEvent(vehicle = vehicle, type = type, title = title, detail = detail, tone = tone, signature = sign("$vehicleId|$title|$detail|${Instant.now()}")))
    private fun sign(value: String) = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it) }.take(24)
    private fun maskEmail(email: String): String { val parts = email.split("@"); return if (parts.size == 2) "${parts[0].take(2)}***@${parts[1]}" else "hidden" }
    private fun toCharging(it: ChargingReservation) = ChargingReservationResponse(it.id, it.vehicle!!.externalId, it.stationName, it.scheduledAt, it.targetSoc, it.estimatedCost, it.status, it.createdAt)
    private fun toService(it: ServiceBooking) = ServiceBookingResponse(it.id, it.vehicle!!.externalId, it.centerName, it.serviceType, it.scheduledAt, it.estimatedCost, it.status, it.createdAt)
    private fun toHandover(it: VehicleHandover) = HandoverResponse(it.id, it.vehicle!!.externalId, it.transferCode, it.buyerEmailMasked, it.status, listOf(HandoverStatus.INITIATED, HandoverStatus.PRIVACY_CLEARED, HandoverStatus.PASSPORT_SIGNED, HandoverStatus.COMPLETED).indexOf(it.status).plus(1).coerceAtLeast(1), it.expiresAt, it.updatedAt)
    private fun toNotification(it: UserNotification) = NotificationResponse(it.id, it.title, it.message, it.category, it.read, it.createdAt)
}
