package com.hyundai.lifepass.domain

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "hyundai_oauth_states")
class HyundaiOAuthState(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, unique = true, length = 100)
    var stateToken: String = "",
    @Column(nullable = false, length = 160)
    var actorId: String = "",
    @Column(nullable = false)
    var expiresAt: Instant = Instant.now().plusSeconds(600),
    @Column(nullable = false)
    var consumed: Boolean = false,
)

@Entity
@Table(name = "hyundai_connections")
class HyundaiConnection(
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long = 0,
    @Column(nullable = false, unique = true, length = 160)
    var actorId: String = "",
    @Column(length = 160)
    var hyundaiUserId: String? = null,
    @Column(nullable = false, length = 2048)
    var accessTokenEncrypted: String = "",
    @Column(nullable = false, length = 2048)
    var refreshTokenEncrypted: String = "",
    @Column(nullable = false)
    var expiresAt: Instant = Instant.now(),
    @Column(nullable = false, length = 32)
    var status: String = "CONNECTED",
    @Column(nullable = false)
    var createdAt: Instant = Instant.now(),
    @Column(nullable = false)
    var updatedAt: Instant = Instant.now(),
)
