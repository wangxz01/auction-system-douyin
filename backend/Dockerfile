FROM golang:1.25-alpine AS builder

WORKDIR /src
RUN apk add --no-cache ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/auction-server ./cmd/server

FROM alpine:3.21

WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata && mkdir -p /app/uploads/images

COPY --from=builder /out/auction-server /app/auction-server

EXPOSE 8080

CMD ["/app/auction-server"]
