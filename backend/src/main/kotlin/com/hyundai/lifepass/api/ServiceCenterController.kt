package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.ServiceCenterProvider
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/service-centers")
class ServiceCenterController(private val serviceCenterProvider: ServiceCenterProvider) {
    @GetMapping
    fun search(
        @RequestParam(defaultValue = "37.5446") latitude: Double,
        @RequestParam(defaultValue = "127.0559") longitude: Double,
        @RequestParam(defaultValue = "15000") radius: Int,
    ) = serviceCenterProvider.search(latitude, longitude, radius)
}
