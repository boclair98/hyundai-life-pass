package com.hyundai.lifepass.service

import com.hyundai.lifepass.api.ReleaseResponse
import com.hyundai.lifepass.domain.ReleaseStatus
import com.hyundai.lifepass.repository.ReleaseRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

@Service
class ReleaseService(private val releaseRepository: ReleaseRepository) {
    @Transactional(readOnly = true)
    fun findAll(): List<ReleaseResponse> = releaseRepository.findAll().sortedByDescending { it.createdAt }.map(::toResponse)

    @Transactional
    fun start(id: Long): ReleaseResponse {
        val release = releaseRepository.findByIdOrNull(id) ?: throw NoSuchElementException("Release $id was not found")
        release.status = ReleaseStatus.ROLLING
        release.progress = maxOf(release.progress, 1)
        return toResponse(releaseRepository.save(release))
    }

    private fun toResponse(release: com.hyundai.lifepass.domain.Release) = ReleaseResponse(
        id = release.id,
        version = release.version,
        title = release.title,
        status = release.status,
        target = release.target,
        progress = release.progress,
        risk = release.risk,
        createdAt = release.createdAt,
    )
}
