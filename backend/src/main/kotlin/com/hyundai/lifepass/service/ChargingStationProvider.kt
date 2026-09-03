package com.hyundai.lifepass.service

import com.fasterxml.jackson.databind.JsonNode
import com.hyundai.lifepass.api.ProviderStatusResponse
import com.hyundai.lifepass.api.StationResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import java.time.Duration
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

data class StationFeed(
    val stations: List<StationResponse>,
    val provider: ProviderStatusResponse,
)

@Component
class ChargingStationProvider(
    @Value("\${lifepass.providers.ev-charger.mode:simulation}") private val mode: String,
    @Value("\${lifepass.providers.ev-charger.service-key:}") private val serviceKey: String,
    @Value("\${lifepass.providers.ev-charger.base-url:https://apis.data.go.kr/B552584/EvCharger/getChargerInfo}") private val baseUrl: String,
    @Value("\${lifepass.providers.ev-charger.zcode:11}") private val zcode: String,
    @Value("\${lifepass.providers.ev-charger.center-latitude:37.5446}") private val centerLatitude: Double,
    @Value("\${lifepass.providers.ev-charger.center-longitude:127.0559}") private val centerLongitude: Double,
    @Value("\${lifepass.providers.ev-charger.default-price-per-kwh:347}") private val defaultPricePerKwh: Int,
    @Value("\${lifepass.providers.ev-charger.cache-seconds:300}") private val cacheSeconds: Long,
) {
    @Volatile private var cached: CachedFeed? = null

    private val client: RestClient = RestClient.builder()
        .requestFactory(SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(Duration.ofSeconds(3))
            setReadTimeout(Duration.ofSeconds(7))
        })
        .build()

    fun getStations(): StationFeed {
        if (mode.lowercase() != "live") return simulationFeed()
        if (serviceKey.isBlank()) return StationFeed(
            emptyList(),
            ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", "MISCONFIGURED", "한국환경공단 공공데이터포털", null, "DATA_GO_KR_SERVICE_KEY 환경변수가 필요합니다."),
        )

        val now = Instant.now()
        cached?.takeIf { Duration.between(it.refreshedAt, now).seconds < cacheSeconds }?.let { return it.feed }

        return try {
            val liveFeed = fetchLive(now)
            cached = CachedFeed(now, liveFeed)
            liveFeed
        } catch (exception: Exception) {
            cached?.feed?.let { stale ->
                stale.copy(provider = stale.provider.copy(state = "STALE", message = "공급자 응답 지연으로 마지막 정상 데이터를 표시합니다."))
            } ?: StationFeed(
                emptyList(),
                ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", "ERROR", "한국환경공단 공공데이터포털", null, "실시간 공급자 연결에 실패했습니다. 샘플로 위장하지 않고 조회 기능을 중지했습니다."),
            )
        }
    }

    private fun fetchLive(refreshedAt: Instant): StationFeed {
        val uri = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("serviceKey", serviceKey)
                .queryParam("pageNo", 1)
                .queryParam("numOfRows", 9999)
                .queryParam("dataType", "JSON")
                .queryParam("zcode", zcode)
                .build().encode().toUri()
        val root = client.get().uri(uri).retrieve().body(JsonNode::class.java) ?: error("Empty EV charger response")

        val header = root.path("response").path("header")
        if (!header.isMissingNode && header.path("resultCode").asText("00") != "00") {
            error("EV charger provider error: ${header.path("resultMsg").asText("unknown")}")
        }
        val items = root.path("response").path("body").path("items").path("item")
            .takeIf(JsonNode::isArray) ?: root.path("items").path("item").takeIf(JsonNode::isArray)
            ?: error("Unexpected EV charger response")

        val stations = items.groupBy { it.path("statId").asText() }
            .mapNotNull { (stationId, chargers) -> toStation(stationId, chargers) }
            .sortedBy { it.distanceKm }
            .take(12)
        if (stations.isEmpty()) error("EV charger provider returned no usable station data")

        return StationFeed(
            stations,
            ProviderStatusResponse(
                id = "ev-charger",
                name = "전기차 충전소",
                mode = "LIVE",
                state = "CONNECTED",
                source = "한국환경공단 공공데이터포털",
                refreshedAt = refreshedAt,
                message = "실시간 위치·충전기 상태 데이터입니다. 예약·결제는 CPO 제휴가 필요합니다.",
            ),
        )
    }

    private fun toStation(stationId: String, chargers: List<JsonNode>): StationResponse? {
        val first = chargers.firstOrNull() ?: return null
        val latitude = first.path("lat").asText().toDoubleOrNull() ?: return null
        val longitude = first.path("lng").asText().toDoubleOrNull() ?: return null
        val available = chargers.count { it.path("stat").asText() == "2" }
        val speed = chargers.maxOfOrNull { node ->
            node.path("output").asText().substringBefore(".").toIntOrNull() ?: chargerTypeSpeed(node.path("chgerType").asText())
        } ?: 0
        val distance = distanceKm(centerLatitude, centerLongitude, latitude, longitude)
        val updatedAt = chargers.mapNotNull { parseProviderDate(it.path("statUpdDt").asText()) }.maxOrNull()
        return StationResponse(
            id = Integer.toUnsignedLong(stationId.hashCode()),
            providerStationId = stationId,
            name = first.path("statNm").asText("이름 없는 충전소"),
            address = first.path("addr").asText("주소 정보 없음"),
            latitude = latitude,
            longitude = longitude,
            distanceKm = (distance * 10).roundToInt() / 10.0,
            available = available,
            total = chargers.size,
            speedKw = speed,
            pricePerKwh = defaultPricePerKwh,
            etaMinutes = max(2, (distance * 3).roundToInt()),
            operator = first.path("busiNm").asText("운영기관 정보 없음"),
            statusLabel = if (available > 0) "충전 가능" else "사용 중·점검",
            source = "KECO_LIVE",
            reservable = false,
            statusUpdatedAt = updatedAt,
        )
    }

    private fun simulationFeed(): StationFeed {
        val now = Instant.now()
        val stations = listOf(
            StationResponse(1, "SIM-HYUNDAI-GANGDONG", "현대 EV 스테이션 강동", "서울 강동구 천호대로 1221", 37.5365, 127.1330, 2.4, 7, 8, 350, 347, 8, "현대자동차", "시뮬레이션", "SAMPLE", true, now),
            StationResponse(2, "SIM-EPIT-SEONGSU", "성수 E-pit", "서울 성동구 아차산로 17길", 37.5467, 127.0643, 3.1, 3, 6, 200, 340, 11, "E-pit", "시뮬레이션", "SAMPLE", true, now),
            StationResponse(3, "SIM-SEOULFOREST", "서울숲 공영주차장", "서울 성동구 뚝섬로 273", 37.5444, 127.0374, 4.6, 11, 16, 100, 324, 14, "서울특별시", "시뮬레이션", "SAMPLE", true, now),
        )
        return StationFeed(
            stations,
            ProviderStatusResponse("ev-charger", "전기차 충전소", "SIMULATION", "SAMPLE", "내장 시나리오", now, "실제 사용 형태를 검증하기 위한 샘플입니다. DATA_GO_KR_SERVICE_KEY 연결 시 실시간 데이터로 교체됩니다."),
        )
    }

    private fun chargerTypeSpeed(type: String) = when (type) {
        "01", "02", "03", "04", "05", "06", "07", "08" -> 50
        "09", "10" -> 100
        else -> 7
    }

    private fun parseProviderDate(value: String): Instant? = runCatching {
        LocalDateTime.parse(value, DateTimeFormatter.ofPattern("yyyyMMddHHmmss")).atZone(ZoneId.of("Asia/Seoul")).toInstant()
    }.getOrNull()

    private fun distanceKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val latDelta = Math.toRadians(lat2 - lat1)
        val lonDelta = Math.toRadians(lon2 - lon1)
        val a = sin(latDelta / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(lonDelta / 2).pow(2)
        return 6371.0 * 2 * asin(min(1.0, sqrt(a)))
    }

    private data class CachedFeed(val refreshedAt: Instant, val feed: StationFeed)
}

class UpstreamUnavailableException(message: String, cause: Throwable) : RuntimeException(message, cause)
class OperationNotSupportedException(message: String) : RuntimeException(message)
