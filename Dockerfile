FROM denoland/deno

EXPOSE 8000

WORKDIR /app

ADD . /app

RUN deno install --entrypoint src/main.ts

CMD ["run", "--allow-env", "--allow-read", "--allow-net", "src/main.ts"]