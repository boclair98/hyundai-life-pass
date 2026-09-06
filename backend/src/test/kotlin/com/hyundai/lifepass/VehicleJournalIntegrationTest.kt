package com.hyundai.lifepass

import com.fasterxml.jackson.databind.ObjectMapper
import com.hyundai.lifepass.domain.Vehicle
import com.hyundai.lifepass.repository.VehicleRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import org.springframework.test.web.servlet.post
import org.springframework.test.web.servlet.patch
import java.util.UUID

@SpringBootTest(properties = ["lifepass.trusted-user-header-enabled=true"])
@AutoConfigureMockMvc
class VehicleJournalIntegrationTest(
    @Autowired private val mvc: MockMvc,
    @Autowired private val vehicles: VehicleRepository,
    @Autowired private val mapper: ObjectMapper,
) {
    private fun ownCar(actor: String) = vehicles.save(Vehicle(externalId = UUID.randomUUID().toString(), ownerId = actor, name = "Journal test", source = "HYUNDAI_DEVELOPERS"))

    @Test
    fun `record is persisted and can be archived and restored by its owner`() {
        val car = ownCar("journal-owner")
        val result = mvc.post("/api/v1/vehicles/${car.id}/journal") {
            header("X-Coders-User", "journal-owner")
            contentType = MediaType.APPLICATION_JSON
            content = """{"category":"MAINTENANCE","title":"타이어 교체","entryDate":"2026-01-01","amount":180000,"odometer":30000} """
        }.andExpect { status { isCreated() }; jsonPath("$.amount") { value(180000) }; jsonPath("$.status") { value("DONE") } }.andReturn()
        val entryId = mapper.readTree(result.response.contentAsString)["id"].asLong()
        mvc.get("/api/v1/vehicles/${car.id}/journal") { header("X-Coders-User", "journal-owner") }
            .andExpect { status { isOk() }; jsonPath("$[0].title") { value("타이어 교체") } }
        for (state in listOf("ARCHIVED", "RESTORE")) {
            mvc.patch("/api/v1/vehicles/${car.id}/journal/$entryId/status") {
                header("X-Coders-User", "journal-owner"); contentType = MediaType.APPLICATION_JSON; content = """{"status":"$state"}"""
            }.andExpect { status { isOk() }; jsonPath("$.status") { value(if (state == "RESTORE") "DONE" else state) } }
        }
        vehicles.deleteById(car.id)
        mvc.get("/api/v1/vehicles/${car.id}/journal") { header("X-Coders-User", "journal-owner") }
            .andExpect { status { isNotFound() } }
    }

    @Test
    fun `other users and anonymous sessions cannot read or modify a vehicle journal`() {
        val car = ownCar("private-journal-owner")
        mvc.get("/api/v1/vehicles/${car.id}/journal").andExpect { status { isForbidden() } }
        mvc.post("/api/v1/vehicles/${car.id}/journal") {
            header("X-Coders-User", "another-owner"); contentType = MediaType.APPLICATION_JSON
            content = """{"category":"CHARGE","title":"충전","entryDate":"2026-01-01"}"""
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `invalid costs categories and future completed dates are rejected`() {
        val car = ownCar("journal-validation-owner")
        for (body in listOf(
            """{"category":"CHARGE","title":"충전","entryDate":"2026-01-01","amount":-10}""",
            """{"category":"INVALID","title":"충전","entryDate":"2026-01-01"}""",
            """{"category":"CHARGE","title":"충전","entryDate":"2199-01-01","status":"DONE"}""",
        )) {
            mvc.post("/api/v1/vehicles/${car.id}/journal") {
                header("X-Coders-User", "journal-validation-owner"); contentType = MediaType.APPLICATION_JSON; content = body
            }.andExpect { status { isBadRequest() } }
        }
    }

    @Test
    fun `record id from a different vehicle cannot be changed`() {
        val first = ownCar("journal-multiple-owner")
        val second = ownCar("journal-multiple-owner")
        val result = mvc.post("/api/v1/vehicles/${first.id}/journal") {
            header("X-Coders-User", "journal-multiple-owner"); contentType = MediaType.APPLICATION_JSON
            content = """{"category":"INSURANCE","title":"갱신","entryDate":"2199-01-01","status":"PLANNED"}"""
        }.andExpect { status { isCreated() } }.andReturn()
        val id = mapper.readTree(result.response.contentAsString)["id"].asLong()
        mvc.patch("/api/v1/vehicles/${second.id}/journal/$id/status") {
            header("X-Coders-User", "journal-multiple-owner"); contentType = MediaType.APPLICATION_JSON; content = """{"status":"ARCHIVED"}"""
        }.andExpect { status { isForbidden() } }
    }
}
