FROM denoland/deno:alpine
EXPOSE 8000
WORKDIR /app
ADD . /app
#COPY stcm_creater_arm64 /app/stcm_creater
COPY stcm_creater_x86_64 /app/stcm_creater
#RUN chmod +x /app/stcm_creater
RUN chmod +x /app/stcm_creater_x86_64
USER deno
RUN deno install --entrypoint src/main.ts
CMD ["run", "--allow-net", "--allow-run", "--allow-read", "--allow-write", "src/main.ts"]


