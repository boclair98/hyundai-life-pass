package com.hyundai.lifepass.service

import com.hyundai.lifepass.api.ReleaseResponse
import com.hyundai.lifepass.domain.ReleaseStatus
import com.hyundai.lifepass.repository.ReleaseRepository
import org.springframework.data.repository.findByIdOrNull
import org.springframework.scheduling.annotation.Scheduled
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

    @Transactional
    fun advance(id: Long): ReleaseResponse {
        val release = requireRelease(id)
        if (release.status == ReleaseStatus.PAUSED || release.status == ReleaseStatus.DRAFT) release.status = ReleaseStatus.ROLLING
        release.progress = (release.progress + 10).coerceAtMost(100)
        if (release.progress == 100) release.status = ReleaseStatus.COMPLETE
        return toResponse(releaseRepository.save(release))
    }

    @Transactional
    fun pause(id: Long): ReleaseResponse {
        val release = requireRelease(id)
        release.status = ReleaseStatus.PAUSED
        return toResponse(releaseRepository.save(release))
    }

    @Scheduled(fixedDelayString = "\${lifepass.release-tick-ms:20000}")
    @Transactional
    fun advanceRollingReleases() {
        releaseRepository.findAll().filter { it.status == ReleaseStatus.ROLLING }.forEach {
            it.progress = (it.progress + 2).coerceAtMost(100)
            if (it.progress == 100) it.status = ReleaseStatus.COMPLETE
            releaseRepository.save(it)
        }
    }

    private fun requireRelease(id: Long) = releaseRepository.findByIdOrNull(id) ?: throw NoSuchElementException("Release $id was not found")

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
