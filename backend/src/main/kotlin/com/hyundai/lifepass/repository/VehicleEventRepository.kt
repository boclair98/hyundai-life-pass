package com.hyundai.lifepass.repository

import com.hyundai.lifepass.domain.VehicleEvent
import org.springframework.data.jpa.repository.JpaRepository

interface VehicleEventRepository : JpaRepository<VehicleEvent, Long> {
    fun findTop20ByVehicleIdOrderByOccurredAtDesc(vehicleId: Long): List<VehicleEvent>
}
