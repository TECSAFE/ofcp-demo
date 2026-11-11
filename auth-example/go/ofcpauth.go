// Package ofcpauth implements the OFCP token exchange for a shop backend (Go 1.18+, standard library only).
//
//  1. Saleschannel token (15 min): the shop's service account + app password from the
//     TECSAFE cockpit (Saleschannel → Credentials). Cached and reused until shortly before expiry.
//  2. Customer token (5 min): derived from the saleschannel token for one shopper or guest.
//     Hand this one to the browser / TECSAFE widgets, never the saleschannel token.
//
// Keep the service account credentials server-side (env, secret store); never ship them to a browser.
//
// Usage:
//
//	auth := ofcpauth.New(os.Getenv("OFCP_SERVICE_ACCOUNT"), os.Getenv("OFCP_SERVICE_ACCOUNT_TOKEN"))
//	guest, err := auth.CustomerToken(ctx, ofcpauth.Customer{GuestSessionTTL: 7})
//	shopper, err := auth.CustomerToken(ctx, ofcpauth.Customer{
//		CustomerPayload:                 &ofcpauth.CustomerPayload{SaleschannelCustomerID: "4711", SaleschannelCustomerEmail: "max@example.com"},
//		PreviousSaleschannelCustomerJwt: guest,
//	})
package ofcpauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	tokenURL = "https://auth.tec-digital.de/application/o/token/"
	// TODO: replace with the saleschannel client id shown in the cockpit next to your credentials.
	saleschannelClientID = "TODO_SALESCHANNEL_CLIENT_ID"
	// TODO: replace with the customer client id shown in the cockpit next to your credentials.
	customerClientID = "TODO_CUSTOMER_CLIENT_ID"
)

// CustomerPayload describes a logged-in shopper; leave Customer.CustomerPayload nil for a guest.
type CustomerPayload struct {
	SaleschannelCustomerID    string      `json:"saleschannelCustomerID"`
	SaleschannelCustomerEmail string      `json:"saleschannelCustomerEmail"`
	CustomerGroup             string      `json:"customerGroup,omitempty"`
	CustomerCompany           string      `json:"customerCompany,omitempty"`
	CustomerTeams             []string    `json:"customerTeams,omitempty"`
	FilterTags                []FilterTag `json:"filterTags,omitempty"`
}

type FilterTag struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// Customer is the body of the customer exchange.
type Customer struct {
	CustomerPayload *CustomerPayload `json:"customerPayload,omitempty"`
	// The customer token the browser held before (keeps the guest session, merges guest data on login).
	PreviousSaleschannelCustomerJwt string `json:"previousSaleschannelCustomerJwt,omitempty"`
	// Lifetime of a guest session in days.
	GuestSessionTTL int `json:"guestSessionTTL,omitempty"`
}

type Client struct {
	serviceAccount string
	appPassword    string
	http           *http.Client

	mu        sync.Mutex
	token     string
	expiresAt time.Time
}

func New(serviceAccount, appPassword string) *Client {
	return &Client{serviceAccount: serviceAccount, appPassword: appPassword, http: &http.Client{Timeout: 15 * time.Second}}
}

// SaleschannelToken returns the cached saleschannel token, fetching a new one 60 s before expiry.
func (c *Client) SaleschannelToken(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.token != "" && time.Now().Before(c.expiresAt.Add(-60*time.Second)) {
		return c.token, nil
	}
	res, err := c.requestToken(ctx, url.Values{
		"grant_type": {"client_credentials"},
		"client_id":  {saleschannelClientID},
		"username":   {c.serviceAccount},
		"password":   {c.appPassword},
		"scope":      {"ofcp"},
	})
	if err != nil {
		return "", err
	}
	c.token = res.AccessToken
	c.expiresAt = time.Now().Add(time.Duration(res.ExpiresIn) * time.Second)
	return c.token, nil
}

// CustomerToken derives a customer token for one shopper or guest.
func (c *Client) CustomerToken(ctx context.Context, customer Customer) (string, error) {
	saleschannelToken, err := c.SaleschannelToken(ctx)
	if err != nil {
		return "", err
	}
	body, err := json.Marshal(customer)
	if err != nil {
		return "", err
	}
	res, err := c.requestToken(ctx, url.Values{
		"grant_type":            {"client_credentials"},
		"client_id":             {customerClientID},
		"client_assertion_type": {"urn:ietf:params:oauth:client-assertion-type:jwt-bearer"},
		"client_assertion":      {saleschannelToken},
		"scope":                 {"ofcp"},
		"ofcp_customer":         {string(body)},
	})
	if err != nil {
		return "", err
	}
	return res.AccessToken, nil
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

func (c *Client) requestToken(ctx context.Context, form url.Values) (*tokenResponse, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, tokenURL, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("OFCP token request failed: %w", err)
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		// Wrong credentials, an inactive saleschannel and a refused customer all answer 400 invalid_grant;
		// quote the request_id from this body to TECSAFE support.
		return nil, fmt.Errorf("OFCP token request failed: %d %s", resp.StatusCode, raw)
	}
	var res tokenResponse
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, err
	}
	if res.AccessToken == "" || res.ExpiresIn == 0 {
		return nil, fmt.Errorf("OFCP token request failed: no access_token in the response")
	}
	return &res, nil
}
