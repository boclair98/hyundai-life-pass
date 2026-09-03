package com.hyundai.lifepass.api

import com.hyundai.lifepass.domain.EventType
import com.hyundai.lifepass.domain.Powertrain
import com.hyundai.lifepass.domain.ReleaseStatus
import java.time.Instant

data class VehicleSummary(
    val id: Long,
    val externalId: String,
    val source: String,
    val name: String,
    val trim: String,
    val plate: String,
    val powertrain: Powertrain,
    val batterySoc: Int?,
    val batterySoh: Int?,
    val healthScore: Int?,
    val rangeKm: Int?,
    val odometerKm: Int?,
    val nextServiceKm: Int?,
    val location: String?,
    val softwareVersion: String?,
    val chargingState: String,
    val healthChecks: List<VehicleHealthCheckResponse>,
    val checkedWarnings: Int,
    val warningCount: Int,
    val connectedService: ConnectedServiceResponse?,
    val updatedAt: Instant,
    val tirePressure: TirePressureResponse = TirePressureResponse(),
)

data class VehicleHealthCheckResponse(
    val id: String,
    val label: String,
    val state: String,
)

data class ConnectedServiceResponse(
    val subscribeDate: String?,
    val endDate: String?,
)

/**
 * Tire telemetry is deliberately explicit about its coverage. Hyundai's
 * currently approved warning endpoint reports only the vehicle-level warning;
 * it does not expose a PSI reading per wheel. Keeping the source and
 * availability in the API prevents clients from presenting made-up values and
 * gives us a backwards-compatible place to add exact wheel telemetry later.
 */
data class TirePressureResponse(
    val warning: Boolean? = null,
    val values: Map<String, Double>? = null,
    val unit: String? = null,
    val exactValuesAvailable: Boolean = false,
    val source: String = "HYUNDAI_WARNING_ONLY",
)

data class VehicleEventResponse(
    val id: Long,
    val type: EventType,
    val title: String,
    val detail: String,
    val tone: String,
    val signature: String,
    val occurredAt: Instant,
)

data class CreateEventRequest(
    val type: EventType,
    val title: String,
    val detail: String,
    val tone: String = "mint",
)

data class ReleaseResponse(
    val id: Long,
    val version: String,
    val title: String,
    val status: ReleaseStatus,
    val target: String,
    val progress: Int,
    val risk: String,
    val createdAt: Instant,
)

data class PassportResponse(
    val vehicle: VehicleSummary,
    val trustScore: Int?,
    val signedEvents: Int,
    val batterySoh: Int?,
    val software: String?,
    val handoverReady: Boolean,
    val hash: String,
    val events: List<VehicleEventResponse>,
)
