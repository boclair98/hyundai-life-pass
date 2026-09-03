FROM gradle:8.12.1-jdk21-alpine AS builder

WORKDIR /app
COPY . .
RUN gradle bootJar --no-daemon

FROM eclipse-temurin:21-jre-alpine AS runner

WORKDIR /app
RUN addgroup -S lifepass && adduser -S lifepass -G lifepass
COPY --from=builder /app/build/libs/hyundai-life-pass-api-0.1.0.jar app.jar
USER lifepass
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
