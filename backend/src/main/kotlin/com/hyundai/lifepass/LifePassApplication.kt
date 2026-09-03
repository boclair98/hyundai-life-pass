package com.hyundai.lifepass

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableScheduling

@SpringBootApplication
@EnableScheduling
class LifePassApplication

fun main(args: Array<String>) {
    runApplication<LifePassApplication>(*args)
}
