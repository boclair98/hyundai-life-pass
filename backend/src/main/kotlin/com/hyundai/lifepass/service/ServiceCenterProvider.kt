package com.hyundai.lifepass.service

import com.fasterxml.jackson.databind.JsonNode
import com.hyundai.lifepass.api.ProviderStatusResponse
import com.hyundai.lifepass.api.ServiceCenterFeedResponse
import com.hyundai.lifepass.api.ServiceCenterResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import java.time.Duration
import java.time.Instant
import kotlin.math.roundToInt

@Component
class ServiceCenterProvider(
    @Value("\${lifepass.providers.kakao-local.mode:live}") private val mode: String,
    @Value("\${lifepass.providers.kakao-local.rest-api-key:}") private val restApiKey: String,
    @Value("\${lifepass.providers.kakao-local.base-url:https://dapi.kakao.com/v2/local/search/keyword.json}") private val baseUrl: String,
    @Value("\${lifepass.providers.kakao-local.cache-seconds:300}") private val cacheSeconds: Long,
) {
    private val client = RestClient.builder().requestFactory(SimpleClientHttpRequestFactory().apply {
        setConnectTimeout(Duration.ofSeconds(3))
        setReadTimeout(Duration.ofSeconds(6))
    }).build()

    private val cache = object : LinkedHashMap<String, CachedCenters>(24, .75f, true) {
        override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, CachedCenters>?) = size > 24
    }

    @Synchronized
    fun search(latitude: Double, longitude: Double, radius: Int): ServiceCenterFeedResponse {
        require(latitude in -90.0..90.0) { "위도를 확인해 주세요." }
        require(longitude in -180.0..180.0) { "경도를 확인해 주세요." }
        require(radius in 1000..20000) { "검색 반경은 1~20km로 설정해 주세요." }

        if (mode.lowercase() != "live") return unavailable("SIMULATION", "Kakao Local 공급자가 비활성화되어 있습니다.")
        if (restApiKey.isBlank()) return unavailable("MISCONFIGURED", "KAKAO_REST_API_KEY 환경변수가 필요합니다.")

        val key = "${(latitude * 100).roundToInt()}:${(longitude * 100).roundToInt()}:$radius"
        val now = Instant.now()
        cache[key]?.takeIf { Duration.between(it.refreshedAt, now).seconds < cacheSeconds }?.let { return it.feed }

        return try {
            val uri = UriComponentsBuilder.fromUriString(baseUrl)
                .queryParam("query", "현대자동차 블루핸즈")
                .queryParam("x", longitude)
                .queryParam("y", latitude)
                .queryParam("radius", radius)
                .queryParam("sort", "distance")
                .queryParam("size", 15)
                .build().encode().toUri()
            val root = client.get().uri(uri)
                .header("Authorization", "KakaoAK $restApiKey")
                .retrieve().body(JsonNode::class.java) ?: error("Empty Kakao Local response")
            val centers = root.path("documents").takeIf(JsonNode::isArray)?.mapNotNull(::toCenter).orEmpty()
            if (centers.isEmpty()) error("Kakao Local returned no Hyundai service centers")
            ServiceCenterFeedResponse(
                centers = centers,
                provider = ProviderStatusResponse("kakao-local", "블루핸즈 검색", "LIVE", "CONNECTED", "Kakao Local API", now, "현재 위치 주변 현대자동차 서비스 거점을 거리순으로 표시합니다."),
            ).also { cache[key] = CachedCenters(now, it) }
        } catch (exception: Exception) {
            cache[key]?.feed?.copy(provider = cache[key]!!.feed.provider.copy(state = "STALE", message = "장소 검색이 지연되어 마지막 정상 결과를 표시합니다."))
                ?: unavailable("ERROR", "주변 서비스 거점을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.")
        }
    }

    private fun toCenter(node: JsonNode): ServiceCenterResponse? {
        val name = node.path("place_name").asText().takeIf(String::isNotBlank) ?: return null
        if (!name.contains("현대", ignoreCase = true) && !name.contains("블루핸즈", ignoreCase = true)) return null
        val latitude = node.path("y").asText().toDoubleOrNull() ?: return null
        val longitude = node.path("x").asText().toDoubleOrNull() ?: return null
        val distanceKm = ((node.path("distance").asText().toDoubleOrNull() ?: 0.0) / 100.0).roundToInt() / 10.0
        return ServiceCenterResponse(
            id = node.path("id").asText("$latitude:$longitude"),
            name = name,
            address = node.path("road_address_name").asText().ifBlank { node.path("address_name").asText("주소 정보 없음") },
            phone = node.path("phone").asText().takeIf(String::isNotBlank),
            latitude = latitude,
            longitude = longitude,
            distanceKm = distanceKm,
            placeUrl = node.path("place_url").asText("https://map.kakao.com"),
            source = "KAKAO_LOCAL",
        )
    }

    private fun unavailable(state: String, message: String) = ServiceCenterFeedResponse(
        emptyList(),
        ProviderStatusResponse("kakao-local", "블루핸즈 검색", "LIVE", state, "Kakao Local API", null, message),
    )

    private data class CachedCenters(val refreshedAt: Instant, val feed: ServiceCenterFeedResponse)
}
