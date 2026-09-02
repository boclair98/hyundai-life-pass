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

enum class EventType { HEALTH_SNAPSHOT, SOFTWARE_UPDATE, SERVICE, OWNERSHIP, ALERT }

@Entity
@Table(name = "vehicle_events")
class VehicleEvent(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vehicle_id", nullable = false)
    var vehicle: Vehicle? = null,

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    var type: EventType = EventType.HEALTH_SNAPSHOT,

    @Column(nullable = false, length = 140)
    var title: String = "",

    @Column(nullable = false, length = 240)
    var detail: String = "",

    @Column(nullable = false, length = 16)
    var tone: String = "mint",

    @Column(nullable = false, length = 80)
    var signature: String = "",

    @Column(nullable = false)
    var occurredAt: Instant = Instant.now(),
)
