package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"sighupio/permission-manager/internal/config"
	"sighupio/permission-manager/internal/resources"
	"sighupio/permission-manager/internal/server"
)

func main() {
	cfg := config.New()

	kubeClient := resources.NewKubeClient()

	s := server.New(*cfg, kubeClient)
	addr := ":" + cfg.Backend.Port

	// Fix #3: Set HTTP server timeouts to prevent resource exhaustion from slow/abusive clients.
	// WriteTimeout is generous to cover the worst-case kubeconfig polling path (~12s).
	s.Server.ReadTimeout = 30 * time.Second
	s.Server.WriteTimeout = 60 * time.Second
	s.Server.IdleTimeout = 120 * time.Second

	// Fix #7: Start server in a background goroutine so we can also listen for shutdown signals.
	go func() {
		if err := s.Start(addr); err != nil && !errors.Is(err, http.ErrServerClosed) {
			s.Logger.Fatal(err)
		}
	}()

	// Block until OS interrupt or SIGTERM.
	// Kubernetes sends SIGTERM when a pod is being deleted — graceful shutdown prevents
	// in-flight RBAC mutations from being aborted mid-way, which would leave bindings
	// in an inconsistent state.
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	// Fix #8: Start background expiration worker to handle auto-deletion
	workerCtx, workerCancel := context.WithCancel(context.Background())
	server.StartExpirationWorker(workerCtx, kubeClient, *cfg)

	<-quit

	workerCancel()
	s.Logger.Info("Shutdown signal received, draining in-flight requests (max 30s)...")
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := s.Shutdown(ctx); err != nil {
		s.Logger.Fatal(err)
	}
	s.Logger.Info("Server stopped cleanly.")
}
