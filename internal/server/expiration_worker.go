package server

import (
	"context"
	"log"
	"time"

	"sighupio/permission-manager/internal/config"
	"sighupio/permission-manager/internal/resources"

	k8sclient "k8s.io/client-go/kubernetes"
)

// StartExpirationWorker starts a background goroutine that periodically checks for
// expired users and deletes them (and their bindings) if the EXPIRED_USER_ACTION setting is "DELETE".
func StartExpirationWorker(ctx context.Context, kubeClient k8sclient.Interface, cfg config.Config) {
	ticker := time.NewTicker(10 * time.Minute)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				runExpirationCheck(kubeClient, cfg)
			}
		}
	}()
	// Run once on startup
	go runExpirationCheck(kubeClient, cfg)
}

func runExpirationCheck(kubeClient k8sclient.Interface, cfg config.Config) {
	rm := resources.NewManager(kubeClient, context.Background(), cfg.Cluster.Namespace)

	// Check setting
	secret, err := rm.SecretGet("permission-manager", "permission-manager")
	if err != nil {
		return
	}

	action := "DELETE" // default
	if val, ok := secret.Data["EXPIRED_USER_ACTION"]; ok {
		if string(val) == "KEEP" || string(val) == "Keep" {
			action = "KEEP"
		}
	}

	users, err := rm.V1Alpha1PermissionManagerUser.List()
	if err != nil {
		log.Printf("Expiration worker failed to list users: %v", err)
		return
	}

	// Deduplication map for groups that need syncing after members are deleted or revoked
	groupsToSync := make(map[string]bool)
	usersProcessed := 0

	for _, u := range users {
		if u.MaxDays > 0 {
			createdAt, err := time.Parse(time.RFC3339, u.CreatedAt)
			if err != nil {
				continue
			}
			expirationTime := createdAt.AddDate(0, 0, u.MaxDays)
			if time.Now().After(expirationTime) {
				log.Printf("Expiration worker: User %s has expired. Action: %s", u.Name, action)
				
				// Collect groups to sync them later
				for _, g := range u.Groups {
					groupsToSync[g] = true
				}

				if action == "DELETE" {
					deleteExpiredUser(rm, u.Name)
				} else {
					// For KEEP, we just revoke all permissions
					revokePermissions(rm, u.Name)
				}
				
				usersProcessed++
				time.Sleep(200 * time.Millisecond)
			}
		}
	}

	// Sync affected groups
	if usersProcessed > 0 && len(groupsToSync) > 0 {
		log.Printf("Expiration worker: Syncing %d affected groups...", len(groupsToSync))
		for g := range groupsToSync {
			if err := rm.SyncGroup(g); err != nil {
				log.Printf("Failed to sync group %s during expiration: %v", g, err)
			}
			time.Sleep(200 * time.Millisecond)
		}
	}
}

func revokePermissions(rm *resources.Manager, username string) {
	if err := rm.RoleBindingDeleteAllForUser(username); err != nil {
		log.Printf("Failed to revoke role bindings for expired user %s: %v", username, err)
	}
	if err := rm.ClusterRoleBindingDeleteAllForUser(username); err != nil {
		log.Printf("Failed to revoke cluster role bindings for expired user %s: %v", username, err)
	}
	// Note: We don't delete the User CRD here, so it remains in the cluster but with no permissions.
}

func deleteExpiredUser(rm *resources.Manager, username string) {
	if err := rm.RoleBindingDeleteAllForUser(username); err != nil {
		log.Printf("Failed to delete role bindings for expired user %s: %v", username, err)
	}
	if err := rm.ClusterRoleBindingDeleteAllForUser(username); err != nil {
		log.Printf("Failed to delete cluster role bindings for expired user %s: %v", username, err)
	}

	if err := rm.V1Alpha1PermissionManagerUser.Delete(username); err != nil {
		log.Printf("Failed to delete expired user %s: %v", username, err)
	}
}
