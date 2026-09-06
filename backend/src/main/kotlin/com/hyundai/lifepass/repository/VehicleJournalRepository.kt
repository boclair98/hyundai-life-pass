package com.hyundai.lifepass.repository

import com.hyundai.lifepass.domain.VehicleJournal
import org.springframework.data.jpa.repository.JpaRepository

interface VehicleJournalRepository : JpaRepository<VehicleJournal, Long> {
    fun findByVehicleIdOrderByEntryDateDescCreatedAtDesc(vehicleId: Long): List<VehicleJournal>
    fun countByVehicleId(vehicleId: Long): Long
}
