# Build stage
FROM --platform=$BUILDPLATFORM denoland/deno:alpine AS builder
ARG TARGETARCH
WORKDIR /app
ADD . /app
COPY stcm_creater_${TARGETARCH} /app/stcm_creater
RUN rm stcm_creater_*
RUN deno cache src/main.ts

# Final image
FROM denoland/deno:alpine
WORKDIR /app
COPY --from=builder /app .
USER deno
EXPOSE 8000
CMD ["run", "--allow-net", "--allow-run", "--allow-read", "--allow-write", "src/main.ts"]
