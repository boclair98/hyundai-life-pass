package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.ChargingStationProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/charging-stations")
class ChargingStationController(private val chargingStationProvider: ChargingStationProvider) {
    @GetMapping
    fun search(
        @RequestParam(defaultValue = "37.5446") latitude: Double,
        @RequestParam(defaultValue = "127.0559") longitude: Double,
        @RequestParam(defaultValue = "30") radiusKm: Double,
    ) = chargingStationProvider.getStations(latitude, longitude, radiusKm)
}
