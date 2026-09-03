package com.hyundai.lifepass.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Component
import java.security.MessageDigest

@Component
class OperatorAccess(
    @Value("\${lifepass.operator-token:}") private val operatorToken: String,
    @Value("\${lifepass.allow-demo-operator:true}") private val allowDemoOperator: Boolean,
) {
    fun require(suppliedToken: String?) {
        if (allowDemoOperator && operatorToken.isBlank()) return
        if (operatorToken.isBlank() || suppliedToken.isNullOrBlank()) throw AccessDeniedException("Operator permission is required")
        val expected = operatorToken.toByteArray(Charsets.UTF_8)
        val actual = suppliedToken.toByteArray(Charsets.UTF_8)
        if (!MessageDigest.isEqual(expected, actual)) throw AccessDeniedException("Operator permission is required")
    }
}
