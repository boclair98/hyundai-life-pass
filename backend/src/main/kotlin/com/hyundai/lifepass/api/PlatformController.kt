package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.PlatformService
import com.hyundai.lifepass.config.OperatorAccess
import com.hyundai.lifepass.config.UserSession
import jakarta.servlet.http.HttpServletRequest
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
class PlatformController(
    private val platformService: PlatformService,
    private val operatorAccess: OperatorAccess,
    private val userSession: UserSession,
) {
    @GetMapping("/snapshot")
    fun snapshot(request: HttpServletRequest) = platformService.snapshot(userSession.actor(request))

    @PostMapping("/vehicles/{externalId}/connect")
    fun connectVehicle(request: HttpServletRequest, @PathVariable externalId: String) = platformService.connectVehicle(userSession.actor(request), externalId)

    @PostMapping("/charging-reservations")
    @ResponseStatus(HttpStatus.CREATED)
    fun reserveCharging(httpRequest: HttpServletRequest, @Valid @RequestBody request: CreateChargingReservationRequest) = platformService.reserveCharging(userSession.actor(httpRequest), request)

    @PostMapping("/charging-reservations/{id}/cancel")
    fun cancelCharging(request: HttpServletRequest, @PathVariable id: Long) = platformService.cancelCharging(userSession.actor(request), id)

    @PostMapping("/service-bookings")
    @ResponseStatus(HttpStatus.CREATED)
    fun bookService(httpRequest: HttpServletRequest, @Valid @RequestBody request: CreateServiceBookingRequest) = platformService.bookService(userSession.actor(httpRequest), request)

    @PostMapping("/service-bookings/{id}/cancel")
    fun cancelService(request: HttpServletRequest, @PathVariable id: Long) = platformService.cancelService(userSession.actor(request), id)

    @PostMapping("/handovers")
    @ResponseStatus(HttpStatus.CREATED)
    fun startHandover(httpRequest: HttpServletRequest, @Valid @RequestBody request: CreateHandoverRequest) = platformService.startHandover(userSession.actor(httpRequest), request)

    @PostMapping("/handovers/{id}/advance")
    fun advanceHandover(request: HttpServletRequest, @PathVariable id: Long) = platformService.advanceHandover(userSession.actor(request), id)

    @PostMapping("/notifications/{id}/read")
    fun readNotification(request: HttpServletRequest, @PathVariable id: Long) = platformService.readNotification(userSession.actor(request), id)

    @GetMapping("/audit-logs")
    fun audits(@RequestHeader(value = "X-Coders-User", required = false) user: String?): Any { operatorAccess.require(user); return platformService.audits() }
}
