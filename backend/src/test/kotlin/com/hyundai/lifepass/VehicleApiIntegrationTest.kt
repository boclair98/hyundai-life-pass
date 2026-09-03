package com.hyundai.lifepass

import com.fasterxml.jackson.databind.ObjectMapper
import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.http.MediaType

@SpringBootTest(properties = ["lifepass.trusted-user-header-enabled=true"])
@AutoConfigureMockMvc
class VehicleApiIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val objectMapper: ObjectMapper,
) {
    @Test
    fun `lists Hyundai demo vehicles`() {
        mockMvc.get("/api/v1/vehicles")
            .andExpect {
                status { isOk() }
                jsonPath("$", hasSize<Any>(3))
                jsonPath("$[0].externalId") { value("ioniq6-0318") }
                jsonPath("$[0].source") { value("SAMPLE") }
                jsonPath("$[0].rangeKm") { value(386) }
                jsonPath("$[0].healthChecks", hasSize<Any>(7))
                jsonPath("$[0].warningCount") { value(0) }
            }
    }

    @Test
    fun `snapshot exposes provider provenance and never calls sample data live`() {
        mockMvc.get("/api/v1/platform/snapshot")
            .andExpect {
                status { isOk() }
                jsonPath("$.environment") { value("SIMULATION") }
                jsonPath("$.providers[0].state") { value("SAMPLE") }
                jsonPath("$.providers[1].state") { value("SAMPLE") }
                jsonPath("$.stations[0].source") { value("SAMPLE") }
            }
    }

    @Test
    fun `service center endpoint reports missing provider key without fake places`() {
        mockMvc.get("/api/v1/service-centers")
            .andExpect {
                status { isOk() }
                jsonPath("$.centers", hasSize<Any>(0))
                jsonPath("$.provider.state") { value("MISCONFIGURED") }
                header { exists("X-Request-Id") }
                header { string("X-Content-Type-Options", "nosniff") }
            }
    }

    @Test
    fun `service center endpoint validates coordinates`() {
        mockMvc.get("/api/v1/service-centers?latitude=200&longitude=127&radius=15000")
            .andExpect {
                status { isBadRequest() }
                jsonPath("$.error") { value("위도를 확인해 주세요.") }
            }
    }

    @Test
    fun `Hyundai deletion callback is idempotent`() {
        mockMvc.post("/api/v1/integrations/hyundai/callbacks/data-unavailable") {
            contentType = MediaType.APPLICATION_JSON
            content = """{"type":"vehicle","action":"delete","carId":"already-removed"}"""
        }.andExpect {
            status { isOk() }
            jsonPath("$.status") { value("DELETED") }
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

    @Test
    fun `creates charging reservation and exposes it in user snapshot`() {
        mockMvc.post("/api/v1/platform/charging-reservations") {
            header("X-Coders-User", "charge-test-user")
            contentType = MediaType.APPLICATION_JSON
            content = """{"vehicleExternalId":"ioniq6-0318","stationId":1,"scheduledAt":"2030-09-03T12:00:00Z","targetSoc":80}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.status") { value("CONFIRMED") }
            jsonPath("$.stationName") { value("현대 EV 스테이션 강동") }
        }

        mockMvc.get("/api/v1/platform/snapshot") {
            header("X-Coders-User", "charge-test-user")
        }.andExpect {
            status { isOk() }
            jsonPath("$.chargingReservations", hasSize<Any>(1))
            jsonPath("$.unreadNotifications") { value(1) }
        }
    }

    @Test
    fun `creates service booking with signed audit log`() {
        mockMvc.post("/api/v1/platform/service-bookings") {
            header("X-Coders-User", "service-test-user")
            contentType = MediaType.APPLICATION_JSON
            content = """{"vehicleExternalId":"ioniq6-0318","centerName":"성수 현대서비스","serviceType":"타이어 점검","scheduledAt":"2030-09-07T01:30:00Z"}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.status") { value("CONFIRMED") }
            jsonPath("$.estimatedCost") { value(84000) }
        }

        mockMvc.get("/api/v1/platform/audit-logs")
            .andExpect {
                status { isOk() }
                jsonPath("$[0].signature") { isNotEmpty() }
            }
    }

    @Test
    fun `advances handover state machine`() {
        val response = mockMvc.post("/api/v1/platform/handovers") {
            header("X-Coders-User", "handover-test-user")
            contentType = MediaType.APPLICATION_JSON
            content = """{"vehicleExternalId":"ioniq6-0318","buyerEmail":"buyer@example.com"}"""
        }.andExpect {
            status { isCreated() }
            jsonPath("$.step") { value(1) }
        }.andReturn().response.contentAsString
        val id = objectMapper.readTree(response)["id"].asLong()

        repeat(3) {
            mockMvc.post("/api/v1/platform/handovers/$id/advance") {
                header("X-Coders-User", "handover-test-user")
            }.andExpect { status { isOk() } }
        }

        mockMvc.get("/api/v1/platform/snapshot") {
            header("X-Coders-User", "handover-test-user")
        }.andExpect {
            status { isOk() }
            jsonPath("$.handovers[0].status") { value("COMPLETED") }
            jsonPath("$.handovers[0].step") { value(4) }
        }
    }
}
