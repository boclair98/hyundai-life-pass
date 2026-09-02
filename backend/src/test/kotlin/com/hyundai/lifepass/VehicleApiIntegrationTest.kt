package com.hyundai.lifepass

import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post

@SpringBootTest
@AutoConfigureMockMvc
class VehicleApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `lists Hyundai demo vehicles`() {
        mockMvc.get("/api/v1/vehicles")
            .andExpect {
                status { isOk() }
                jsonPath("$", hasSize<Any>(3))
                jsonPath("$[0].externalId") { value("ioniq6-0318") }
                jsonPath("$[0].rangeKm") { value(386) }
            }
    }

    @Test
    fun `returns a signed vehicle passport`() {
        mockMvc.get("/api/v1/vehicles/1/passport")
            .andExpect {
                status { isOk() }
                jsonPath("$.handoverReady") { value(true) }
                jsonPath("$.vehicle.name") { value("IONIQ 6") }
                jsonPath("$.hash") { isNotEmpty() }
            }
    }

    @Test
    fun `starts a canary release`() {
        mockMvc.post("/api/v1/releases/3/start")
            .andExpect {
                status { isOk() }
                jsonPath("$.status") { value("ROLLING") }
            }
    }
}
