# Build stage
FROM --platform=$BUILDPLATFORM denoland/deno:alpine AS builder
ARG TARGETARCH
WORKDIR /app
COPY . .
COPY stcm_creater_${TARGETARCH} /app/stcm_creater
RUN rm stcm_creater_*
RUN deno cache src/main.ts

# Final image
FROM denoland/deno:alpine
COPY --from=builder /deno-dir /deno-dir
WORKDIR /app
COPY --from=builder /app .
USER deno
EXPOSE 8000
ENV DENO_NO_UPDATE_CHECK=1
ENV DENO_NO_PROMPT=1
CMD ["run", "--allow-net", "--allow-run", "--allow-read", "--allow-write", "src/main.ts"]
