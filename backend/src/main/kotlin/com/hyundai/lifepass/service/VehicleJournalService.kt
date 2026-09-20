package com.hyundai.lifepass.service

import com.hyundai.lifepass.api.JournalCategoryTotalResponse
import com.hyundai.lifepass.api.JournalEntryResponse
import com.hyundai.lifepass.api.JournalRequest
import com.hyundai.lifepass.api.JournalStatusRequest
import com.hyundai.lifepass.api.VehicleJournalReportResponse
import com.hyundai.lifepass.domain.AuditLog
import com.hyundai.lifepass.domain.Vehicle
import com.hyundai.lifepass.domain.VehicleJournal
import com.hyundai.lifepass.repository.AuditLogRepository
import com.hyundai.lifepass.repository.VehicleJournalRepository
import com.hyundai.lifepass.repository.VehicleRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.security.access.AccessDeniedException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatterBuilder
import java.time.format.ResolverStyle

@Service
class VehicleJournalService(
    private val vehicles: VehicleRepository,
    private val journal: VehicleJournalRepository,
    private val auditLogs: AuditLogRepository,
) {
    @Transactional(readOnly = true)
    fun list(actor: String, vehicleId: Long): List<JournalEntryResponse> {
        requireOwner(actor, vehicleId)
        return journal.findByVehicleIdOrderByEntryDateDescCreatedAtDesc(vehicleId).map(::toResponse)
    }

    @Transactional
    fun create(actor: String, vehicleId: Long, body: JournalRequest): JournalEntryResponse {
        requireOwner(actor, vehicleId)
        require(body.entryDate.year in 1900..2200) { "날짜를 확인해 주세요." }
        require(body.status != "DONE" || !body.entryDate.isAfter(today())) { "미래 날짜는 예정 일정으로 저장해 주세요." }
        require(journal.countByVehicleId(vehicleId) < MAX_ENTRIES_PER_VEHICLE) { "차량별 기록 보관 한도에 도달했습니다." }

        val saved = journal.save(
            VehicleJournal(
                vehicleId = vehicleId,
                category = body.category,
                title = body.title.trim(),
                note = body.note.trim(),
                entryDate = body.entryDate,
                amount = body.amount,
                odometer = body.odometer,
                status = body.status,
            ),
        )
        audit(actor, "JOURNAL_CREATED", saved.id.toString(), "${saved.category}|${saved.status}")
        return toResponse(saved)
    }

    @Transactional
    fun changeStatus(actor: String, vehicleId: Long, entryId: Long, body: JournalStatusRequest): JournalEntryResponse {
        requireOwner(actor, vehicleId)
        val entry = journal.findByIdOrNull(entryId) ?: throw NoSuchElementException("기록을 찾지 못했습니다.")
        if (entry.vehicleId != vehicleId) throw AccessDeniedException("이 기록에 접근할 수 없습니다.")
        require(body.status != "DONE" || !entry.entryDate.isAfter(today())) { "예정일이 되면 완료로 변경할 수 있습니다." }
        if (body.status == "ARCHIVED" && entry.status != "ARCHIVED") entry.archivedStatus = entry.status
        entry.status = if (body.status == "RESTORE") {
            require(entry.status == "ARCHIVED") { "보관한 기록만 복원할 수 있습니다." }
            entry.archivedStatus ?: "PLANNED"
        } else body.status
        val saved = journal.save(entry)
        audit(actor, "JOURNAL_STATUS_CHANGED", saved.id.toString(), saved.status)
        return toResponse(saved)
    }

    @Transactional(readOnly = true)
    fun report(actor: String, vehicleId: Long, requestedMonth: String?): VehicleJournalReportResponse {
        requireOwner(actor, vehicleId)
        val month = parseMonth(requestedMonth)
        val start = month.atDay(1)
        val endExclusive = month.plusMonths(1).atDay(1)
        val completed = journal.findByVehicleIdAndEntryDateGreaterThanEqualAndEntryDateLessThanAndStatusOrderByEntryDateDescCreatedAtDesc(
            vehicleId,
            start,
            endExclusive,
            STATUS_DONE,
        )
        val withAmount = completed.filter { it.amount != null }
        val total = withAmount.sumOf { it.amount!! }
        val categories = withAmount
            .groupBy { it.category }
            .map { (category, records) ->
                JournalCategoryTotalResponse(
                    category = category,
                    totalAmount = records.sumOf { it.amount!! },
                    recordCount = records.size,
                )
            }
            .sortedByDescending { it.totalAmount }

        return VehicleJournalReportResponse(
            vehicleId = vehicleId,
            month = month.toString(),
            source = "OWNER_ENTERED",
            currency = "KRW",
            completedRecordCount = completed.size,
            costRecordCount = withAmount.size,
            recordsWithoutAmount = completed.size - withAmount.size,
            totalAmount = total,
            averageAmount = total.takeIf { withAmount.isNotEmpty() }?.let { it / withAmount.size },
            categoryTotals = categories,
        )
    }

    private fun requireOwner(actor: String, vehicleId: Long): Vehicle {
        val vehicle = vehicles.findByIdOrNull(vehicleId) ?: throw NoSuchElementException("차량을 찾지 못했습니다.")
        if (vehicle.ownerId != actor) throw AccessDeniedException("연결한 내 차량의 기록만 관리할 수 있습니다.")
        return vehicle
    }

    private fun parseMonth(value: String?): YearMonth {
        val candidate = value?.takeIf { it.isNotBlank() } ?: YearMonth.now(SEOUL_ZONE).toString()
        return runCatching {
            YearMonth.parse(candidate, MONTH_FORMATTER).also { month ->
                require(month.year in 1900..2200) { "조회 월을 확인해 주세요." }
            }
        }.getOrElse { throw IllegalArgumentException("조회 월은 YYYY-MM 형식이어야 합니다.") }
    }

    private fun today(): LocalDate = LocalDate.now(SEOUL_ZONE)

    private fun toResponse(entry: VehicleJournal) = JournalEntryResponse(
        id = entry.id,
        vehicleId = entry.vehicleId,
        category = entry.category,
        title = entry.title,
        note = entry.note,
        entryDate = entry.entryDate.toString(),
        amount = entry.amount,
        odometer = entry.odometer,
        status = entry.status,
        createdAt = entry.createdAt,
    )

    private fun audit(actor: String, action: String, resourceId: String, detail: String) {
        val now = Instant.now()
        auditLogs.save(
            AuditLog(
                actorId = actor,
                action = action,
                resourceType = "VehicleJournal",
                resourceId = resourceId,
                detail = detail,
                signature = sign("$actor|$action|$resourceId|$detail|$now"),
                createdAt = now,
            ),
        )
    }

    private fun sign(value: String): String = MessageDigest.getInstance("SHA-256")
        .digest(value.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
        .take(24)

    private companion object {
        const val MAX_ENTRIES_PER_VEHICLE = 10_000L
        const val STATUS_DONE = "DONE"
        val SEOUL_ZONE: ZoneId = ZoneId.of("Asia/Seoul")
        val MONTH_FORMATTER: DateTimeFormatter = DateTimeFormatterBuilder()
            .appendPattern("uuuu-MM")
            .toFormatter()
            .withResolverStyle(ResolverStyle.STRICT)
    }
}
