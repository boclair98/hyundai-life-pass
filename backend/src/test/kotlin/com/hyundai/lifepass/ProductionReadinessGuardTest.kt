package com.hyundai.lifepass

import com.hyundai.lifepass.config.ProductionReadinessGuard
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.boot.DefaultApplicationArguments
import kotlin.test.assertContains

class ProductionReadinessGuardTest {
    private val key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

    @Test
    fun `production guard accepts a fully live and secure configuration`() {
        guard().run(DefaultApplicationArguments())
    }

    @Test
    fun `production guard rejects unsafe launch configuration without exposing values`() {
        val error = assertThrows<IllegalStateException> {
            guard(sampleDataEnabled = true, secureCookie = false, encryptionKey = "bad").run(DefaultApplicationArguments())
        }
        assertContains(error.message.orEmpty(), "sample data disabled")
        assertContains(error.message.orEmpty(), "secure session cookie")
        assertContains(error.message.orEmpty(), "HYUNDAI_TOKEN_ENCRYPTION_KEY")
        check(!error.message.orEmpty().contains("bad"))
    }

    private fun guard(
        sampleDataEnabled: Boolean = false,
        secureCookie: Boolean = true,
        encryptionKey: String = key,
    ) = ProductionReadinessGuard(
        enabled = true,
        datasourceUrl = "jdbc:postgresql://db:5432/lifepass",
        sampleDataEnabled = sampleDataEnabled,
        allowDemoOperator = false,
        trustedUserHeaderEnabled = false,
        secureCookie = secureCookie,
        hyundaiMode = "live",
        hyundaiClientId = "client",
        hyundaiClientSecret = "secret",
        hyundaiRedirectUri = "https://hyundai-life-pass.coders.kr/api/v1/integrations/hyundai/callback",
        hyundaiCallbackSecret = "0123456789abcdef0123456789abcdef",
        hyundaiTokenEncryptionKey = encryptionKey,
        chargerMode = "live",
        chargerServiceKey = "service-key",
        kakaoMode = "live",
        kakaoRestApiKey = "rest-key",
    )
}
