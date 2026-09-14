package com.hyundai.lifepass.api

import java.time.Instant

/**
 * Public representation of an owner-entered journal record.
 *
 * Keep the persistence entity private to the API layer so schema changes do not
 * silently become client contract changes.
 */
data class JournalEntryResponse(
    val id: Long,
    val vehicleId: Long,
    val category: String,
    val title: String,
    val note: String,
    val entryDate: String,
    val amount: Long?,
    val odometer: Int?,
    val status: String,
    val createdAt: Instant,
)

data class JournalCategoryTotalResponse(
    val category: String,
    val totalAmount: Long,
    val recordCount: Int,
)

/**
 * A month report is deliberately explicit about its source and denominator.
 * `costRecordCount` excludes completed records where the owner did not enter an
 * amount, so the average can never imply a cost that was not recorded.
 */
data class VehicleJournalReportResponse(
    val vehicleId: Long,
    val month: String,
    val source: String,
    val currency: String,
    val completedRecordCount: Int,
    val costRecordCount: Int,
    val recordsWithoutAmount: Int,
    val totalAmount: Long,
    val averageAmount: Long?,
    val categoryTotals: List<JournalCategoryTotalResponse>,
)
