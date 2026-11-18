# OFCP auth examples

These are copy-paste snippets that fetch OFCP tokens from Authentik (`https://auth.tec-digital.de/application/o/token/`) for a shop backend. Each one is self-contained and needs no third-party dependencies.

| Language | File | Needs |
| :--- | :--- | :--- |
| TypeScript | [`typescript/ofcp-auth.ts`](typescript/ofcp-auth.ts) | Node.js 18+ (global `fetch`) |
| PHP | [`php/ofcp-auth.php`](php/ofcp-auth.php) | PHP 8.0+, ext-curl, ext-json |
| Java | [`java/OfcpAuth.java`](java/OfcpAuth.java) | Java 11+ (`java.net.http`) |
| Go | [`go/ofcpauth.go`](go/ofcpauth.go) | Go 1.18+, standard library |
| ABAP | [`abap/zcl_ofcp_auth.clas.abap`](abap/zcl_ofcp_auth.clas.abap) + [`abap/zcx_ofcp_auth.clas.abap`](abap/zcx_ofcp_auth.clas.abap) | NetWeaver 7.40 SP08+ / S/4HANA; the auth.tec-digital.de certificate chain in the `ANONYM` SSL client PSE (STRUST) |

## Before you use them

1. In the TECSAFE cockpit, open your saleschannel and issue credentials under **Credentials**. You get a service account username (`sc-…`), its token (an app password) and two client ids.
2. Replace the two `TODO_…_CLIENT_ID` placeholders in the snippet with those client ids.
3. Load the username and token from your secret store or environment. Do not hardcode them, and never send them to a browser.

## The two tokens

1. **Saleschannel token (15 min).** This is a `client_credentials` grant at the saleschannel client id, sent with `username` = service account, `password` = token and `scope=ofcp`. The snippets cache it and fetch a new one 60 s before it expires.
2. **Customer token (5 min).** This is a `client_credentials` grant at the customer client id. It authenticates with the saleschannel token as `client_assertion` (`client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`). It describes the shopper as JSON in the `ofcp_customer` form field:

   ```json
   {
     "customerPayload": { "saleschannelCustomerID": "4711", "saleschannelCustomerEmail": "max@example.com" },
     "previousSaleschannelCustomerJwt": "<the customer token the browser held before>",
     "guestSessionTTL": 7
   }
   ```

   - Leave out `customerPayload` to get a guest token.
   - Send the previous customer token when there is one. This keeps a guest's session, and on login it merges the guest's data into the account.
   - `customerPayload` also accepts `customerGroup`, `customerCompany`, `customerTeams` and `filterTags`.

Pass only the customer token to the browser and the TECSAFE widgets.

## Errors

Authentik answers `400 invalid_grant` in all of these cases:

- wrong credentials
- a deactivated saleschannel
- a customer the platform refuses, such as a missing or invalid email

The response body carries a `request_id`. Quote it to TECSAFE support, who can look up the exact reason.

Credential rotation and deactivation take effect at the next token request. A token that was already issued stays valid until it expires.
