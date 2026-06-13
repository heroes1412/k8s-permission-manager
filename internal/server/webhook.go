package server

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"sighupio/permission-manager/internal/resources"
)

var (
	webhookClient     *http.Client
	webhookTransport  *http.Transport
	webhookConfigMu  sync.Mutex
	lastProxyURL     string
	lastProxyUser    string
	lastProxyPass    string
)

func getWebhookClient(proxyURL, proxyUser, proxyPass string) *http.Client {
	webhookConfigMu.Lock()
	defer webhookConfigMu.Unlock()

	if webhookClient != nil && lastProxyURL == proxyURL && lastProxyUser == proxyUser && lastProxyPass == proxyPass {
		return webhookClient
	}

	// Reconfigure transport if proxy settings changed
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if proxyURL != "" {
		pURL, err := url.Parse(proxyURL)
		if err == nil {
			if proxyUser != "" {
				pURL.User = url.UserPassword(proxyUser, proxyPass)
			}
			transport.Proxy = http.ProxyURL(pURL)
		} else {
			log.Printf("Invalid Webhook Proxy URL: %v", err)
		}
	}

	webhookTransport = transport
	webhookClient = &http.Client{
		Timeout:   10 * time.Second,
		Transport: webhookTransport,
	}
	lastProxyURL = proxyURL
	lastProxyUser = proxyUser
	lastProxyPass = proxyPass

	return webhookClient
}

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

	// Fix #2: Validate webhook URL to prevent SSRF
	u, err := url.Parse(webhookURL)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
		log.Printf("Invalid Webhook URL scheme: %s. Only http/https allowed.", webhookURL)
		return
	}

	// Proxy configs
	proxyURLStr := string(secret.Data["WEBHOOK_PROXY_URL"])
	proxyUser := string(secret.Data["WEBHOOK_PROXY_USER"])
	proxyPass := string(secret.Data["WEBHOOK_PROXY_PASSWORD"])

	client := getWebhookClient(proxyURLStr, proxyUser, proxyPass)

	go func() {
		payload := map[string]string{"text": message}
		jsonPayload, _ := json.Marshal(payload)
		req, err := http.NewRequest("POST", webhookURL, bytes.NewBuffer(jsonPayload))
		if err != nil {
			log.Printf("Failed to create webhook request: %v", err)
			return
		}
		req.Header.Set("Content-Type", "application/json")

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
