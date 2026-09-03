package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.PlatformService
import com.hyundai.lifepass.config.OperatorAccess
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/platform")
class PlatformController(private val platformService: PlatformService, private val operatorAccess: OperatorAccess) {
    @GetMapping("/snapshot")
    fun snapshot(@RequestHeader(value = "X-Coders-User", required = false) user: String?) = platformService.snapshot(actor(user))

    @PostMapping("/vehicles/{externalId}/connect")
    fun connectVehicle(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable externalId: String) = platformService.connectVehicle(actor(user), externalId)

    @PostMapping("/charging-reservations")
    @ResponseStatus(HttpStatus.CREATED)
    fun reserveCharging(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @Valid @RequestBody request: CreateChargingReservationRequest) = platformService.reserveCharging(actor(user), request)

    @PostMapping("/charging-reservations/{id}/cancel")
    fun cancelCharging(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = platformService.cancelCharging(actor(user), id)

    @PostMapping("/service-bookings")
    @ResponseStatus(HttpStatus.CREATED)
    fun bookService(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @Valid @RequestBody request: CreateServiceBookingRequest) = platformService.bookService(actor(user), request)

    @PostMapping("/service-bookings/{id}/cancel")
    fun cancelService(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = platformService.cancelService(actor(user), id)

    @PostMapping("/handovers")
    @ResponseStatus(HttpStatus.CREATED)
    fun startHandover(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @Valid @RequestBody request: CreateHandoverRequest) = platformService.startHandover(actor(user), request)

    @PostMapping("/handovers/{id}/advance")
    fun advanceHandover(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = platformService.advanceHandover(actor(user), id)

    @PostMapping("/notifications/{id}/read")
    fun readNotification(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = platformService.readNotification(actor(user), id)

    @GetMapping("/audit-logs")
    fun audits(@RequestHeader(value = "X-Coders-User", required = false) user: String?): Any { operatorAccess.require(user); return platformService.audits() }

    private fun actor(user: String?) = user?.takeIf { it.isNotBlank() } ?: "demo-owner"
}
