FROM denoland/deno:alpine
EXPOSE 8000
WORKDIR /app
USER deno
ADD . /app
RUN deno install --entrypoint src/main.ts
CMD ["run", "--allow-net", "src/main.ts"]
