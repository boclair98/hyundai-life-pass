package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.ReleaseService
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/releases")
class ReleaseController(private val releaseService: ReleaseService) {
    @GetMapping
    fun list() = releaseService.findAll()

    @PostMapping("/{id}/start")
    fun start(@PathVariable id: Long) = releaseService.start(id)
}
