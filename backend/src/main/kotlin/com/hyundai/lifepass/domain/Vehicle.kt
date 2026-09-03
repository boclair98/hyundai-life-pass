package com.hyundai.lifepass.domain

import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.Instant

enum class Powertrain { EV, HYBRID, ICE }

@Entity
@Table(name = "vehicles")
class Vehicle(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,

    @Column(nullable = false, unique = true, length = 80)
    var externalId: String = "",

    @Column(length = 160)
    var ownerId: String? = null,

    @Column(nullable = false, length = 40)
    var source: String = "SAMPLE",

    @Column(nullable = false, length = 80)
    var name: String = "",

    @Column(nullable = false, length = 120)
    var trim: String = "",

    @Column(nullable = false, length = 30)
    var plate: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var powertrain: Powertrain = Powertrain.EV,

    @Column(nullable = false)
    var batterySoc: Int = 0,

    @Column(nullable = false)
    var batterySoh: Int = 0,

    @Column(nullable = false)
    var healthScore: Int = 0,

    @Column(nullable = false)
    var rangeKm: Int = 0,

    @Column(nullable = false)
    var odometerKm: Int = 0,

    @Column(nullable = false)
    var nextServiceKm: Int = 0,

    @Column(nullable = false, length = 100)
    var location: String = "",

    @Column(nullable = false, length = 20)
    var softwareVersion: String = "",

    @Column(nullable = false, length = 40)
    var chargingState: String = "연결 안 됨",

    @Column(nullable = false)
    var batteryStatusAvailable: Boolean = false,

    @Column(nullable = false)
    var rangeStatusAvailable: Boolean = false,

    @Column(nullable = false)
    var odometerStatusAvailable: Boolean = false,

    @Column(nullable = false)
    var chargingStatusAvailable: Boolean = false,

    var lowFuelWarning: Boolean? = null,

    var tirePressureWarning: Boolean? = null,

    var lampWireWarning: Boolean? = null,

    var smartKeyBatteryWarning: Boolean? = null,

    var washerFluidWarning: Boolean? = null,

    var brakeOilWarning: Boolean? = null,

    var engineOilWarning: Boolean? = null,

    @Column(length = 8)
    var connectedServiceStart: String? = null,

    @Column(length = 8)
    var connectedServiceEnd: String? = null,

    @Column(nullable = false)
    var updatedAt: Instant = Instant.now(),

    @OneToMany(mappedBy = "vehicle", cascade = [CascadeType.ALL], fetch = FetchType.LAZY, orphanRemoval = true)
    var events: MutableList<VehicleEvent> = mutableListOf(),
)
