package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.VehicleService
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/vehicles")
class VehicleController(private val vehicleService: VehicleService) {
    @GetMapping
    fun list(@RequestHeader(value = "X-Coders-User", required = false) user: String?) = vehicleService.findAll(actor(user))

    @GetMapping("/{id}")
    fun get(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = vehicleService.find(actor(user), id)

    @GetMapping("/{id}/events")
    fun events(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = vehicleService.events(actor(user), id)

    @PostMapping("/{id}/events")
    @ResponseStatus(HttpStatus.CREATED)
    fun appendEvent(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long, @RequestBody request: CreateEventRequest) = vehicleService.appendEvent(actor(user), id, request)

    @GetMapping("/{id}/passport")
    fun passport(@RequestHeader(value = "X-Coders-User", required = false) user: String?, @PathVariable id: Long) = vehicleService.passport(actor(user), id)

    private fun actor(user: String?) = user?.takeIf(String::isNotBlank) ?: "demo-owner"
}
