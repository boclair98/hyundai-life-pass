package com.hyundai.lifepass

import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get

@SpringBootTest(properties = [
    "lifepass.providers.hyundai.mode=live",
    "lifepass.providers.hyundai.client-id=test-client",
    "lifepass.providers.hyundai.client-secret=test-secret",
    "lifepass.providers.hyundai.redirect-uri=https://example.com/api/v1/integrations/hyundai/callback",
    "lifepass.providers.hyundai.token-encryption-key=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=",
    "lifepass.providers.hyundai.callback-secret=test-callback",
])
@AutoConfigureMockMvc
class HyundaiAuthorizationFlowTest(@Autowired private val mockMvc: MockMvc) {
    @Test
    fun `login start redirects directly to Hyundai OAuth`() {
        mockMvc.get("/api/v1/integrations/hyundai/authorize")
            .andExpect {
                status { is3xxRedirection() }
                header { string("Location", containsString("https://prd.kr-ccapi.hyundai.com/api/v1/user/oauth2/authorize?response_type=code")) }
                header { string("Location", containsString("client_id=test-client")) }
                header { string("Location", containsString("state=")) }
            }
    }
}
