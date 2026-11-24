FROM oven/bun:canary AS build
WORKDIR /src
COPY . .
RUN bun .mise/tasks/compile.ts

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=build /src/build/nodeps /usr/local/bin/nodeps
WORKDIR /site
EXPOSE 3000
ENTRYPOINT ["nodeps"]
CMD ["serve"]
