package com.hyundai.lifepass.repository

import com.hyundai.lifepass.domain.Vehicle
import org.springframework.data.jpa.repository.JpaRepository

interface VehicleRepository : JpaRepository<Vehicle, Long> {
    fun findByExternalId(externalId: String): Vehicle?
    fun findByOwnerId(ownerId: String): List<Vehicle>
    fun findBySource(source: String): List<Vehicle>
    fun findByOwnerIdAndSource(ownerId: String, source: String): List<Vehicle>
}
