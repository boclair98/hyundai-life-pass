package com.hyundai.lifepass.repository

import com.hyundai.lifepass.domain.VehicleJournal
import org.springframework.data.jpa.repository.JpaRepository
import java.time.LocalDate

interface VehicleJournalRepository : JpaRepository<VehicleJournal, Long> {
    fun findByVehicleIdOrderByEntryDateDescCreatedAtDesc(vehicleId: Long): List<VehicleJournal>
    fun findByVehicleIdAndEntryDateGreaterThanEqualAndEntryDateLessThanAndStatusOrderByEntryDateDescCreatedAtDesc(
        vehicleId: Long,
        start: LocalDate,
        endExclusive: LocalDate,
        status: String,
    ): List<VehicleJournal>
    fun countByVehicleId(vehicleId: Long): Long
}
