package com.hyundai.lifepass.api

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.MethodArgumentNotValidException
import com.hyundai.lifepass.service.OperationNotSupportedException
import com.hyundai.lifepass.service.UpstreamUnavailableException
import jakarta.servlet.http.HttpServletRequest

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(NoSuchElementException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun notFound(exception: NoSuchElementException, request: HttpServletRequest) = error("NOT_FOUND", exception.message ?: "Not found", request, false)

    @ExceptionHandler(AccessDeniedException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun forbidden(exception: AccessDeniedException, request: HttpServletRequest) = error("FORBIDDEN", exception.message ?: "Forbidden", request, false)

    @ExceptionHandler(OperationNotSupportedException::class)
    @ResponseStatus(HttpStatus.CONFLICT)
    fun unsupported(exception: OperationNotSupportedException, request: HttpServletRequest) = error("NOT_AVAILABLE", exception.message ?: "Operation is not available", request, false)

    @ExceptionHandler(UpstreamUnavailableException::class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    fun upstreamUnavailable(exception: UpstreamUnavailableException, request: HttpServletRequest) = error("UPSTREAM_UNAVAILABLE", exception.message ?: "Upstream provider is unavailable", request, true)

    @ExceptionHandler(IllegalArgumentException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun badRequest(exception: IllegalArgumentException, request: HttpServletRequest) = error("BAD_REQUEST", exception.message ?: "Bad request", request, false)

    @ExceptionHandler(MethodArgumentNotValidException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun invalid(exception: MethodArgumentNotValidException, request: HttpServletRequest) = error("VALIDATION_FAILED", "입력값을 확인해 주세요.", request, false) + mapOf("fields" to exception.bindingResult.fieldErrors.associate { it.field to (it.defaultMessage ?: "invalid") })

    private fun error(code: String, message: String, request: HttpServletRequest, retryable: Boolean): Map<String, Any> = mapOf(
        "code" to code,
        "message" to message,
        "error" to message,
        "requestId" to (request.getAttribute("lifepass.requestId")?.toString() ?: "unknown"),
        "retryable" to retryable,
    )
}
