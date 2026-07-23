import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '../shared/config/config.service';

type GatewayTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
};

@Injectable()
export class TecsafeService {
  private readonly logger = new Logger(TecsafeService.name);
  private saleschannelToken: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: ConfigService) {}

  private async getSaleschannelToken(): Promise<string> {
    // Reuse the cached ~15-min saleschannel JWT until 60 s before expiry.
    if (
      this.saleschannelToken &&
      Date.now() < this.saleschannelToken.expiresAt - 60_000
    ) {
      return this.saleschannelToken.token;
    }
    const apiKey = this.config.OFCP_SALESCHANNEL_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OFCP_SALESCHANNEL_API_KEY is not configured',
      );
    }
    const res = await fetch(
      `${this.config.OFCP_GATEWAY_URL}/v1/auth/jwt/saleschannel`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ saleschannelApiKey: apiKey }),
      },
    );
    if (!res.ok) {
      this.logger.error(`Saleschannel login failed with status ${res.status}`);
      throw new ServiceUnavailableException(
        'TECSAFE saleschannel login failed',
      );
    }
    const json = (await res.json()) as GatewayTokenResponse;
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
    const saleschannelToken = await this.getSaleschannelToken();
    const body: Record<string, unknown> = {
      guestSessionTTL: this.config.GUEST_SESSION_TTL_DAYS,
    };
    // Forwarding the SDK's previous token lets TECSAFE merge guest assets
    // into the account on login and reset sessions cleanly on logout.
    if (oldToken) body.previousSaleschannelCustomerJwt = oldToken;
    if (user) {
      body.customerPayload = {
        saleschannelCustomerID: user.id,
        saleschannelCustomerEmail: user.email,
      };
    }
    const res = await fetch(
      `${this.config.OFCP_GATEWAY_URL}/v1/auth/jwt/saleschannel-customer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${saleschannelToken}`,
        },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      this.logger.error(
        `Customer token exchange failed with status ${res.status}`,
      );
      this.logger.error(`Response body: ${await res.text()}`);
      throw new ServiceUnavailableException(
        'TECSAFE customer token exchange failed',
      );
    }
    const json = (await res.json()) as GatewayTokenResponse;
    return json.access_token;
  }
}
