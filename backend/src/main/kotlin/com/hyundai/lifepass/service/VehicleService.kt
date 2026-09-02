package com.hyundai.lifepass.service

import com.hyundai.lifepass.api.CreateEventRequest
import com.hyundai.lifepass.api.PassportResponse
import com.hyundai.lifepass.api.VehicleEventResponse
import com.hyundai.lifepass.api.VehicleSummary
import com.hyundai.lifepass.domain.Vehicle
import com.hyundai.lifepass.domain.VehicleEvent
import com.hyundai.lifepass.repository.VehicleEventRepository
import com.hyundai.lifepass.repository.VehicleRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant

@Service
class VehicleService(
    private val vehicleRepository: VehicleRepository,
    private val eventRepository: VehicleEventRepository,
) {
    @Transactional(readOnly = true)
    fun findAll(): List<VehicleSummary> = vehicleRepository.findAll().map(::toSummary)

    @Transactional(readOnly = true)
    fun find(id: Long): VehicleSummary = toSummary(requireVehicle(id))

    @Transactional
    fun appendEvent(id: Long, request: CreateEventRequest): VehicleEventResponse {
        val vehicle = requireVehicle(id)
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
    fun events(id: Long): List<VehicleEventResponse> {
        requireVehicle(id)
        return eventRepository.findTop20ByVehicleIdOrderByOccurredAtDesc(id).map(::toEvent)
    }

    @Transactional(readOnly = true)
    fun passport(id: Long): PassportResponse {
        val vehicle = requireVehicle(id)
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

    private fun requireVehicle(id: Long): Vehicle = vehicleRepository.findByIdOrNull(id)
        ?: throw NoSuchElementException("Vehicle $id was not found")

    private fun toSummary(vehicle: Vehicle) = VehicleSummary(
        id = vehicle.id,
        externalId = vehicle.externalId,
        name = vehicle.name,
        trim = vehicle.trim,
        plate = vehicle.plate,
        powertrain = vehicle.powertrain,
        batterySoc = vehicle.batterySoc,
        batterySoh = vehicle.batterySoh,
        healthScore = vehicle.healthScore,
        rangeKm = vehicle.rangeKm,
        odometerKm = vehicle.odometerKm,
        nextServiceKm = vehicle.nextServiceKm,
        location = vehicle.location,
        softwareVersion = vehicle.softwareVersion,
        chargingState = vehicle.chargingState,
        updatedAt = vehicle.updatedAt,
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
