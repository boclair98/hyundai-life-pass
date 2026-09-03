package com.hyundai.lifepass.api

import com.hyundai.lifepass.domain.HandoverStatus
import com.hyundai.lifepass.domain.ReservationStatus
import com.hyundai.lifepass.domain.ServiceStatus
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.Future
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import java.time.Instant

data class StationResponse(
    val id: Long,
    val name: String,
    val address: String,
    val distanceKm: Double,
    val available: Int,
    val total: Int,
    val speedKw: Int,
    val pricePerKwh: Int,
    val etaMinutes: Int,
)

data class CreateChargingReservationRequest(
    @field:NotBlank val vehicleExternalId: String,
    val stationId: Long,
    @field:Future val scheduledAt: Instant,
    @field:Min(50) @field:Max(100) val targetSoc: Int = 80,
)

data class ChargingReservationResponse(
    val id: Long,
    val vehicleExternalId: String,
    val stationName: String,
    val scheduledAt: Instant,
    val targetSoc: Int,
    val estimatedCost: Int,
    val status: ReservationStatus,
    val createdAt: Instant,
)

data class CreateServiceBookingRequest(
    @field:NotBlank val vehicleExternalId: String,
    @field:NotBlank val centerName: String,
    @field:NotBlank val serviceType: String,
    @field:Future val scheduledAt: Instant,
)

data class ServiceBookingResponse(
    val id: Long,
    val vehicleExternalId: String,
    val centerName: String,
    val serviceType: String,
    val scheduledAt: Instant,
    val estimatedCost: Int,
    val status: ServiceStatus,
    val createdAt: Instant,
)

data class CreateHandoverRequest(
    @field:NotBlank val vehicleExternalId: String,
    @field:Email val buyerEmail: String,
)

data class HandoverResponse(
    val id: Long,
    val vehicleExternalId: String,
    val transferCode: String,
    val buyerEmailMasked: String,
    val status: HandoverStatus,
    val step: Int,
    val expiresAt: Instant,
    val updatedAt: Instant,
)

data class NotificationResponse(
    val id: Long,
    val title: String,
    val message: String,
    val category: String,
    val read: Boolean,
    val createdAt: Instant,
)

data class AuditLogResponse(
    val id: Long,
    val actorId: String,
    val action: String,
    val resourceType: String,
    val resourceId: String,
    val detail: String,
    val signature: String,
    val createdAt: Instant,
)

data class PlatformSnapshotResponse(
    val actor: String,
    val environment: String,
    val stations: List<StationResponse>,
    val chargingReservations: List<ChargingReservationResponse>,
    val serviceBookings: List<ServiceBookingResponse>,
    val handovers: List<HandoverResponse>,
    val notifications: List<NotificationResponse>,
    val unreadNotifications: Int,
)
