// OFCP token exchange for a shop backend (Node.js 18+, no dependencies).
//
// 1. Saleschannel token (15 min): the shop's service account + app password from the
//    TECSAFE cockpit (Saleschannel → Credentials). Cached per instance and reused until shortly before expiry.
// 2. Customer token (5 min): derived from the saleschannel token for one shopper or guest.
//    Hand this one to the browser / TECSAFE widgets, never the saleschannel token.
//
// Keep the service account credentials server-side (env, secret store); never ship them to a browser.

const TOKEN_URL = 'https://auth.tec-digital.de/application/o/token/';
// TODO: replace with the saleschannel client id shown in the cockpit next to your credentials.
const SALESCHANNEL_CLIENT_ID = 'TODO_SALESCHANNEL_CLIENT_ID';
// TODO: replace with the customer client id shown in the cockpit next to your credentials.
const CUSTOMER_CLIENT_ID = 'TODO_CUSTOMER_CLIENT_ID';

/** Body of the customer exchange; send `customerPayload` for a logged-in shopper, omit it for a guest. */
export interface OfcpCustomer {
  customerPayload?: {
    saleschannelCustomerID: string;
    saleschannelCustomerEmail: string;
    customerGroup?: string | null;
    customerCompany?: string | null;
    customerTeams?: string[];
    filterTags?: { key: string; value: string }[];
  };
  /** The customer token the browser held before (keeps the guest session, merges guest data on login). */
  previousSaleschannelCustomerJwt?: string;
  /** Lifetime of a guest session in days. */
  guestSessionTTL?: number;
}

/** One instance per saleschannel (service account); the cached saleschannel token belongs to it. */
export class OfcpAuth {
  private readonly serviceAccount: string;
  private readonly appPassword: string;
  private saleschannelToken: { token: string; expiresAt: number } | null = null;

  constructor(serviceAccount: string, appPassword: string) {
    this.serviceAccount = serviceAccount;
    this.appPassword = appPassword;
  }

  async getSaleschannelToken(): Promise<string> {
    if (this.saleschannelToken && Date.now() < this.saleschannelToken.expiresAt - 60_000) {
      return this.saleschannelToken.token;
    }
    const json = await requestToken({
      grant_type: 'client_credentials',
      client_id: SALESCHANNEL_CLIENT_ID,
      username: this.serviceAccount,
      password: this.appPassword,
      scope: 'ofcp',
    });
    this.saleschannelToken = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
    return json.access_token;
  }

  async getCustomerToken(customer: OfcpCustomer): Promise<string> {
    const json = await requestToken({
      grant_type: 'client_credentials',
      client_id: CUSTOMER_CLIENT_ID,
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: await this.getSaleschannelToken(),
      scope: 'ofcp',
      ofcp_customer: JSON.stringify(customer),
    });
    return json.access_token;
  }
}

async function requestToken(form: Record<string, string>): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    // Wrong credentials, an inactive saleschannel and a refused customer all answer 400 invalid_grant;
    // quote the request_id from this body to TECSAFE support.
    throw new Error(`OFCP token request failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token || !json.expires_in) {
    throw new Error('OFCP token request failed: no access_token in the response');
  }
  return json as { access_token: string; expires_in: number };
}

// Usage:
//
//   const auth = new OfcpAuth(process.env.OFCP_SERVICE_ACCOUNT!, process.env.OFCP_SERVICE_ACCOUNT_TOKEN!);
//   const guest = await auth.getCustomerToken({ guestSessionTTL: 7 });
//   const shopper = await auth.getCustomerToken({
//     customerPayload: { saleschannelCustomerID: '4711', saleschannelCustomerEmail: 'max@example.com' },
//     previousSaleschannelCustomerJwt: guest,
//   });
