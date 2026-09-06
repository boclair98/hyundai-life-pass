package com.hyundai.lifepass.api

import com.hyundai.lifepass.config.UserSession
import com.hyundai.lifepass.domain.VehicleJournal
import com.hyundai.lifepass.repository.VehicleJournalRepository
import com.hyundai.lifepass.repository.VehicleRepository
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.*
import org.springframework.data.repository.findByIdOrNull
import org.springframework.http.HttpStatus
import org.springframework.security.access.AccessDeniedException
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.*
import java.time.LocalDate

data class JournalRequest(
    @field:Pattern(regexp = "MAINTENANCE|CHARGE|FUEL|INSURANCE|WASH|PARKING|OTHER") val category: String,
    @field:NotBlank @field:Size(max = 100) val title: String,
    @field:Size(max = 500) val note: String = "",
    val entryDate: LocalDate,
    @field:Min(0) @field:Max(1000000000) val amount: Long? = null,
    @field:Min(0) @field:Max(10000000) val odometer: Int? = null,
    @field:Pattern(regexp = "DONE|PLANNED") val status: String = "DONE",
)

data class JournalStatusRequest(@field:Pattern(regexp = "DONE|PLANNED|ARCHIVED|RESTORE") val status: String)

@RestController
@RequestMapping("/api/v1/vehicles/{vehicleId}/journal")
class VehicleJournalController(
    private val vehicles: VehicleRepository,
    private val journal: VehicleJournalRepository,
    private val userSession: UserSession,
) {
    private fun requireOwner(request: HttpServletRequest, vehicleId: Long) {
        val vehicle = vehicles.findByIdOrNull(vehicleId) ?: throw NoSuchElementException("차량을 찾지 못했습니다.")
        if (vehicle.ownerId != userSession.actor(request)) throw AccessDeniedException("연결한 내 차량의 기록만 관리할 수 있습니다.")
    }

    @GetMapping
    @Transactional(readOnly = true)
    fun list(request: HttpServletRequest, @PathVariable vehicleId: Long): List<VehicleJournal> {
        requireOwner(request, vehicleId)
        return journal.findByVehicleIdOrderByEntryDateDescCreatedAtDesc(vehicleId)
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    fun create(request: HttpServletRequest, @PathVariable vehicleId: Long, @Valid @RequestBody body: JournalRequest): VehicleJournal {
        requireOwner(request, vehicleId)
        require(body.entryDate.year in 1900..2200) { "날짜를 확인해 주세요." }
        require(body.status != "DONE" || !body.entryDate.isAfter(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))) { "미래 날짜는 예정 일정으로 저장해 주세요." }
        require(journal.countByVehicleId(vehicleId) < 10000) { "차량별 기록 보관 한도에 도달했습니다." }
        return journal.save(VehicleJournal(vehicleId = vehicleId, category = body.category, title = body.title.trim(),
            note = body.note.trim(), entryDate = body.entryDate, amount = body.amount, odometer = body.odometer, status = body.status))
    }

    @PatchMapping("/{entryId}/status")
    @Transactional
    fun changeStatus(request: HttpServletRequest, @PathVariable vehicleId: Long, @PathVariable entryId: Long,
                     @Valid @RequestBody body: JournalStatusRequest): VehicleJournal {
        requireOwner(request, vehicleId)
        val entry = journal.findByIdOrNull(entryId) ?: throw NoSuchElementException("기록을 찾지 못했습니다.")
        if (entry.vehicleId != vehicleId) throw AccessDeniedException("이 기록에 접근할 수 없습니다.")
        require(body.status != "DONE" || !entry.entryDate.isAfter(LocalDate.now(java.time.ZoneId.of("Asia/Seoul")))) { "예정일이 되면 완료로 변경할 수 있습니다." }
        if (body.status == "ARCHIVED" && entry.status != "ARCHIVED") entry.archivedStatus = entry.status
        entry.status = if (body.status == "RESTORE") {
            require(entry.status == "ARCHIVED") { "보관한 기록만 복원할 수 있습니다." }
            entry.archivedStatus ?: "PLANNED"
        } else body.status
        return journal.save(entry)
    }
}
