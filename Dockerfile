ARG BUILDPLATFORM
FROM --platform=$BUILDPLATFORM oven/bun:1.4.5@sha256:3aa040e5445efa09d75bb428a64ba50db13e2b3ac9b6b0c7f145615f62b2ee18 AS build
ARG TARGETARCH
WORKDIR /app
COPY . .
RUN target="bun-linux-$(if [ "$TARGETARCH" = amd64 ]; then echo x64; else echo arm64; fi)-musl" \
  && bun .mise/tasks/compile.ts "$target" \
  && mv "build/nodeps-${target#bun-}" build/nodeps

FROM alpine:3.22@sha256:49340b346798875b5592e5d420241f2f9cfba5f47e62ebb1446a1b34734e898f AS runtime
# The base is pinned by digest; package versions follow that Alpine release.
# hadolint ignore=DL3018
RUN apk add --no-cache libstdc++ ca-certificates && mkdir -p /runtime/tmp && chmod 1777 /runtime/tmp

FROM scratch
COPY --from=runtime /lib/ld-musl-*.so.1 /lib/
COPY --from=runtime /usr/lib/libstdc++.so.6* /usr/lib/libgcc_s.so.1 /usr/lib/
COPY --from=runtime /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=runtime /runtime/tmp /tmp
COPY --from=build /app/build/nodeps /usr/local/bin/nodeps
WORKDIR /app
COPY --from=build /app/docs.yaml ./docs.yaml
COPY --from=build /app/docs ./docs
USER 65532:65532
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/nodeps"]
CMD ["serve"]
