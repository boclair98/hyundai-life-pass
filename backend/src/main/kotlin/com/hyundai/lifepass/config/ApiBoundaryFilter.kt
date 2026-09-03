package com.hyundai.lifepass.config

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.MDC
import org.springframework.beans.factory.annotation.Value
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class ApiBoundaryFilter(
    @Value("\${lifepass.rate-limit-per-minute:240}") private val limitPerMinute: Int,
) : OncePerRequestFilter() {
    private val windows = ConcurrentHashMap<String, RequestWindow>()

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        !request.requestURI.startsWith("/api/") || request.requestURI.startsWith("/api/v1/integrations/hyundai/callbacks/")

    override fun doFilterInternal(request: HttpServletRequest, response: HttpServletResponse, chain: FilterChain) {
        val requestId = request.getHeader("X-Request-Id")
            ?.takeIf { it.length <= 64 && it.matches(Regex("[A-Za-z0-9._-]+")) }
            ?: UUID.randomUUID().toString()
        response.setHeader("X-Request-Id", requestId)
        response.setHeader("X-Content-Type-Options", "nosniff")
        response.setHeader("X-Frame-Options", "DENY")
        response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin")
        response.setHeader("Permissions-Policy", "camera=(), microphone=(), payment=(), geolocation=(self)")

        MDC.put("requestId", requestId)
        try {
            if (!allow(request)) {
                response.status = 429
                response.contentType = "application/json;charset=UTF-8"
                response.setHeader("Retry-After", "60")
                response.writer.write("{\"error\":\"요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.\",\"requestId\":\"$requestId\"}")
                return
            }
            chain.doFilter(request, response)
        } finally {
            MDC.remove("requestId")
        }
    }

    private fun allow(request: HttpServletRequest): Boolean {
        if (limitPerMinute <= 0) return true
        val minute = Instant.now().epochSecond / 60
        val identity = request.getSession(false)?.id ?: request.remoteAddr
        val key = "$identity:$minute"
        val count = windows.computeIfAbsent(key) { RequestWindow(minute) }.count.incrementAndGet()
        if (windows.size > 20_000) windows.entries.removeIf { it.value.minute < minute - 1 }
        return count <= limitPerMinute
    }

    private data class RequestWindow(val minute: Long, val count: AtomicInteger = AtomicInteger())
}
