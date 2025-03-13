# Build stage
FROM --platform=$BUILDPLATFORM denoland/deno:alpine AS builder
WORKDIR /app
ADD . /app
RUN deno cache src/main.ts

# Final image
FROM denoland/deno:alpine
WORKDIR /app
COPY --from=builder /app .
COPY stcm_creater_$TARGETARCH /app/stcm_creater
RUN chmod +x /app/stcm_creater
USER deno
EXPOSE 8000
CMD ["run", "--allow-net", "--allow-run", "--allow-read", "--allow-write", "src/main.ts"]
