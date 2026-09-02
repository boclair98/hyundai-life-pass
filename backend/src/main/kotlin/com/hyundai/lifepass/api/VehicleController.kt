package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.VehicleService
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
class VehicleController(private val vehicleService: VehicleService) {
    @GetMapping
    fun list() = vehicleService.findAll()

    @GetMapping("/{id}")
    fun get(@PathVariable id: Long) = vehicleService.find(id)

    @GetMapping("/{id}/events")
    fun events(@PathVariable id: Long) = vehicleService.events(id)

    @PostMapping("/{id}/events")
    @ResponseStatus(HttpStatus.CREATED)
    fun appendEvent(@PathVariable id: Long, @RequestBody request: CreateEventRequest) = vehicleService.appendEvent(id, request)

    @GetMapping("/{id}/passport")
    fun passport(@PathVariable id: Long) = vehicleService.passport(id)
}
