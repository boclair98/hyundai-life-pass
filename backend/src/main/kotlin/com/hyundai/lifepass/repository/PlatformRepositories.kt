package com.hyundai.lifepass.repository

import com.hyundai.lifepass.domain.AuditLog
import com.hyundai.lifepass.domain.ChargingReservation
import com.hyundai.lifepass.domain.ServiceBooking
import com.hyundai.lifepass.domain.UserNotification
import com.hyundai.lifepass.domain.VehicleHandover
import com.hyundai.lifepass.domain.HyundaiConnection
import com.hyundai.lifepass.domain.HyundaiOAuthState
import org.springframework.data.jpa.repository.JpaRepository

interface ChargingReservationRepository : JpaRepository<ChargingReservation, Long> {
    fun findTop10ByActorIdOrderByCreatedAtDesc(actorId: String): List<ChargingReservation>
}

interface ServiceBookingRepository : JpaRepository<ServiceBooking, Long> {
    fun findTop10ByActorIdOrderByCreatedAtDesc(actorId: String): List<ServiceBooking>
}

interface HandoverRepository : JpaRepository<VehicleHandover, Long> {
    fun findTop10ByActorIdOrderByUpdatedAtDesc(actorId: String): List<VehicleHandover>
}

interface NotificationRepository : JpaRepository<UserNotification, Long> {
    fun findTop20ByActorIdOrderByCreatedAtDesc(actorId: String): List<UserNotification>
}

interface AuditLogRepository : JpaRepository<AuditLog, Long> {
    fun findTop30ByOrderByCreatedAtDesc(): List<AuditLog>
}

interface HyundaiConnectionRepository : JpaRepository<HyundaiConnection, Long> {
    fun findByActorId(actorId: String): HyundaiConnection?
    fun findByHyundaiUserId(hyundaiUserId: String): HyundaiConnection?
}

interface HyundaiOAuthStateRepository : JpaRepository<HyundaiOAuthState, Long> {
    fun findByStateToken(stateToken: String): HyundaiOAuthState?
}
