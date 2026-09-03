package com.hyundai.lifepass.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component

@Component
class OperatorAccess(
    @Value("\${lifepass.operator-users:}") operatorUsers: String,
    @Value("\${lifepass.allow-demo-operator:true}") private val allowDemoOperator: Boolean,
) {
    private val allowed = operatorUsers.split(",").map(String::trim).filter(String::isNotBlank).toSet()

    fun require(user: String?) {
        if (user.isNullOrBlank() && allowDemoOperator) return
        if (user.isNullOrBlank() || user !in allowed) throw AccessDeniedException("Operator permission is required")
    }
}
