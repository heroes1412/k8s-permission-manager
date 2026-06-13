package server

import (
	"crypto/subtle"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-playground/validator"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	k8sclient "k8s.io/client-go/kubernetes"

	"sighupio/permission-manager/internal/config"
	"sighupio/permission-manager/internal/resources"
	"sighupio/permission-manager/static"
)

func New(cfg config.Config, kubeClient k8sclient.Interface) *echo.Echo {
	e := echo.New()

	e.Validator = &CustomValidator{validator: validator.New()}

	addMiddlewareStack(e, cfg, kubeClient)
	addRoutes(e)

	return e
}

// addMiddlewareStack configures global middleware.
// kubeClient is shared across all requests via the AppContext.
func addMiddlewareStack(e *echo.Echo, cfg config.Config, kubeClient k8sclient.Interface) {
	basicAuthPassword := os.Getenv("BASIC_AUTH_PASSWORD")

	if basicAuthPassword == "" {
		log.Fatal("BASIC_AUTH_PASSWORD env cannot be empty")
	}

	// Fix #6: Only enable CORS in local development.
	// In production the frontend is served from the same origin, so a permissive CORS
	// header is unnecessary overhead and a minor security risk. Set CORS_ENABLED=true
	// in your local .env / envrc to restore the previous behaviour during development.
	if os.Getenv("CORS_ENABLED") == "true" {
		e.Use(middleware.CORS())
	}

	e.Use(middleware.BodyLimit("2M"))

	// Add an unauthenticated health check endpoint
	e.GET("/api/health", func(c echo.Context) error {
		return c.String(http.StatusOK, "OK")
	})

	e.Use(middleware.BasicAuthWithConfig(middleware.BasicAuthConfig{
		Skipper: func(c echo.Context) bool {
			return c.Path() == "/api/health"
		},
		Validator: func(username, password string, c echo.Context) (bool, error) {
			userMatch := subtle.ConstantTimeCompare([]byte(username), []byte("admin"))
			passMatch := subtle.ConstantTimeCompare([]byte(password), []byte(basicAuthPassword))
			if userMatch == 1 && passMatch == 1 {
				return true, nil
			}
			return false, nil
		},
	}))

	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: "method=${method}, uri=${uri}, status=${status}\n",
	}))

	fsys, err := fs.Sub(static.WebClient, "build")
	if err != nil {
		log.Fatal(err)
	}

	e.Group("/*", func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path
			// Cache assets that have content hashes (JS/CSS) or static images
			if strings.HasSuffix(path, ".js") ||
				strings.HasSuffix(path, ".css") ||
				strings.HasSuffix(path, ".png") ||
				strings.HasSuffix(path, ".svg") ||
				strings.HasSuffix(path, ".ico") {
				c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
			} else {
				// Prevent caching of index.html to ensure users always get the latest version
				c.Response().Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			}
			return next(c)
		}
	}, middleware.StaticWithConfig(middleware.StaticConfig{
		Root:       ".",
		Filesystem: http.FS(fsys),
		HTML5:      true,
	}))
	// Fix #1 (continued): NewManager is a cheap struct wrapper — safe to create per-request.
	// Only the underlying KubeClient (kubeClient) is shared and reused.
	e.Use(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			customContext := &AppContext{
				Context:         c,
				ResourceManager: resources.NewManager(kubeClient, c.Request().Context(), cfg.Cluster.Namespace),
				Config:          cfg,
			}
			return next(customContext)
		}
	})
}

func addRoutes(e *echo.Echo) {
	api := e.Group("/api")

	// Add a global rate limiter for API endpoints
	api.Use(middleware.RateLimiter(middleware.NewRateLimiterMemoryStore(20)))

	api.GET("/list-users", listUsers)
	api.GET("/list-groups", listGroups)
	api.GET("/list-namespace", ListNamespaces)
	api.GET("/rbac", listRbac)

	api.POST("/create-cluster-role", createClusterRole)
	api.POST("/update-cluster-role", updateClusterRole)
	api.POST("/create-user", createUser)
	api.POST("/update-user", updateUser)
	api.POST("/create-group", createGroup)
	api.POST("/update-group", updateGroup)
	api.POST("/create-rolebinding", createRoleBinding)
	api.POST("/create-cluster-rolebinding", createClusterRolebinding)

	/* should use DELETE method, using POST due to a weird bug that looks now resolved */
	api.POST("/delete-cluster-role", deleteClusterRole)
	api.POST("/delete-cluster-rolebinding", deleteClusterRolebinding)
	api.POST("/delete-rolebinding", deleteRolebinding)
	api.POST("/delete-role", deleteRole)
	api.POST("/delete-user", deleteUser)
	api.POST("/delete-group", deleteGroup)

	api.POST("/create-kubeconfig", createKubeconfig)
	api.POST("/check-legacy-user", checkLegacyUser)
	api.POST("/create-namespace", createNamespace)
	api.POST("/delete-namespace", deleteNamespace)

	api.GET("/settings", getSettings)
	api.POST("/settings", updateSettings)
	api.POST("/restart", restartApp)

	// New Features
	api.GET("/export-gitops", exportGitOps)
	api.GET("/access-audit", getAccessAudit)
	api.POST("/check-permission", checkPermission)
}
