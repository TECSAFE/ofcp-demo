<?php
// OFCP token exchange for a shop backend (PHP 8.0+, ext-curl, ext-json).
//
// 1. Saleschannel token (15 min): the shop's service account + app password from the
//    TECSAFE cockpit (Saleschannel → Credentials). Reuse it until shortly before expiry
//    (this class caches per instance; put it in APCu/Redis to share it across requests).
// 2. Customer token (5 min): derived from the saleschannel token for one shopper or guest.
//    Hand this one to the browser / TECSAFE widgets, never the saleschannel token.
//
// Keep the service account credentials server-side (env, secret store); never ship them to a browser.

declare(strict_types=1);

final class OfcpAuth
{
    private const TOKEN_URL = 'https://auth.tec-digital.de/application/o/token/';
    // TODO: replace with the saleschannel client id shown in the cockpit next to your credentials.
    private const SALESCHANNEL_CLIENT_ID = 'TODO_SALESCHANNEL_CLIENT_ID';
    // TODO: replace with the customer client id shown in the cockpit next to your credentials.
    private const CUSTOMER_CLIENT_ID = 'TODO_CUSTOMER_CLIENT_ID';

    private ?string $saleschannelToken = null;
    private int $saleschannelTokenExpiresAt = 0;

    public function __construct(
        private readonly string $serviceAccount,
        private readonly string $appPassword,
    ) {
    }

    public function getSaleschannelToken(): string
    {
        if ($this->saleschannelToken !== null && time() < $this->saleschannelTokenExpiresAt - 60) {
            return $this->saleschannelToken;
        }
        $json = $this->requestToken([
            'grant_type' => 'client_credentials',
            'client_id' => self::SALESCHANNEL_CLIENT_ID,
            'username' => $this->serviceAccount,
            'password' => $this->appPassword,
            'scope' => 'ofcp',
        ]);
        $this->saleschannelToken = $json['access_token'];
        $this->saleschannelTokenExpiresAt = time() + (int) $json['expires_in'];
        return $this->saleschannelToken;
    }

    /**
     * @param array $customer customerPayload (logged-in shopper: saleschannelCustomerID, saleschannelCustomerEmail,
     *                        optional customerGroup, customerCompany, customerTeams, filterTags; omit for a guest),
     *                        previousSaleschannelCustomerJwt (the token the browser held before), guestSessionTTL (days)
     */
    public function getCustomerToken(array $customer): string
    {
        $json = $this->requestToken([
            'grant_type' => 'client_credentials',
            'client_id' => self::CUSTOMER_CLIENT_ID,
            'client_assertion_type' => 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            'client_assertion' => $this->getSaleschannelToken(),
            'scope' => 'ofcp',
            // The cast keeps an empty guest description a JSON object: json_encode([]) is "[]", which is refused.
            'ofcp_customer' => json_encode((object) $customer, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES),
        ]);
        return $json['access_token'];
    }

    private function requestToken(array $form): array
    {
        $ch = curl_init(self::TOKEN_URL);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($form),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $body = curl_exec($ch);
        if ($body === false) {
            throw new RuntimeException('OFCP token request failed: ' . curl_error($ch));
        }
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        if ($status !== 200) {
            // Wrong credentials, an inactive saleschannel and a refused customer all answer 400 invalid_grant;
            // quote the request_id from this body to TECSAFE support.
            throw new RuntimeException("OFCP token request failed: $status $body");
        }
        $json = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
        if (empty($json['access_token']) || empty($json['expires_in'])) {
            throw new RuntimeException('OFCP token request failed: no access_token in the response');
        }
        return $json;
    }
}

// Usage:
//
//   $auth = new OfcpAuth(getenv('OFCP_SERVICE_ACCOUNT'), getenv('OFCP_SERVICE_ACCOUNT_TOKEN'));
//   $guest = $auth->getCustomerToken(['guestSessionTTL' => 7]);
//   $shopper = $auth->getCustomerToken([
//       'customerPayload' => ['saleschannelCustomerID' => '4711', 'saleschannelCustomerEmail' => 'max@example.com'],
//       'previousSaleschannelCustomerJwt' => $guest,
//   ]);
