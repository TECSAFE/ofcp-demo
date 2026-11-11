import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '../shared/config/config.service';

/** Authentik's token endpoint answer (RFC 6749 §5.1). */
type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

const CLIENT_ASSERTION_TYPE_JWT =
  'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

/** Without a bound, an unanswering Authentik would hold the shopper's request for minutes. */
const TOKEN_REQUEST_TIMEOUT_MS = 15_000;

type Credentials = {
  tokenUrl: string;
  serviceAccount: string;
  serviceAccountToken: string;
  saleschannelClientId: string;
  customerClientId: string;
};

/**
 * OFCP's two-step token exchange, both steps against Authentik's token endpoint
 * (the api-gateway is never called for a credential; Authentik calls it back
 * while issuing, which is where a customer can be refused):
 *
 * 1. Saleschannel token (15 min): `client_credentials` with the shop's service
 *    account username + app password at the saleschannel client id.
 * 2. Customer token (5 min): `client_credentials` at the customer client id,
 *    authenticated by the saleschannel token as `client_assertion`, carrying the
 *    shopper (or guest) description as the `ofcp_customer` form field.
 */
@Injectable()
export class TecsafeService {
  private readonly logger = new Logger(TecsafeService.name);
  private saleschannelToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private credentials(): Credentials {
    const values = {
      tokenUrl: this.config.OFCP_TOKEN_URL,
      serviceAccount: this.config.OFCP_SERVICE_ACCOUNT,
      serviceAccountToken: this.config.OFCP_SERVICE_ACCOUNT_TOKEN,
      saleschannelClientId: this.config.OFCP_SALESCHANNEL_CLIENT_ID,
      customerClientId: this.config.OFCP_CUSTOMER_CLIENT_ID,
    };
    for (const [key, value] of Object.entries(values)) {
      if (!value) {
        throw new ServiceUnavailableException(
          `OFCP credentials are not configured (${key} missing)`,
        );
      }
    }
    return values as Credentials;
  }

  /**
   * `refusalIsClientError`: for the customer exchange a 4xx is the gateway refusing
   * this shopper (vetoes read as 400 invalid_grant) and is passed on as 400; for the
   * saleschannel login a 4xx means the shop's own credentials are wrong, which the
   * shopper cannot fix, so it stays 503 like an outage.
   */
  private async requestToken(
    tokenUrl: string,
    form: Record<string, string>,
    what: string,
    refusalIsClientError: boolean,
  ): Promise<TokenResponse> {
    let res: Response;
    try {
      res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(form).toString(),
        signal: AbortSignal.timeout(TOKEN_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`${what} failed: ${(err as Error).message}`);
      throw new ServiceUnavailableException(`TECSAFE ${what} failed`);
    }
    if (!res.ok) {
      // The api-gateway log has the reason of a refusal, correlated by
      // Authentik's request_id in this body.
      this.logger.error(
        `${what} failed with status ${res.status}: ${await res.text()}`,
      );
      if (refusalIsClientError && res.status >= 400 && res.status < 500) {
        throw new BadRequestException(`TECSAFE refused the ${what}`);
      }
      throw new ServiceUnavailableException(`TECSAFE ${what} failed`);
    }
    return (await res.json()) as TokenResponse;
  }

  private async getSaleschannelToken(creds: Credentials): Promise<string> {
    // Reuse the cached ~15-min saleschannel token until 60 s before expiry.
    if (
      this.saleschannelToken &&
      Date.now() < this.saleschannelToken.expiresAt - 60_000
    ) {
      return this.saleschannelToken.token;
    }
    const json = await this.requestToken(
      creds.tokenUrl,
      {
        grant_type: 'client_credentials',
        client_id: creds.saleschannelClientId,
        username: creds.serviceAccount,
        password: creds.serviceAccountToken,
        scope: 'ofcp',
      },
      'saleschannel login',
      false,
    );
    this.saleschannelToken = {
      token: json.access_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
    return json.access_token;
  }

  async exchangeCustomerToken(
    oldToken: string | undefined,
    user: { id: string; email: string } | null,
  ): Promise<string> {
    const creds = this.credentials();
    const saleschannelToken = await this.getSaleschannelToken(creds);
    const customer: Record<string, unknown> = {
      guestSessionTTL: this.config.GUEST_SESSION_TTL_DAYS,
    };
    // Forwarding the SDK's previous token lets TECSAFE merge guest assets
    // into the account on login and reset sessions cleanly on logout.
    if (oldToken) customer.previousSaleschannelCustomerJwt = oldToken;
    if (user) {
      customer.customerPayload = {
        saleschannelCustomerID: user.id,
        saleschannelCustomerEmail: user.email,
      };
    }
    const json = await this.requestToken(
      creds.tokenUrl,
      {
        grant_type: 'client_credentials',
        client_id: creds.customerClientId,
        client_assertion_type: CLIENT_ASSERTION_TYPE_JWT,
        client_assertion: saleschannelToken,
        scope: 'ofcp',
        ofcp_customer: JSON.stringify(customer),
      },
      'customer token exchange',
      true,
    );
    return json.access_token;
  }
}
