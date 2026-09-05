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
import kotlin.math.roundToInt
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
    @Value("\${lifepass.providers.hyundai.profile-url:https://prd.kr-ccapi.hyundai.com/api/v1/user/profile}") private val profileUrl: String,
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
            accountName = connection.displayName,
            accountEmailMasked = connection.emailMasked,
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
    fun completeAuthorization(actor: String, code: String, stateToken: String): String {
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
        val profile = safeGetAbsolute(profileUrl, accessToken)
        val hyundaiUserId = profile?.path("id")?.asText()?.takeIf(String::isNotBlank)
        val stableActor = hyundaiUserId?.let(::stableActorId) ?: actor
        val connection = hyundaiUserId?.let(connectionRepository::findByHyundaiUserId)
            ?: connectionRepository.findByActorId(actor)
            ?: HyundaiConnection(actorId = stableActor)
        val previousActor = connection.actorId
        connection.actorId = stableActor
        connection.accessTokenEncrypted = encrypt(accessToken)
        connection.refreshTokenEncrypted = encrypt(refreshToken)
        connection.expiresAt = now.plusSeconds(token.path("expires_in").asLong(3600))
        connection.status = "CONSENT_REQUIRED"
        connection.updatedAt = now
        profile?.let {
            connection.hyundaiUserId = hyundaiUserId ?: connection.hyundaiUserId
            connection.displayName = profile.path("name").asText().takeIf(String::isNotBlank)
            connection.emailMasked = profile.path("email").asText().takeIf(String::isNotBlank)?.let(::maskEmail)
        }
        connectionRepository.save(connection)
        if (previousActor != stableActor) moveOwnedVehicles(previousActor, stableActor)
        return stableActor
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
    fun completeAgreement(actor: String, userId: String, stateToken: String): String {
        val state = stateRepository.findByStateToken(stateToken)
            ?.takeIf { !it.consumed && it.actorId == actor && it.expiresAt.isAfter(Instant.now()) }
            ?: throw IllegalArgumentException("유효하지 않거나 만료된 개인정보 동의 state입니다.")
        state.consumed = true
        stateRepository.save(state)
        var connection = connectionRepository.findByActorId(actor) ?: throw OperationNotSupportedException("현대 계정 연결 정보가 없습니다.")
        val stableActor = stableActorId(userId)
        val previousConnection = connectionRepository.findByHyundaiUserId(userId)
        if (previousConnection != null && previousConnection.id != connection.id) {
            previousConnection.accessTokenEncrypted = connection.accessTokenEncrypted
            previousConnection.refreshTokenEncrypted = connection.refreshTokenEncrypted
            previousConnection.expiresAt = connection.expiresAt
            previousConnection.displayName = connection.displayName ?: previousConnection.displayName
            previousConnection.emailMasked = connection.emailMasked ?: previousConnection.emailMasked
            connectionRepository.delete(connection)
            connection = previousConnection
        }
        val previousActor = connection.actorId
        connection.actorId = stableActor
        connection.hyundaiUserId = userId
        connection.status = "CONNECTED"
        connection.updatedAt = Instant.now()
        connectionRepository.save(connection)
        if (previousActor != stableActor) moveOwnedVehicles(previousActor, stableActor)
        if (actor != stableActor) moveOwnedVehicles(actor, stableActor)
        return stableActor
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
        val batteryPayload = safeGet("/api/v1/car/status/$carId/ev/battery", accessToken)
        recordTimestamp(vehicle, batteryPayload)
        val battery = batteryPayload?.path("soc")
        vehicle.batteryStatusAvailable = battery?.isNumber == true
        if (vehicle.batteryStatusAvailable) vehicle.batterySoc = battery!!.asInt()
        val rangePayload = safeGet("/api/v1/car/status/$carId/dte", accessToken)
        recordTimestamp(vehicle, rangePayload)
        val range = rangePayload?.path("value")
        vehicle.rangeStatusAvailable = range?.isNumber == true
        if (vehicle.rangeStatusAvailable) vehicle.rangeKm = distanceToKm(range!!.asDouble(), rangePayload.path("unit").asInt(1))
        val odometerPayload = safeGet("/api/v1/car/status/$carId/odometer", accessToken)
        val odometer = odometerPayload?.path("odometers")?.firstOrNull()
        recordTimestamp(vehicle, odometer)
        vehicle.odometerStatusAvailable = odometer?.path("value")?.isNumber == true
        if (vehicle.odometerStatusAvailable) vehicle.odometerKm = distanceToKm(odometer!!.path("value").asDouble(), odometer.path("unit").asInt(1))
        val charging = safeGet("/api/v1/car/status/$carId/ev/charging", accessToken)
        recordTimestamp(vehicle, charging)
        vehicle.chargingStatusAvailable = charging != null
        vehicle.chargingState = when {
            charging == null -> "상태 조회 불가"
            charging.path("batteryCharge").asBoolean(false) -> "충전 중"
            charging.path("batteryPlugin").asInt(0) > 0 -> "충전기 연결"
            else -> "연결 안 됨"
        }
        if (charging?.path("soc")?.isNumber == true) {
            vehicle.batterySoc = charging.path("soc").asInt()
            vehicle.batteryStatusAvailable = true
        }
        vehicle.chargingTargetSoc = charging?.path("targetSOC")?.path("targetSOClevel")?.takeIf(JsonNode::isNumber)?.asInt()
        vehicle.chargingRemainingMinutes = charging?.path("remainTime")?.let { remaining ->
            remaining.path("value").takeIf(JsonNode::isNumber)?.asDouble()?.let { value -> timeToMinutes(value, remaining.path("unit").asInt(1)) }
        }
        vehicle.chargingPlugType = charging?.path("batteryPlugin")?.takeIf(JsonNode::isNumber)?.asInt()?.let {
            when (it) { 1 -> "급속 충전기"; 2 -> "일반 충전기"; else -> "연결 안 됨" }
        }
        vehicle.lowFuelWarning = warningStatus("/api/v1/car/status/warning/$carId/lowFuel", accessToken)
        vehicle.tirePressureWarning = warningStatus("/api/v1/car/status/warning/$carId/tirePressure", accessToken)
        vehicle.lampWireWarning = warningStatus("/api/v1/car/status/warning/$carId/lampWire", accessToken)
        vehicle.smartKeyBatteryWarning = warningStatus("/api/v1/car/status/warning/$carId/smartKeyBattery", accessToken)
        vehicle.washerFluidWarning = warningStatus("/api/v1/car/status/warning/$carId/washerFluid", accessToken)
        vehicle.brakeOilWarning = warningStatus("/api/v1/car/status/warning/$carId/breakOil", accessToken)
        vehicle.engineOilWarning = warningStatus("/api/v1/car/status/warning/$carId/engineOil", accessToken)
        safeGet("/api/v1/car/profile/$carId/contract", accessToken)?.let { contract ->
            vehicle.connectedServiceStart = contract.path("subscribeDate").asText().takeIf(String::isNotBlank)
            vehicle.connectedServiceEnd = contract.path("endDate").asText().takeIf(String::isNotBlank)
        }
        vehicle.location = ""
        vehicle.softwareVersion = ""
        vehicle.updatedAt = Instant.now()
        vehicleRepository.save(vehicle)
    }

    private fun recordTimestamp(vehicle: Vehicle, payload: JsonNode?) {
        val timestamp = payload?.path("timestamp")?.asText()?.takeIf { it.matches(Regex("\\d{14}")) } ?: return
        if (vehicle.dataTimestamp == null || timestamp > vehicle.dataTimestamp!!) vehicle.dataTimestamp = timestamp
    }

    private fun distanceToKm(value: Double, unit: Int): Int = when (unit) {
        0 -> value / 3280.839895
        2 -> value / 1000.0
        3 -> value * 1.609344
        else -> value
    }.roundToInt()

    private fun timeToMinutes(value: Double, unit: Int): Int = when (unit) {
        0 -> value * 60
        2 -> value / 60000
        3 -> value / 60
        else -> value
    }.roundToInt().coerceAtLeast(0)

    private fun warningStatus(path: String, accessToken: String): Boolean? {
        val status = safeGet(path, accessToken)?.path("status")
        return status?.takeIf(JsonNode::isBoolean)?.asBoolean()
    }

    private fun get(path: String, accessToken: String): JsonNode = client.get().uri(dataApiBaseUrl.trimEnd('/') + path)
        .headers { it.setBearerAuth(accessToken) }.retrieve().body(JsonNode::class.java)
        ?: throw UpstreamUnavailableException("현대 차량 데이터 응답이 비어 있습니다.", IllegalStateException())

    private fun safeGet(path: String, accessToken: String): JsonNode? = runCatching { get(path, accessToken) }.getOrNull()

    private fun safeGetAbsolute(url: String, accessToken: String): JsonNode? = runCatching {
        client.get().uri(url).headers { it.setBearerAuth(accessToken) }.retrieve().body(JsonNode::class.java)
    }.getOrNull()

    private fun moveOwnedVehicles(fromActor: String, toActor: String) {
        if (fromActor == toActor) return
        vehicleRepository.findByOwnerIdAndSource(fromActor, "HYUNDAI_DEVELOPERS").forEach { vehicle ->
            vehicle.ownerId = toActor
            vehicleRepository.save(vehicle)
        }
    }

    private fun stableActorId(hyundaiUserId: String): String {
        val digest = java.security.MessageDigest.getInstance("SHA-256")
            .digest("hyundai:$hyundaiUserId".toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
        return "hyundai-${digest.take(32)}"
    }

    private fun maskEmail(email: String): String {
        val parts = email.split('@', limit = 2)
        if (parts.size != 2) return "연결된 계정"
        val local = parts[0]
        val visible = local.take(2)
        return "$visible${"*".repeat((local.length - visible.length).coerceAtLeast(2))}@${parts[1]}"
    }

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
