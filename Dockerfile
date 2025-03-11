FROM --platform=$BUILDPLATFORM denoland/deno:alpine
EXPOSE 8000
WORKDIR /app
ADD . /app
COPY stcm_creater /app/stcm_creater
RUN chmod +x /app/stcm_creater
USER deno
RUN deno install --entrypoint src/main.ts
CMD ["run", "--allow-net", "--allow-run", "--allow-read", "--allow-write", "src/main.ts"]
