package com.hyundai.lifepass.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

enum class ReleaseStatus { DRAFT, ROLLING, COMPLETE, PAUSED }

@Entity
@Table(name = "releases")
class Release(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,

    @Column(nullable = false, length = 20)
    var version: String = "",

    @Column(nullable = false, length = 180)
    var title: String = "",

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    var status: ReleaseStatus = ReleaseStatus.DRAFT,

    @Column(nullable = false, length = 120)
    var target: String = "",

    @Column(nullable = false)
    var progress: Int = 0,

    @Column(nullable = false, length = 20)
    var risk: String = "Low",

    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
)
