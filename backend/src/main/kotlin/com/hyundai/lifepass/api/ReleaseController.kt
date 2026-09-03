package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.ReleaseService
import com.hyundai.lifepass.config.OperatorAccess
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/releases")
class ReleaseController(private val releaseService: ReleaseService, private val operatorAccess: OperatorAccess) {
    @GetMapping
    fun list() = releaseService.findAll()

    @PostMapping("/{id}/start")
    fun start(@PathVariable id: Long, @RequestHeader(value = "X-Coders-User", required = false) user: String?): Any { operatorAccess.require(user); return releaseService.start(id) }

    @PostMapping("/{id}/advance")
    fun advance(@PathVariable id: Long, @RequestHeader(value = "X-Coders-User", required = false) user: String?): Any { operatorAccess.require(user); return releaseService.advance(id) }

    @PostMapping("/{id}/pause")
    fun pause(@PathVariable id: Long, @RequestHeader(value = "X-Coders-User", required = false) user: String?): Any { operatorAccess.require(user); return releaseService.pause(id) }
}
