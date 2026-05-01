## UI ##
FROM --platform=$BUILDPLATFORM node:20-alpine AS ui-builder
RUN mkdir /app
COPY web-client /app

WORKDIR /app
RUN yarn install && yarn build

## BACKEND ##
FROM golang:1.23-alpine AS go-base

ENV GOCACHE=/tmp/.go/cache
ENV GOMODCACHE=/tmp/.go/modcache
ENV GOTMPDIR=/tmp/.go/tmp
ENV CGO_ENABLED=0

ARG CLUSTER_NAME
ARG NAMESPACE
ARG PORT
ARG CONTROL_PLANE_ADDRESS
ARG BASIC_AUTH_PASSWORD

ENV CLUSTER_NAME=${CLUSTER_NAME}
ENV CONTROL_PLANE_ADDRESS=${CONTROL_PLANE_ADDRESS}
ENV NAMESPACE=${NAMESPACE}
ENV PORT=${PORT}
ENV BASIC_AUTH_PASSWORD=${BASIC_AUTH_PASSWORD}

RUN mkdir -p /tmp/.go/cache /tmp/.go/modcache /tmp/.go/tmp /app

WORKDIR /app

COPY go.mod go.mod
COPY go.sum go.sum

RUN go mod download

COPY cmd cmd
COPY internal internal
COPY static static

FROM go-base AS development
COPY --from=ui-builder /app/build /app/static/build

ENTRYPOINT ["go", "run", "cmd/run-server.go"]

FROM go-base AS builder
COPY --from=ui-builder /app/build /app/static/build
RUN go build -trimpath -ldflags="-s -w" --tags=release -o permission-manager cmd/run-server.go

FROM scratch AS release

WORKDIR /app
COPY --from=builder /app/permission-manager /app/permission-manager
EXPOSE 4000

ENTRYPOINT ["./permission-manager"]

