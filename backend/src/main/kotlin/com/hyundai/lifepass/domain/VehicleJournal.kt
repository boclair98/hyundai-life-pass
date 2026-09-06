package com.hyundai.lifepass.domain

import jakarta.persistence.*
import java.time.Instant
import java.time.LocalDate

@Entity
@Table(name = "vehicle_journal")
class VehicleJournal(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) var id: Long = 0,
    @Column(nullable = false) var vehicleId: Long = 0,
    @Column(nullable = false, length = 24) var category: String = "MAINTENANCE",
    @Column(nullable = false, length = 100) var title: String = "",
    @Column(nullable = false, length = 500) var note: String = "",
    @Column(nullable = false) var entryDate: LocalDate = LocalDate.now(),
    var amount: Long? = null,
    var odometer: Int? = null,
    @Column(nullable = false, length = 16) var status: String = "DONE",
    @Column(length = 16) var archivedStatus: String? = null,
    @Column(nullable = false) var createdAt: Instant = Instant.now(),
)
