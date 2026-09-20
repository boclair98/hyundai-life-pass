package com.hyundai.lifepass.api

import com.hyundai.lifepass.config.UserSession
import com.hyundai.lifepass.service.VehicleJournalService
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.*
import org.springframework.http.HttpStatus
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
    private val journalService: VehicleJournalService,
    private val userSession: UserSession,
) {
    @GetMapping
    fun list(request: HttpServletRequest, @PathVariable vehicleId: Long) = journalService.list(userSession.actor(request), vehicleId)

    @GetMapping("/report")
    fun report(request: HttpServletRequest, @PathVariable vehicleId: Long, @RequestParam(required = false) month: String?) =
        journalService.report(userSession.actor(request), vehicleId, month)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(request: HttpServletRequest, @PathVariable vehicleId: Long, @Valid @RequestBody body: JournalRequest) =
        journalService.create(userSession.actor(request), vehicleId, body)

    @PatchMapping("/{entryId}/status")
    fun changeStatus(request: HttpServletRequest, @PathVariable vehicleId: Long, @PathVariable entryId: Long,
                     @Valid @RequestBody body: JournalStatusRequest) =
        journalService.changeStatus(userSession.actor(request), vehicleId, entryId, body)
}
