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
import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
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
    val search: StationSearch,
)

data class StationSearch(
    val latitude: Double,
    val longitude: Double,
    val regionCode: String,
    val locationLabel: String,
    val radiusKm: Double,
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
    @Value("\${lifepass.providers.kakao-local.rest-api-key:}") private val kakaoRestApiKey: String,
    @Value("\${lifepass.providers.kakao-local.region-url:https://dapi.kakao.com/v2/local/geo/coord2regioncode.json}") private val kakaoRegionUrl: String,
) {
    private val cache = object : LinkedHashMap<String, CachedRegion>(24, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedRegion>?) = size > 24
    }

    private val client: RestClient = RestClient.builder()
        .requestFactory(SimpleClientHttpRequestFactory().apply {
            setConnectTimeout(Duration.ofSeconds(3))
            setReadTimeout(Duration.ofSeconds(7))
        })
        .build()

    fun getStations(
        latitude: Double = centerLatitude,
        longitude: Double = centerLongitude,
        radiusKm: Double = 30.0,
    ): StationFeed {
        require(latitude in 33.0..39.5) { "대한민국 내 위도를 확인해 주세요." }
        require(longitude in 124.0..132.0) { "대한민국 내 경도를 확인해 주세요." }
        require(radiusKm in 1.0..100.0) { "검색 반경은 1~100km로 설정해 주세요." }

        if (mode.lowercase() != "live") return simulationFeed(latitude, longitude, radiusKm)
        if (serviceKey.isBlank()) return StationFeed(
            emptyList(),
            ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", "MISCONFIGURED", "한국환경공단 공공데이터포털", null, "DATA_GO_KR_SERVICE_KEY 환경변수가 필요합니다."),
            StationSearch(latitude, longitude, zcode, "지역 확인 필요", radiusKm),
        )
        if (kakaoRestApiKey.isBlank()) return StationFeed(
            emptyList(),
            ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", "MISCONFIGURED", "한국환경공단 공공데이터포털 + Kakao Local API", null, "현재 위치의 시·도를 확인하려면 KAKAO_REST_API_KEY가 필요합니다."),
            StationSearch(latitude, longitude, zcode, "지역 확인 필요", radiusKm),
        )

        val now = Instant.now()
        val region = try {
            resolveRegion(latitude, longitude)
        } catch (exception: Exception) {
            return StationFeed(
                emptyList(),
                ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", "ERROR", "한국환경공단 공공데이터포털 + Kakao Local API", null, "현재 위치의 행정구역을 확인하지 못했습니다. 위치 권한과 네트워크를 확인해 주세요."),
                StationSearch(latitude, longitude, "", "지역 확인 실패", radiusKm),
            )
        }
        val cachedRegion = synchronized(cache) { cache[region.code] }
        cachedRegion?.takeIf { Duration.between(it.refreshedAt, now).seconds < cacheSeconds }?.let {
            return render(it, region, latitude, longitude, radiusKm, "CONNECTED")
        }
        return try {
            val liveRegion = fetchLive(region.code, now)
            synchronized(cache) { cache[region.code] = liveRegion }
            render(liveRegion, region, latitude, longitude, radiusKm, "CONNECTED")
        } catch (exception: Exception) {
            cachedRegion?.let { render(it, region, latitude, longitude, radiusKm, "STALE") } ?: StationFeed(
                emptyList(),
                ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", "ERROR", "한국환경공단 공공데이터포털", null, "실시간 공급자 연결에 실패했습니다. 샘플로 위장하지 않고 조회 기능을 중지했습니다."),
                StationSearch(latitude, longitude, region.code, region.label, radiusKm),
            )
        }
    }

    private fun fetchLive(regionCode: String, refreshedAt: Instant): CachedRegion {
        val normalizedServiceKey = if ('%' in serviceKey) URLDecoder.decode(serviceKey, StandardCharsets.UTF_8) else serviceKey
        // data.go.kr exposes both an encoded and decoded key. Normalize once, then
        // encode as a form-safe query value so '+', '=' and '%' survive unchanged.
        val encodedServiceKey = URLEncoder.encode(normalizedServiceKey, StandardCharsets.UTF_8)
        val uri = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("serviceKey", encodedServiceKey)
                .queryParam("pageNo", 1)
                .queryParam("numOfRows", 9999)
                .queryParam("dataType", "JSON")
                .queryParam("zcode", regionCode)
                .build(true).toUri()
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
        if (stations.isEmpty()) error("EV charger provider returned no usable station data")
        return CachedRegion(refreshedAt, stations)
    }

    private fun toStation(stationId: String, chargers: List<JsonNode>): StationTemplate? {
        val first = chargers.firstOrNull() ?: return null
        val latitude = first.path("lat").asText().toDoubleOrNull() ?: return null
        val longitude = first.path("lng").asText().toDoubleOrNull() ?: return null
        val available = chargers.count { it.path("stat").asText() == "2" }
        val speed = chargers.maxOfOrNull { node ->
            node.path("output").asText().substringBefore(".").toIntOrNull() ?: chargerTypeSpeed(node.path("chgerType").asText())
        } ?: 0
        val updatedAt = chargers.mapNotNull { parseProviderDate(it.path("statUpdDt").asText()) }.maxOrNull()
        return StationTemplate(
            id = Integer.toUnsignedLong(stationId.hashCode()),
            providerStationId = stationId,
            name = first.path("statNm").asText("이름 없는 충전소"),
            address = first.path("addr").asText("주소 정보 없음"),
            latitude = latitude,
            longitude = longitude,
            available = available,
            total = chargers.size,
            speedKw = speed,
            pricePerKwh = defaultPricePerKwh,
            operator = first.path("busiNm").asText("운영기관 정보 없음"),
            statusLabel = if (available > 0) "충전 가능" else "사용 중·점검",
            source = "KECO_LIVE",
            reservable = false,
            statusUpdatedAt = updatedAt,
        )
    }

    private fun render(
        cachedRegion: CachedRegion,
        region: Region,
        latitude: Double,
        longitude: Double,
        radiusKm: Double,
        state: String,
    ): StationFeed {
        val stations = cachedRegion.stations.asSequence().map { station ->
            val distance = distanceKm(latitude, longitude, station.latitude, station.longitude)
            station.toResponse(distance)
        }.filter { it.distanceKm <= radiusKm }
            .sortedBy { it.distanceKm }
            .take(30)
            .toList()
        val message = when (state) {
            "STALE" -> "공급자 응답이 지연되어 ${region.label}의 마지막 정상 데이터를 현재 위치에서 가까운 순으로 표시합니다."
            else -> "${region.label}에서 반경 ${radiusKm.roundToInt()}km 내 충전소를 현재 위치에서 가까운 순으로 표시합니다."
        }
        return StationFeed(
            stations,
            ProviderStatusResponse("ev-charger", "전기차 충전소", "LIVE", state, "한국환경공단 공공데이터포털", cachedRegion.refreshedAt, message),
            StationSearch(latitude, longitude, region.code, region.label, radiusKm),
        )
    }

    private fun resolveRegion(latitude: Double, longitude: Double): Region {
        val uri = UriComponentsBuilder.fromUriString(kakaoRegionUrl)
            .queryParam("x", longitude)
            .queryParam("y", latitude)
            .queryParam("input_coord", "WGS84")
            .build().encode().toUri()
        val root = client.get().uri(uri)
            .header("Authorization", "KakaoAK $kakaoRestApiKey")
            .retrieve().body(JsonNode::class.java) ?: error("Empty Kakao region response")
        val documents = root.path("documents").takeIf(JsonNode::isArray) ?: error("Unexpected Kakao region response")
        val document = documents.firstOrNull { it.path("region_type").asText() == "H" }
            ?: documents.firstOrNull() ?: error("No region for coordinates")
        val code = document.path("code").asText().take(2)
        require(code.length == 2 && code.all(Char::isDigit)) { "Invalid region code" }
        val label = listOf(document.path("region_1depth_name").asText(), document.path("region_2depth_name").asText())
            .filter(String::isNotBlank).joinToString(" ").ifBlank { "현재 위치" }
        return Region(code, label)
    }

    private fun simulationFeed(latitude: Double, longitude: Double, radiusKm: Double): StationFeed {
        val now = Instant.now()
        val stations = listOf(
            StationResponse(1, "SIM-HYUNDAI-GANGDONG", "현대 EV 스테이션 강동", "서울 강동구 천호대로 1221", 37.5365, 127.1330, 2.4, 7, 8, 350, 347, 8, "현대자동차", "시뮬레이션", "SAMPLE", true, now),
            StationResponse(2, "SIM-EPIT-SEONGSU", "성수 E-pit", "서울 성동구 아차산로 17길", 37.5467, 127.0643, 3.1, 3, 6, 200, 340, 11, "E-pit", "시뮬레이션", "SAMPLE", true, now),
            StationResponse(3, "SIM-SEOULFOREST", "서울숲 공영주차장", "서울 성동구 뚝섬로 273", 37.5444, 127.0374, 4.6, 11, 16, 100, 324, 14, "서울특별시", "시뮬레이션", "SAMPLE", true, now),
        )
        return StationFeed(
            stations,
            ProviderStatusResponse("ev-charger", "전기차 충전소", "SIMULATION", "SAMPLE", "내장 시나리오", now, "실제 사용 형태를 검증하기 위한 샘플입니다. DATA_GO_KR_SERVICE_KEY 연결 시 실시간 데이터로 교체됩니다."),
            StationSearch(latitude, longitude, zcode, "샘플 지역", radiusKm),
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

    private data class Region(val code: String, val label: String)
    private data class CachedRegion(val refreshedAt: Instant, val stations: List<StationTemplate>)
    private data class StationTemplate(
        val id: Long,
        val providerStationId: String,
        val name: String,
        val address: String,
        val latitude: Double,
        val longitude: Double,
        val available: Int,
        val total: Int,
        val speedKw: Int,
        val pricePerKwh: Int,
        val operator: String,
        val statusLabel: String,
        val source: String,
        val reservable: Boolean,
        val statusUpdatedAt: Instant?,
    ) {
        fun toResponse(distance: Double) = StationResponse(
            id, providerStationId, name, address, latitude, longitude,
            (distance * 10).roundToInt() / 10.0,
            available, total, speedKw, pricePerKwh,
            max(2, (distance * 3).roundToInt()),
            operator, statusLabel, source, reservable, statusUpdatedAt,
        )
    }
}

class UpstreamUnavailableException(message: String, cause: Throwable) : RuntimeException(message, cause)
class OperationNotSupportedException(message: String) : RuntimeException(message)
