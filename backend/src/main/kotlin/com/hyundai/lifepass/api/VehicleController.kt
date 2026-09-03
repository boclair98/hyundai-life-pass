package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.VehicleService
import com.hyundai.lifepass.config.UserSession
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/vehicles")
class VehicleController(private val vehicleService: VehicleService, private val userSession: UserSession) {
    @GetMapping
    fun list(request: HttpServletRequest) = vehicleService.findAll(userSession.actor(request))

    @GetMapping("/{id}")
    fun get(request: HttpServletRequest, @PathVariable id: Long) = vehicleService.find(userSession.actor(request), id)

    @GetMapping("/{id}/events")
    fun events(request: HttpServletRequest, @PathVariable id: Long) = vehicleService.events(userSession.actor(request), id)

    @PostMapping("/{id}/events")
    @ResponseStatus(HttpStatus.CREATED)
    fun appendEvent(httpRequest: HttpServletRequest, @PathVariable id: Long, @RequestBody request: CreateEventRequest) = vehicleService.appendEvent(userSession.actor(httpRequest), id, request)

    @GetMapping("/{id}/passport")
    fun passport(request: HttpServletRequest, @PathVariable id: Long) = vehicleService.passport(userSession.actor(request), id)
}
