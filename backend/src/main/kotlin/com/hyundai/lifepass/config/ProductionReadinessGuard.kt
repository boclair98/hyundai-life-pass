package com.hyundai.lifepass.config

import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.stereotype.Component
import java.util.Base64

@Component
class ProductionReadinessGuard(
    @Value("\${lifepass.production-guard:false}") private val enabled: Boolean,
    @Value("\${spring.datasource.url}") private val datasourceUrl: String,
    @Value("\${lifepass.sample-data-enabled:true}") private val sampleDataEnabled: Boolean,
    @Value("\${lifepass.allow-demo-operator:true}") private val allowDemoOperator: Boolean,
    @Value("\${lifepass.trusted-user-header-enabled:false}") private val trustedUserHeaderEnabled: Boolean,
    @Value("\${server.servlet.session.cookie.secure:false}") private val secureCookie: Boolean,
    @Value("\${lifepass.providers.hyundai.mode:simulation}") private val hyundaiMode: String,
    @Value("\${lifepass.providers.hyundai.client-id:}") private val hyundaiClientId: String,
    @Value("\${lifepass.providers.hyundai.client-secret:}") private val hyundaiClientSecret: String,
    @Value("\${lifepass.providers.hyundai.redirect-uri:}") private val hyundaiRedirectUri: String,
    @Value("\${lifepass.providers.hyundai.callback-secret:}") private val hyundaiCallbackSecret: String,
    @Value("\${lifepass.providers.hyundai.token-encryption-key:}") private val hyundaiTokenEncryptionKey: String,
    @Value("\${lifepass.providers.ev-charger.mode:simulation}") private val chargerMode: String,
    @Value("\${lifepass.providers.ev-charger.service-key:}") private val chargerServiceKey: String,
    @Value("\${lifepass.providers.kakao-local.mode:simulation}") private val kakaoMode: String,
    @Value("\${lifepass.providers.kakao-local.rest-api-key:}") private val kakaoRestApiKey: String,
) : ApplicationRunner {
    override fun run(args: ApplicationArguments) {
        if (!enabled) return
        val failures = buildList {
            if (!datasourceUrl.startsWith("jdbc:postgresql://")) add("PostgreSQL datasource")
            if (sampleDataEnabled) add("sample data disabled")
            if (allowDemoOperator) add("demo operator disabled")
            if (trustedUserHeaderEnabled) add("trusted user header disabled")
            if (!secureCookie) add("secure session cookie")
            if (!hyundaiMode.equals("live", ignoreCase = true)) add("Hyundai live mode")
            if (hyundaiClientId.isBlank()) add("HYUNDAI_CLIENT_ID")
            if (hyundaiClientSecret.isBlank()) add("HYUNDAI_CLIENT_SECRET")
            if (!hyundaiRedirectUri.startsWith("https://")) add("HTTPS Hyundai redirect URI")
            if (hyundaiCallbackSecret.length < 32) add("HYUNDAI_CALLBACK_SECRET (32+ chars)")
            if (!isAes256Key(hyundaiTokenEncryptionKey)) add("HYUNDAI_TOKEN_ENCRYPTION_KEY (32-byte Base64)")
            if (!chargerMode.equals("live", ignoreCase = true)) add("charger live mode")
            if (chargerServiceKey.isBlank()) add("DATA_GO_KR_SERVICE_KEY")
            if (!kakaoMode.equals("live", ignoreCase = true)) add("Kakao Local live mode")
            if (kakaoRestApiKey.isBlank()) add("KAKAO_REST_API_KEY")
        }
        check(failures.isEmpty()) {
            "Production readiness guard blocked startup. Check: ${failures.joinToString(", ")}"
        }
    }

    private fun isAes256Key(value: String): Boolean = runCatching {
        Base64.getDecoder().decode(value).size == 32
    }.getOrDefault(false)
}
