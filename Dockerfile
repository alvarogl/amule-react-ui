# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS ui-build
WORKDIR /src
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM ubuntu:24.04 AS amule-build
ARG AMULE_COMMIT=ca3988e5c3d24a27b2a98bf21f92e98eee2bf49d
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates cmake git libboost-dev libcrypto++-dev libcurl4-openssl-dev \
    libglib2.0-dev libmaxminddb-dev libupnp-dev libwxgtk3.2-dev ninja-build pkg-config zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
RUN git clone https://github.com/amule-org/amule.git amule \
    && cd amule \
    && git checkout --detach "$AMULE_COMMIT" \
    && test "$(git rev-parse HEAD)" = "$AMULE_COMMIT"
RUN cmake -S /src/amule -B /src/build -G Ninja \
      -DCMAKE_BUILD_TYPE=Release \
      -DCMAKE_INSTALL_PREFIX=/usr/local \
      -DBUILD_MONOLITHIC=OFF \
      -DBUILD_REMOTEGUI=OFF \
      -DBUILD_WEBSERVER=OFF \
      -DBUILD_AMULECMD=YES \
      -DBUILD_AMULEAPI=YES \
      -DBUILD_DAEMON=YES \
      -DENABLE_NLS=OFF \
      -DENABLE_UPNP=YES \
    && cmake --build /src/build --parallel \
    && cmake --install /src/build

FROM ubuntu:24.04 AS runtime
ARG AMULE_COMMIT=ca3988e5c3d24a27b2a98bf21f92e98eee2bf49d
ARG AMULE_VERSION=git-ca3988e5
ARG VERSION=dev
ARG SOURCE_REVISION=unknown
LABEL org.opencontainers.image.title="aMule Console" \
      org.opencontainers.image.description="aMule daemon with the bundled React console" \
      org.opencontainers.image.source="https://github.com/alvarogl/amule-react-ui" \
      org.opencontainers.image.revision="$SOURCE_REVISION" \
      org.opencontainers.image.version="$VERSION" \
      org.opencontainers.image.amule.version="$AMULE_VERSION" \
      org.opencontainers.image.amule.revision="$AMULE_COMMIT"
ENV DEBIAN_FRONTEND=noninteractive \
    AMULE_CONFIG_DIR=/config \
    AMULE_INCOMING_DIR=/incoming \
    AMULE_TEMP_DIR=/temp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl gosu libcrypto++8t64 libglib2.0-0t64 libmaxminddb0 libupnp17t64 \
    libwxbase3.2-1t64 tini zlib1g \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --home-dir /config amule
COPY --from=amule-build /usr/local/ /usr/local/
COPY --from=ui-build /src/dist/ /opt/amule-ui/
COPY docker/entrypoint.sh /usr/local/bin/amule-container-entrypoint
RUN chmod 0755 /usr/local/bin/amule-container-entrypoint \
    && mkdir -p /config /incoming /temp \
    && chown -R amule:amule /config /incoming /temp
EXPOSE 4713/tcp 4662/tcp 4672/udp
VOLUME ["/config", "/incoming", "/temp"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:4713/api/v0/version >/dev/null || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/amule-container-entrypoint"]
CMD ["amuled", "--log-stdout", "--config-dir=/config"]
