package com.hyundai.lifepass

import com.hyundai.lifepass.service.ChargingStationProvider
import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.Test
import java.net.InetSocketAddress
import java.util.concurrent.atomic.AtomicReference
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class ChargingStationProviderTest {
    @Test
    fun `reports a missing production key instead of falling back to samples`() {
        val provider = ChargingStationProvider("live", "", "https://example.invalid/chargers", "11", 37.5, 127.0, 347, 300)

        val feed = provider.getStations()

        assertTrue(feed.stations.isEmpty())
        assertEquals("LIVE", feed.provider.mode)
        assertEquals("MISCONFIGURED", feed.provider.state)
    }

    @Test
    fun `maps and aggregates the official charger response without inventing reservations`() {
        val server = HttpServer.create(InetSocketAddress(0), 0)
        val requestedQuery = AtomicReference<String>()
        server.createContext("/chargers") { exchange ->
            requestedQuery.set(exchange.requestURI.rawQuery)
            val payload = """{"response":{"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},"body":{"items":{"item":[{"statId":"ME000001","statNm":"성수 공영 충전소","addr":"서울 성동구","lat":"37.5446","lng":"127.0559","stat":"2","output":"100","busiNm":"환경공단","statUpdDt":"20260903101530"},{"statId":"ME000001","statNm":"성수 공영 충전소","addr":"서울 성동구","lat":"37.5446","lng":"127.0559","stat":"3","output":"50","busiNm":"환경공단","statUpdDt":"20260903101430"}]}}}}"""
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, payload.toByteArray().size.toLong())
            exchange.responseBody.use { it.write(payload.toByteArray()) }
        }
        server.start()

        try {
            val provider = ChargingStationProvider(
                mode = "live",
                serviceKey = "test%2Bkey%3D",
                baseUrl = "http://127.0.0.1:${server.address.port}/chargers",
                zcode = "11",
                centerLatitude = 37.5446,
                centerLongitude = 127.0559,
                defaultPricePerKwh = 347,
                cacheSeconds = 300,
            )

            val feed = provider.getStations()

            assertEquals("CONNECTED", feed.provider.state)
            assertEquals(1, feed.stations.size)
            assertEquals(1, feed.stations.single().available)
            assertEquals(2, feed.stations.single().total)
            assertEquals("KECO_LIVE", feed.stations.single().source)
            assertFalse(feed.stations.single().reservable)
            assertTrue(feed.stations.single().statusUpdatedAt != null)
            assertTrue(requestedQuery.get().contains("serviceKey=test%2Bkey%3D"))
            assertFalse(requestedQuery.get().contains("%252B"))
        } finally {
            server.stop(0)
        }
    }
}
