package com.hyundai.lifepass.service

import com.hyundai.lifepass.api.CreateEventRequest
import com.hyundai.lifepass.api.ConnectedServiceResponse
import com.hyundai.lifepass.api.PassportResponse
import com.hyundai.lifepass.api.TirePressureResponse
import com.hyundai.lifepass.api.VehicleEventResponse
import com.hyundai.lifepass.api.VehicleHealthCheckResponse
import com.hyundai.lifepass.api.VehicleSummary
import com.hyundai.lifepass.domain.Vehicle
import com.hyundai.lifepass.domain.VehicleEvent
import com.hyundai.lifepass.repository.VehicleEventRepository
import com.hyundai.lifepass.repository.VehicleRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant

@Service
class VehicleService(
    private val vehicleRepository: VehicleRepository,
    private val eventRepository: VehicleEventRepository,
    @Value("\${lifepass.sample-data-enabled:true}") private val sampleDataEnabled: Boolean,
) {
    @Transactional(readOnly = true)
    fun findAll(actor: String): List<VehicleSummary> = buildList {
        addAll(vehicleRepository.findByOwnerId(actor))
        if (sampleDataEnabled) addAll(vehicleRepository.findBySource("SAMPLE"))
    }.distinctBy(Vehicle::id).map(::toSummary)

    @Transactional(readOnly = true)
    fun find(actor: String, id: Long): VehicleSummary = toSummary(requireVehicle(actor, id))

    @Transactional
    fun appendEvent(actor: String, id: Long, request: CreateEventRequest): VehicleEventResponse {
        val vehicle = requireVehicle(actor, id)
        val event = VehicleEvent(
            vehicle = vehicle,
            type = request.type,
            title = request.title,
            detail = request.detail,
            tone = request.tone,
            signature = sign("$id|${request.title}|${request.detail}|${Instant.now()}"),
        )
        vehicle.updatedAt = Instant.now()
        vehicleRepository.save(vehicle)
        return toEvent(eventRepository.save(event))
    }

    @Transactional(readOnly = true)
    fun events(actor: String, id: Long): List<VehicleEventResponse> {
        requireVehicle(actor, id)
        return eventRepository.findTop20ByVehicleIdOrderByOccurredAtDesc(id).map(::toEvent)
    }

    @Transactional(readOnly = true)
    fun passport(actor: String, id: Long): PassportResponse {
        val vehicle = requireVehicle(actor, id)
        val events = eventRepository.findTop20ByVehicleIdOrderByOccurredAtDesc(id).map(::toEvent)
        return PassportResponse(
            vehicle = toSummary(vehicle),
            trustScore = vehicle.healthScore,
            signedEvents = events.size,
            batterySoh = vehicle.batterySoh,
            software = vehicle.softwareVersion,
            handoverReady = true,
            hash = sign("passport:$id:${vehicle.updatedAt}"),
            events = events,
        )
    }

    private fun requireVehicle(actor: String, id: Long): Vehicle {
        val vehicle = vehicleRepository.findByIdOrNull(id) ?: throw NoSuchElementException("Vehicle $id was not found")
        if (vehicle.ownerId != actor && !(sampleDataEnabled && vehicle.source == "SAMPLE")) {
            throw AccessDeniedException("이 차량 데이터에 접근할 권한이 없습니다.")
        }
        return vehicle
    }

    private fun toSummary(vehicle: Vehicle) = VehicleSummary(
        id = vehicle.id,
        externalId = vehicle.externalId,
        source = vehicle.source,
        name = vehicle.name,
        trim = vehicle.trim,
        plate = vehicle.plate,
        powertrain = vehicle.powertrain,
        batterySoc = vehicle.batterySoc.takeIf { vehicle.source == "SAMPLE" || vehicle.batteryStatusAvailable },
        batterySoh = vehicle.batterySoh.takeIf { vehicle.source == "SAMPLE" },
        healthScore = vehicle.healthScore.takeIf { vehicle.source == "SAMPLE" },
        rangeKm = vehicle.rangeKm.takeIf { vehicle.source == "SAMPLE" || vehicle.rangeStatusAvailable },
        odometerKm = vehicle.odometerKm.takeIf { vehicle.source == "SAMPLE" || vehicle.odometerStatusAvailable },
        nextServiceKm = vehicle.nextServiceKm.takeIf { vehicle.source == "SAMPLE" },
        location = vehicle.location.takeIf { vehicle.source == "SAMPLE" && it.isNotBlank() },
        softwareVersion = vehicle.softwareVersion.takeIf { vehicle.source == "SAMPLE" && it.isNotBlank() },
        chargingState = vehicle.chargingState,
        chargingTargetSoc = vehicle.chargingTargetSoc,
        chargingRemainingMinutes = vehicle.chargingRemainingMinutes,
        chargingPlugType = vehicle.chargingPlugType,
        dataTimestamp = vehicle.dataTimestamp,
        healthChecks = healthChecks(vehicle),
        checkedWarnings = healthChecks(vehicle).count { it.state != "UNAVAILABLE" },
        warningCount = healthChecks(vehicle).count { it.state == "WARNING" },
        connectedService = if (vehicle.connectedServiceStart != null || vehicle.connectedServiceEnd != null) ConnectedServiceResponse(
            subscribeDate = vehicle.connectedServiceStart,
            endDate = vehicle.connectedServiceEnd,
        ) else null,
        updatedAt = vehicle.updatedAt,
        tirePressure = TirePressureResponse(
            warning = vehicle.tirePressureWarning,
            values = null,
            unit = null,
            exactValuesAvailable = false,
            source = "HYUNDAI_WARNING_ONLY",
        ),
    )

    private fun healthChecks(vehicle: Vehicle) = listOf(
        healthCheck("LOW_FUEL", "연료 부족", vehicle.lowFuelWarning),
        healthCheck("TIRE_PRESSURE", "타이어 공기압", vehicle.tirePressureWarning),
        healthCheck("LAMP_WIRE", "등화 장치", vehicle.lampWireWarning),
        healthCheck("SMART_KEY_BATTERY", "스마트키 배터리", vehicle.smartKeyBatteryWarning),
        healthCheck("WASHER_FLUID", "워셔액", vehicle.washerFluidWarning),
        healthCheck("BRAKE_OIL", "브레이크액", vehicle.brakeOilWarning),
        healthCheck("ENGINE_OIL", "엔진오일", vehicle.engineOilWarning),
    )

    private fun healthCheck(id: String, label: String, warning: Boolean?) = VehicleHealthCheckResponse(
        id = id,
        label = label,
        state = when (warning) {
            true -> "WARNING"
            false -> "CLEAR"
            null -> "UNAVAILABLE"
        },
    )

    private fun toEvent(event: VehicleEvent) = VehicleEventResponse(
        id = event.id,
        type = event.type,
        title = event.title,
        detail = event.detail,
        tone = event.tone,
        signature = event.signature,
        occurredAt = event.occurredAt,
    )

    private fun sign(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
        .take(16)
}
