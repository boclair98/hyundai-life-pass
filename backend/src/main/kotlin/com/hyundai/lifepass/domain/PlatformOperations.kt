package com.hyundai.lifepass.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.Table
import java.time.Instant

enum class ReservationStatus { CONFIRMED, COMPLETED, CANCELLED }
enum class ServiceStatus { REQUESTED, CONFIRMED, IN_SERVICE, COMPLETED, CANCELLED }
enum class HandoverStatus { INITIATED, PRIVACY_CLEARED, PASSPORT_SIGNED, COMPLETED, CANCELLED }

@Entity
@Table(name = "charging_reservations")
class ChargingReservation(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, length = 160)
    var actorId: String = "",
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    var vehicle: Vehicle? = null,
    @Column(nullable = false)
    var stationId: Long = 0,
    @Column(nullable = false, length = 160)
    var stationName: String = "",
    @Column(nullable = false)
    var scheduledAt: Instant = Instant.now(),
    @Column(nullable = false)
    var targetSoc: Int = 80,
    @Column(nullable = false)
    var estimatedCost: Int = 0,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    var status: ReservationStatus = ReservationStatus.CONFIRMED,
    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "service_bookings")
class ServiceBooking(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, length = 160)
    var actorId: String = "",
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    var vehicle: Vehicle? = null,
    @Column(nullable = false, length = 160)
    var centerName: String = "",
    @Column(nullable = false, length = 160)
    var serviceType: String = "",
    @Column(nullable = false)
    var scheduledAt: Instant = Instant.now(),
    @Column(nullable = false)
    var estimatedCost: Int = 0,
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    var status: ServiceStatus = ServiceStatus.CONFIRMED,
    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "handovers")
class VehicleHandover(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, length = 160)
    var actorId: String = "",
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    var vehicle: Vehicle? = null,
    @Column(nullable = false, unique = true, length = 32)
    var transferCode: String = "",
    @Column(nullable = false, length = 160)
    var buyerEmailMasked: String = "",
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    var status: HandoverStatus = HandoverStatus.INITIATED,
    @Column(nullable = false)
    var expiresAt: Instant = Instant.now().plusSeconds(86400),
    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
    @Column(nullable = false)
    var updatedAt: Instant = Instant.now(),
)

@Entity
@Table(name = "notifications")
class UserNotification(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, length = 160)
    var actorId: String = "",
    @Column(nullable = false, length = 180)
    var title: String = "",
    @Column(nullable = false, length = 320)
    var message: String = "",
    @Column(nullable = false, length = 32)
    var category: String = "SYSTEM",
    @Column(nullable = false)
    var read: Boolean = false,
    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
)

@Entity
@Table(name = "audit_logs")
class AuditLog(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, length = 160)
    var actorId: String = "",
    @Column(nullable = false, length = 80)
    var action: String = "",
    @Column(nullable = false, length = 80)
    var resourceType: String = "",
    @Column(nullable = false, length = 80)
    var resourceId: String = "",
    @Column(nullable = false, length = 500)
    var detail: String = "",
    @Column(nullable = false, length = 80)
    var signature: String = "",
    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
)
