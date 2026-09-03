package com.hyundai.lifepass.service

import com.fasterxml.jackson.databind.JsonNode
import com.hyundai.lifepass.api.ProviderStatusResponse
import com.hyundai.lifepass.domain.HyundaiConnection
import com.hyundai.lifepass.domain.HyundaiOAuthState
import com.hyundai.lifepass.domain.Powertrain
import com.hyundai.lifepass.domain.Vehicle
import com.hyundai.lifepass.repository.HyundaiConnectionRepository
import com.hyundai.lifepass.repository.HyundaiOAuthStateRepository
import com.hyundai.lifepass.repository.VehicleRepository
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.MediaType
import org.springframework.http.client.SimpleClientHttpRequestFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.util.UriComponentsBuilder
import java.nio.ByteBuffer
import java.security.SecureRandom
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.SecretKeySpec

@Service
class HyundaiIntegrationService(
    private val stateRepository: HyundaiOAuthStateRepository,
    private val connectionRepository: HyundaiConnectionRepository,
    private val vehicleRepository: VehicleRepository,
    @Value("\${lifepass.providers.hyundai.mode:simulation}") private val mode: String,
    @Value("\${lifepass.providers.hyundai.client-id:}") private val clientId: String,
    @Value("\${lifepass.providers.hyundai.client-secret:}") private val clientSecret: String,
    @Value("\${lifepass.providers.hyundai.redirect-uri:}") private val redirectUri: String,
    @Value("\${lifepass.providers.hyundai.authorize-url:https://prd.kr-ccapi.hyundai.com/api/v1/user/oauth2/authorize}") private val authorizeUrl: String,
    @Value("\${lifepass.providers.hyundai.token-url:https://prd.kr-ccapi.hyundai.com/api/v1/user/oauth2/token}") private val tokenUrl: String,
    @Value("\${lifepass.providers.hyundai.data-api-base-url:https://dev.kr-ccapi.hyundai.com}") private val dataApiBaseUrl: String,
    @Value("\${lifepass.providers.hyundai.agreement-url:https://dev.kr-ccapi.hyundai.com/api/v1/car-service/terms/agreement}") private val agreementUrl: String,
    @Value("\${lifepass.providers.hyundai.reject-url:https://dev.kr-ccapi.hyundai.com/api/v1/car-service/terms/reject}") private val rejectUrl: String,
    @Value("\${lifepass.providers.hyundai.callback-secret:}") private val callbackSecret: String,
    @Value("\${lifepass.providers.hyundai.token-encryption-key:}") private val encryptionKey: String,
) {
    private val client = RestClient.builder().requestFactory(SimpleClientHttpRequestFactory().apply {
        setConnectTimeout(Duration.ofSeconds(4))
        setReadTimeout(Duration.ofSeconds(8))
    }).build()
    private val random = SecureRandom()

    @Transactional(readOnly = true)
    fun providerStatus(actor: String): ProviderStatusResponse {
        if (mode.lowercase() != "live") return ProviderStatusResponse(
            "hyundai-connected-car", "현대 커넥티드카", "SIMULATION", "SAMPLE", "샘플 차량 데이터", null,
            "실제 사용 형태를 보여주는 샘플입니다. Hyundai Developers 자격증명 연결 전에는 실차 데이터로 표시하지 않습니다.",
        )
        val missing = missingConfiguration()
        if (missing.isNotEmpty()) return ProviderStatusResponse(
            "hyundai-connected-car", "현대 커넥티드카", "LIVE", "MISCONFIGURED", "Hyundai Developers", null,
            "필수 환경변수 누락: ${missing.joinToString(", ")}",
        )
        val connection = connectionRepository.findByActorId(actor)
        return if (connection == null) ProviderStatusResponse(
            "hyundai-connected-car", "현대 커넥티드카", "LIVE", "OAUTH_REQUIRED", "Hyundai Developers", null,
            "현대 통합계정 로그인과 차량 접근 동의가 필요합니다.",
        ) else ProviderStatusResponse(
            "hyundai-connected-car", "현대 커넥티드카", "LIVE", connection.status, "Hyundai Developers", connection.updatedAt,
            if (connection.status == "CONNECTED") "사용자가 동의한 Bluelink 차량 데이터를 동기화합니다." else "개인정보 제3자 제공 동의를 완료해 주세요.",
        )
    }

    @Transactional
    fun createAuthorizationUrl(actor: String): String {
        requireLiveConfiguration()
        val state = UUID.randomUUID().toString()
        stateRepository.save(HyundaiOAuthState(stateToken = state, actorId = actor))
        return UriComponentsBuilder.fromUriString(authorizeUrl)
            .queryParam("response_type", "code")
            .queryParam("client_id", clientId)
            .queryParam("redirect_uri", redirectUri)
            .queryParam("state", state)
            .build().encode().toUriString()
    }

    @Transactional
    fun completeAuthorization(actor: String, code: String, stateToken: String) {
        requireLiveConfiguration()
        val state = stateRepository.findByStateToken(stateToken)
            ?.takeIf { !it.consumed && it.actorId == actor && it.expiresAt.isAfter(Instant.now()) }
            ?: throw IllegalArgumentException("유효하지 않거나 만료된 OAuth state입니다.")
        state.consumed = true
        stateRepository.save(state)

        val form = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "authorization_code")
            add("code", code)
            add("redirect_uri", redirectUri)
        }
        val token = client.post().uri(tokenUrl)
            .headers { it.setBasicAuth(clientId, clientSecret) }
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve().body(JsonNode::class.java) ?: throw UpstreamUnavailableException("현대 사용자 토큰 응답이 비어 있습니다.", IllegalStateException())
        val accessToken = token.path("access_token").asText().takeIf(String::isNotBlank)
            ?: throw UpstreamUnavailableException("현대 사용자 토큰을 발급받지 못했습니다.", IllegalStateException())
        val refreshToken = token.path("refresh_token").asText()
        val now = Instant.now()
        val connection = connectionRepository.findByActorId(actor) ?: HyundaiConnection(actorId = actor)
        connection.accessTokenEncrypted = encrypt(accessToken)
        connection.refreshTokenEncrypted = encrypt(refreshToken)
        connection.expiresAt = now.plusSeconds(token.path("expires_in").asLong(3600))
        connection.status = "CONSENT_REQUIRED"
        connection.updatedAt = now
        connectionRepository.save(connection)
    }

    @Transactional
    fun createAgreementRequest(actor: String): HyundaiAgreementRequest {
        requireLiveConfiguration()
        val connection = connectionRepository.findByActorId(actor) ?: throw OperationNotSupportedException("현대 계정을 먼저 연결해 주세요.")
        val state = UUID.randomUUID().toString()
        stateRepository.save(HyundaiOAuthState(stateToken = state, actorId = actor))
        return HyundaiAgreementRequest(agreementUrl, "Bearer ${validAccessToken(connection)}", state)
    }

    @Transactional
    fun completeAgreement(actor: String, userId: String, stateToken: String) {
        val state = stateRepository.findByStateToken(stateToken)
            ?.takeIf { !it.consumed && it.actorId == actor && it.expiresAt.isAfter(Instant.now()) }
            ?: throw IllegalArgumentException("유효하지 않거나 만료된 개인정보 동의 state입니다.")
        state.consumed = true
        stateRepository.save(state)
        val connection = connectionRepository.findByActorId(actor) ?: throw OperationNotSupportedException("현대 계정 연결 정보가 없습니다.")
        connection.hyundaiUserId = userId
        connection.status = "CONNECTED"
        connection.updatedAt = Instant.now()
        connectionRepository.save(connection)
    }

    @Transactional
    fun syncVehicles(actor: String): Int {
        requireLiveConfiguration()
        val connection = connectionRepository.findByActorId(actor) ?: throw OperationNotSupportedException("현대 계정을 먼저 연결해 주세요.")
        if (connection.status != "CONNECTED") throw OperationNotSupportedException("현대차 개인정보 제3자 제공 동의를 먼저 완료해 주세요.")
        val accessToken = validAccessToken(connection)
        val root = get("/api/v1/car/profile/carlist", accessToken)
        val cars = root.path("cars").takeIf(JsonNode::isArray) ?: throw UpstreamUnavailableException("현대 차량 목록 응답 형식을 확인할 수 없습니다.", IllegalStateException())
        cars.forEach { car -> syncVehicle(actor, accessToken, car) }
        connection.status = "CONNECTED"
        connection.updatedAt = Instant.now()
        connectionRepository.save(connection)
        return cars.size()
    }

    @Transactional
    fun revokeAgreement(actor: String) {
        requireLiveConfiguration()
        val connection = connectionRepository.findByActorId(actor) ?: return
        val accessToken = validAccessToken(connection)
        client.get().uri(rejectUrl).headers { it.setBearerAuth(accessToken) }.retrieve().toBodilessEntity()
        val deleteForm = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "delete")
            add("access_token", accessToken)
            add("redirect_uri", redirectUri)
        }
        client.post().uri(tokenUrl)
            .headers { it.setBasicAuth(clientId, clientSecret) }
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(deleteForm)
            .retrieve().toBodilessEntity()
        deleteConnectedData(connection)
    }

    @Transactional
    fun handleDataUnavailable(type: String, action: String, userId: String?, carId: String?) {
        require(type in setOf("account", "vehicle", "agreement")) { "지원하지 않는 콜백 type입니다." }
        require(action in setOf("delete", "reject")) { "지원하지 않는 콜백 action입니다." }
        require(type != "account" || !userId.isNullOrBlank()) { "account 콜백에는 userId가 필요합니다." }
        require(type == "account" || !carId.isNullOrBlank()) { "$type 콜백에는 carId가 필요합니다." }
        when (type) {
            "account" -> userId?.let { connectionRepository.findByHyundaiUserId(it) }?.let(::deleteConnectedData)
            "vehicle", "agreement" -> carId?.let(vehicleRepository::findByExternalId)?.takeIf { it.source == "HYUNDAI_DEVELOPERS" }?.let { vehicle ->
                val owner = vehicle.ownerId
                vehicleRepository.delete(vehicle)
                if (type == "agreement" && owner != null) {
                    connectionRepository.findByActorId(owner)?.let { connection ->
                        connection.status = "REVOKED"
                        connection.updatedAt = Instant.now()
                        connectionRepository.save(connection)
                    }
                }
            }
        }
    }

    fun verifyCallbackSecret(supplied: String?) {
        if (callbackSecret.isBlank()) return
        val expected = callbackSecret.toByteArray(Charsets.UTF_8)
        val actual = supplied.orEmpty().toByteArray(Charsets.UTF_8)
        if (!java.security.MessageDigest.isEqual(expected, actual)) throw org.springframework.security.access.AccessDeniedException("유효하지 않은 현대차 콜백입니다.")
    }

    private fun deleteConnectedData(connection: HyundaiConnection) {
        vehicleRepository.findByOwnerIdAndSource(connection.actorId, "HYUNDAI_DEVELOPERS").forEach(vehicleRepository::delete)
        connectionRepository.delete(connection)
    }

    private fun validAccessToken(connection: HyundaiConnection): String {
        if (connection.expiresAt.isAfter(Instant.now().plusSeconds(60))) return decrypt(connection.accessTokenEncrypted)
        val refreshToken = decrypt(connection.refreshTokenEncrypted).takeIf(String::isNotBlank)
            ?: throw OperationNotSupportedException("현대 계정 연결이 만료되었습니다. 다시 연결해 주세요.")
        val form = LinkedMultiValueMap<String, String>().apply {
            add("grant_type", "refresh_token")
            add("refresh_token", refreshToken)
            add("redirect_uri", redirectUri)
        }
        val token = client.post().uri(tokenUrl)
            .headers { it.setBasicAuth(clientId, clientSecret) }
            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
            .body(form)
            .retrieve().body(JsonNode::class.java) ?: throw UpstreamUnavailableException("현대 사용자 토큰 갱신 응답이 비어 있습니다.", IllegalStateException())
        val accessToken = token.path("access_token").asText().takeIf(String::isNotBlank)
            ?: throw UpstreamUnavailableException("현대 사용자 토큰을 갱신하지 못했습니다.", IllegalStateException())
        connection.accessTokenEncrypted = encrypt(accessToken)
        token.path("refresh_token").asText().takeIf(String::isNotBlank)?.let { connection.refreshTokenEncrypted = encrypt(it) }
        connection.expiresAt = Instant.now().plusSeconds(token.path("expires_in").asLong(3600))
        connection.updatedAt = Instant.now()
        connectionRepository.save(connection)
        return accessToken
    }

    private fun syncVehicle(actor: String, accessToken: String, car: JsonNode) {
        val carId = car.path("carId").asText().takeIf(String::isNotBlank) ?: return
        val vehicle = vehicleRepository.findByExternalId(carId) ?: Vehicle(externalId = carId)
        vehicle.ownerId = actor
        vehicle.source = "HYUNDAI_DEVELOPERS"
        vehicle.name = car.path("carSellname").asText(car.path("carName").asText("Hyundai Connected Car"))
        vehicle.trim = car.path("carNickname").asText("현대 커넥티드카")
        vehicle.powertrain = when (car.path("carType").asText()) {
            "EV", "FCEV" -> Powertrain.EV
            "HEV", "PHEV" -> Powertrain.HYBRID
            else -> Powertrain.ICE
        }
        vehicle.plate = vehicle.plate.ifBlank { "현대 계정 연동" }
        vehicle.batterySoc = safeGet("/api/v1/car/status/$carId/ev/battery", accessToken)?.path("soc")?.asInt(vehicle.batterySoc) ?: vehicle.batterySoc
        vehicle.rangeKm = safeGet("/api/v1/car/status/$carId/dte", accessToken)?.path("value")?.asDouble(vehicle.rangeKm.toDouble())?.toInt() ?: vehicle.rangeKm
        vehicle.odometerKm = safeGet("/api/v1/car/status/$carId/odometer", accessToken)?.path("odometers")?.firstOrNull()?.path("value")?.asInt(vehicle.odometerKm) ?: vehicle.odometerKm
        val charging = safeGet("/api/v1/car/status/$carId/ev/charging", accessToken)
        vehicle.chargingState = when {
            charging == null -> "상태 조회 불가"
            charging.path("batteryCharge").asBoolean(false) -> "충전 중"
            charging.path("batteryPlugin").asInt(0) > 0 -> "충전기 연결"
            else -> "연결 안 됨"
        }
        vehicle.location = "위치정보 동의 시 표시"
        vehicle.softwareVersion = "제조사 OTA 연동 필요"
        vehicle.updatedAt = Instant.now()
        vehicleRepository.save(vehicle)
    }

    private fun get(path: String, accessToken: String): JsonNode = client.get().uri(dataApiBaseUrl.trimEnd('/') + path)
        .headers { it.setBearerAuth(accessToken) }.retrieve().body(JsonNode::class.java)
        ?: throw UpstreamUnavailableException("현대 차량 데이터 응답이 비어 있습니다.", IllegalStateException())

    private fun safeGet(path: String, accessToken: String): JsonNode? = runCatching { get(path, accessToken) }.getOrNull()

    private fun requireLiveConfiguration() {
        if (mode.lowercase() != "live") throw OperationNotSupportedException("Hyundai Developers 공급자가 아직 simulation 모드입니다.")
        val missing = missingConfiguration()
        if (missing.isNotEmpty()) throw OperationNotSupportedException("필수 환경변수 누락: ${missing.joinToString(", ")}")
    }

    private fun missingConfiguration() = buildList {
        if (clientId.isBlank()) add("HYUNDAI_CLIENT_ID")
        if (clientSecret.isBlank()) add("HYUNDAI_CLIENT_SECRET")
        if (redirectUri.isBlank()) add("HYUNDAI_REDIRECT_URI")
        if (encryptionKey.isBlank()) add("HYUNDAI_TOKEN_ENCRYPTION_KEY")
        if (callbackSecret.isBlank()) add("HYUNDAI_CALLBACK_SECRET")
    }

    private fun key(): SecretKeySpec {
        val bytes = runCatching { Base64.getDecoder().decode(encryptionKey) }.getOrElse { throw IllegalArgumentException("HYUNDAI_TOKEN_ENCRYPTION_KEY must be Base64") }
        require(bytes.size == 32) { "HYUNDAI_TOKEN_ENCRYPTION_KEY must decode to 32 bytes" }
        return SecretKeySpec(bytes, "AES")
    }

    private fun encrypt(value: String): String {
        val nonce = ByteArray(12).also(random::nextBytes)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, key(), GCMParameterSpec(128, nonce))
        val encrypted = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        return Base64.getEncoder().encodeToString(ByteBuffer.allocate(nonce.size + encrypted.size).put(nonce).put(encrypted).array())
    }

    private fun decrypt(value: String): String {
        val payload = Base64.getDecoder().decode(value)
        val nonce = payload.copyOfRange(0, 12)
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, nonce))
        return String(cipher.doFinal(payload.copyOfRange(12, payload.size)), Charsets.UTF_8)
    }
}

data class HyundaiAgreementRequest(val action: String, val token: String, val state: String)
