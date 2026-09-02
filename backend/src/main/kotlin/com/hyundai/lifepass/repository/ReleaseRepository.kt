package com.hyundai.lifepass.repository

import com.hyundai.lifepass.domain.Release
import org.springframework.data.jpa.repository.JpaRepository

interface ReleaseRepository : JpaRepository<Release, Long>
