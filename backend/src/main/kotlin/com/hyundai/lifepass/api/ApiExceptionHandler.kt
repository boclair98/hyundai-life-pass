package com.hyundai.lifepass.api

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.MethodArgumentNotValidException

@RestControllerAdvice
class ApiExceptionHandler {
    @ExceptionHandler(NoSuchElementException::class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    fun notFound(exception: NoSuchElementException) = mapOf("error" to (exception.message ?: "Not found"))

    @ExceptionHandler(AccessDeniedException::class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    fun forbidden(exception: AccessDeniedException) = mapOf("error" to (exception.message ?: "Forbidden"))

    @ExceptionHandler(MethodArgumentNotValidException::class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    fun invalid(exception: MethodArgumentNotValidException) = mapOf(
        "error" to "입력값을 확인해 주세요.",
        "fields" to exception.bindingResult.fieldErrors.associate { it.field to (it.defaultMessage ?: "invalid") },
    )
}
