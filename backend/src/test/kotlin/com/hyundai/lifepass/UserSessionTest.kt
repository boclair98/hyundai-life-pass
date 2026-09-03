package com.hyundai.lifepass

import com.hyundai.lifepass.config.UserSession
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpSession
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class UserSessionTest {
    @Test
    fun `uses a stable server session identity and ignores spoofed headers by default`() {
        val resolver = UserSession(trustedUserHeaderEnabled = false)
        val firstRequest = MockHttpServletRequest().apply { addHeader("X-Coders-User", "spoofed-user") }
        val actor = resolver.actor(firstRequest)
        val nextRequest = MockHttpServletRequest().apply { setSession(firstRequest.session as MockHttpSession) }

        assertTrue(actor.startsWith("owner-"))
        assertNotEquals("spoofed-user", actor)
        assertEquals(actor, resolver.actor(nextRequest))
    }
}
