package com.hyundai.lifepass.api

import com.hyundai.lifepass.service.HyundaiIntegrationService
import com.hyundai.lifepass.config.UserSession
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.constraints.NotBlank
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.servlet.view.RedirectView
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.web.util.HtmlUtils

@RestController
@RequestMapping("/api/v1/integrations/hyundai")
class IntegrationController(private val service: HyundaiIntegrationService, private val userSession: UserSession) {
    @GetMapping("/status")
    fun status(request: HttpServletRequest) = service.providerStatus(userSession.actor(request))

    @GetMapping("/authorize")
    fun authorize(request: HttpServletRequest): RedirectView =
        RedirectView(service.createAuthorizationUrl(userSession.actor(request)))

    @GetMapping("/callback")
    fun callback(
        request: HttpServletRequest,
        @RequestParam(required = false) code: String?,
        @RequestParam(required = false) userId: String?,
        @RequestParam(required = false) error: String?,
        @RequestParam @NotBlank state: String,
    ): RedirectView {
        return when {
            !error.isNullOrBlank() -> RedirectView("/?hyundai=cancelled#settings")
            !code.isNullOrBlank() -> {
                runCatching {
                    val actor = service.completeAuthorization(userSession.actor(request), code, state)
                    userSession.bind(request, actor)
                    RedirectView("/api/v1/integrations/hyundai/agreement")
                }.getOrElse { RedirectView("/?hyundai=oauth-error#settings") }
            }
            !userId.isNullOrBlank() -> {
                runCatching {
                    val actor = userSession.actor(request)
                    val connectedActor = service.completeAgreement(actor, userId, state)
                    userSession.bind(request, connectedActor)
                    val synced = runCatching { service.syncVehicles(connectedActor) }.isSuccess
                    RedirectView(if (synced) "/?hyundai=connected#home" else "/?hyundai=sync-required#settings")
                }.getOrElse { RedirectView("/?hyundai=consent-error#settings") }
            }
            else -> throw IllegalArgumentException("현대 계정 콜백에 code 또는 userId가 없습니다.")
        }
    }

    @GetMapping("/agreement", produces = [MediaType.TEXT_HTML_VALUE])
    fun agreement(httpRequest: HttpServletRequest): ResponseEntity<String> {
        val agreementRequest = service.createAgreementRequest(userSession.actor(httpRequest))
        val action = HtmlUtils.htmlEscape(agreementRequest.action)
        val token = HtmlUtils.htmlEscape(agreementRequest.token)
        val state = HtmlUtils.htmlEscape(agreementRequest.state)
        val html = """<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>현대차 데이터 연결</title><style>body{margin:0;background:#f4f8fb;color:#002c5f;font-family:Arial,sans-serif}.box{max-width:420px;margin:18vh auto;padding:32px;background:#fff;border:1px solid #dce6ef;border-radius:20px;box-shadow:0 18px 55px #002c5f12}h1{font-size:24px}p{color:#5d7085;line-height:1.65}button{width:100%;height:50px;border:0;border-radius:12px;background:#002c5f;color:#fff;font-weight:700}</style><body><main class="box"><h1>내 차 데이터 연결</h1><p>현대자동차 화면에서 개인정보 제3자 제공 범위를 확인하고 직접 동의합니다. 동의하지 않으면 차량 데이터는 수집되지 않습니다.</p><form method="post" action="$action"><input type="hidden" name="token" value="$token"><input type="hidden" name="state" value="$state"><button type="submit">동의 내용 확인하기</button></form></main></body></html>"""
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(html)
    }

    @PostMapping("/sync")
    fun sync(request: HttpServletRequest) = mapOf("syncedVehicles" to service.syncVehicles(userSession.actor(request)))

    @PostMapping("/revoke")
    fun revoke(request: HttpServletRequest): Map<String, String> {
        service.revokeAgreement(userSession.actor(request))
        return mapOf("status" to "REVOKED_AND_DELETED")
    }

    @PostMapping("/callbacks/data-unavailable")
    fun dataUnavailable(
        @RequestParam(value = "token", required = false) token: String?,
        @RequestBody callback: HyundaiDataUnavailableCallback,
    ): Map<String, String> {
        service.verifyCallbackSecret(token)
        service.handleDataUnavailable(callback.type, callback.action, callback.userId, callback.carId)
        return mapOf("status" to "DELETED")
    }
}

data class HyundaiDataUnavailableCallback(
    @field:NotBlank val type: String,
    @field:NotBlank val action: String,
    val userId: String? = null,
    val carId: String? = null,
    val vin: String? = null,
)
