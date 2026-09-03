package com.hyundai.lifepass.config

import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class UserSession(
    @Value("\${lifepass.trusted-user-header-enabled:false}") private val trustedUserHeaderEnabled: Boolean,
) {
    fun actor(request: HttpServletRequest): String {
        if (trustedUserHeaderEnabled) {
            request.getHeader("X-Coders-User")?.takeIf(String::isNotBlank)?.let { return it }
        }

        val session = request.getSession(true)
        val current = session.getAttribute(ACTOR_ATTRIBUTE) as? String
        if (!current.isNullOrBlank()) return current

        return "owner-${UUID.randomUUID()}".also { session.setAttribute(ACTOR_ATTRIBUTE, it) }
    }

    fun bind(request: HttpServletRequest, actor: String) {
        require(actor.isNotBlank()) { "연결할 사용자 식별자가 필요합니다." }
        request.getSession(true).setAttribute(ACTOR_ATTRIBUTE, actor)
    }

    private companion object {
        const val ACTOR_ATTRIBUTE = "lifepass.actor-id"
    }
}
