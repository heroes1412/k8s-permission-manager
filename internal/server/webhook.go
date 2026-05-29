package server

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"time"

	"sighupio/permission-manager/internal/resources"
)

func sendWebhookNotification(rm *resources.Manager, message string) {
	secret, err := rm.SecretGet("permission-manager", "permission-manager")
	if err != nil {
		return
	}

	urlBytes, ok := secret.Data["WEBHOOK_URL"]
	if !ok || len(urlBytes) == 0 {
		return
	}

	webhookURL := string(urlBytes)

	// Proxy configs
	proxyURLStr := string(secret.Data["WEBHOOK_PROXY_URL"])
	proxyUser := string(secret.Data["WEBHOOK_PROXY_USER"])
	proxyPass := string(secret.Data["WEBHOOK_PROXY_PASSWORD"])

	go func() {
		payload := map[string]string{"text": message}
		jsonPayload, _ := json.Marshal(payload)
		req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(jsonPayload))
		if err != nil {
			log.Printf("Failed to create webhook request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")

		transport := http.DefaultTransport.(*http.Transport).Clone()

		if proxyURLStr != "" {
			pURL, err := url.Parse(proxyURLStr)
			if err == nil {
				if proxyUser != "" {
					pURL.User = url.UserPassword(proxyUser, proxyPass)
				}
				transport.Proxy = http.ProxyURL(pURL)
			} else {
				log.Printf("Invalid Webhook Proxy URL: %v", err)
			}
		}

		client := &http.Client{
			Timeout:   10 * time.Second,
			Transport: transport,
		}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("Failed to send webhook: %v", err)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 400 {
			log.Printf("Webhook returned status: %d", resp.StatusCode)
		}
	}()
}
