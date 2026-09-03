package com.hyundai.lifepass.api

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.MethodArgumentNotValidException
import com.hyundai.lifepass.service.OperationNotSupportedException
import com.hyundai.lifepass.service.UpstreamUnavailableException

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(NoSuchElementException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun notFound(exception: NoSuchElementException) = mapOf("error" to (exception.message ?: "Not found"))

    @ExceptionHandler(AccessDeniedException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun forbidden(exception: AccessDeniedException) = mapOf("error" to (exception.message ?: "Forbidden"))

    @ExceptionHandler(OperationNotSupportedException::class)
    @ResponseStatus(HttpStatus.CONFLICT)
    fun unsupported(exception: OperationNotSupportedException) = mapOf("error" to (exception.message ?: "Operation is not available"))

    @ExceptionHandler(UpstreamUnavailableException::class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    fun upstreamUnavailable(exception: UpstreamUnavailableException) = mapOf("error" to (exception.message ?: "Upstream provider is unavailable"))

    @ExceptionHandler(IllegalArgumentException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun badRequest(exception: IllegalArgumentException) = mapOf("error" to (exception.message ?: "Bad request"))

    @ExceptionHandler(MethodArgumentNotValidException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun invalid(exception: MethodArgumentNotValidException) = mapOf(
        "error" to "입력값을 확인해 주세요.",
        "fields" to exception.bindingResult.fieldErrors.associate { it.field to (it.defaultMessage ?: "invalid") },
    )
}
