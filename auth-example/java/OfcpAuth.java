// OFCP token exchange for a shop backend (Java 11+, no dependencies).
//
// 1. Saleschannel token (15 min): the shop's service account + app password from the
//    TECSAFE cockpit (Saleschannel → Credentials). Cached and reused until shortly before expiry.
// 2. Customer token (5 min): derived from the saleschannel token for one shopper or guest.
//    Hand this one to the browser / TECSAFE widgets, never the saleschannel token.
//
// Keep the service account credentials server-side (env, secret store); never ship them to a browser.
// The JSON handling below is minimal to stay dependency-free; swap in Jackson/Gson if you have one.

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class OfcpAuth {
    private static final String TOKEN_URL = "https://auth.tec-digital.de/application/o/token/";
    // TODO: replace with the saleschannel client id shown in the cockpit next to your credentials.
    private static final String SALESCHANNEL_CLIENT_ID = "TODO_SALESCHANNEL_CLIENT_ID";
    // TODO: replace with the customer client id shown in the cockpit next to your credentials.
    private static final String CUSTOMER_CLIENT_ID = "TODO_CUSTOMER_CLIENT_ID";

    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
    private final String serviceAccount;
    private final String appPassword;
    private String saleschannelToken;
    private Instant saleschannelTokenExpiresAt = Instant.EPOCH;

    public OfcpAuth(String serviceAccount, String appPassword) {
        this.serviceAccount = serviceAccount;
        this.appPassword = appPassword;
    }

    public synchronized String getSaleschannelToken() throws IOException, InterruptedException {
        if (saleschannelToken != null && Instant.now().isBefore(saleschannelTokenExpiresAt.minusSeconds(60))) {
            return saleschannelToken;
        }
        Map<String, String> form = new LinkedHashMap<>();
        form.put("grant_type", "client_credentials");
        form.put("client_id", SALESCHANNEL_CLIENT_ID);
        form.put("username", serviceAccount);
        form.put("password", appPassword);
        form.put("scope", "ofcp");
        String body = requestToken(form);
        saleschannelToken = jsonString(body, "access_token");
        saleschannelTokenExpiresAt = Instant.now().plusSeconds(Long.parseLong(jsonNumber(body, "expires_in")));
        return saleschannelToken;
    }

    /** Customer token for a guest; pass the browser's previous customer token (or null) to keep the session. */
    public String getGuestToken(String previousCustomerToken, int guestSessionTtlDays)
            throws IOException, InterruptedException {
        StringBuilder json = new StringBuilder("{\"guestSessionTTL\":").append(guestSessionTtlDays);
        if (previousCustomerToken != null) {
            json.append(",\"previousSaleschannelCustomerJwt\":").append(quote(previousCustomerToken));
        }
        return getCustomerToken(json.append('}').toString());
    }

    /** Customer token for a logged-in shopper; the previous (guest) token merges the guest's data into the account. */
    public String getRegisteredCustomerToken(String customerId, String email, String previousCustomerToken)
            throws IOException, InterruptedException {
        StringBuilder json = new StringBuilder("{\"customerPayload\":{\"saleschannelCustomerID\":")
                .append(quote(customerId))
                .append(",\"saleschannelCustomerEmail\":").append(quote(email)).append('}');
        if (previousCustomerToken != null) {
            json.append(",\"previousSaleschannelCustomerJwt\":").append(quote(previousCustomerToken));
        }
        return getCustomerToken(json.append('}').toString());
    }

    /**
     * Raw exchange: {@code ofcpCustomerJson} holds customerPayload (saleschannelCustomerID, saleschannelCustomerEmail,
     * optional customerGroup, customerCompany, customerTeams, filterTags; omit for a guest),
     * previousSaleschannelCustomerJwt and guestSessionTTL (days).
     */
    public String getCustomerToken(String ofcpCustomerJson) throws IOException, InterruptedException {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("grant_type", "client_credentials");
        form.put("client_id", CUSTOMER_CLIENT_ID);
        form.put("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
        form.put("client_assertion", getSaleschannelToken());
        form.put("scope", "ofcp");
        form.put("ofcp_customer", ofcpCustomerJson);
        return jsonString(requestToken(form), "access_token");
    }

    private String requestToken(Map<String, String> form) throws IOException, InterruptedException {
        String encoded = form.entrySet().stream()
                .map(e -> URLEncoder.encode(e.getKey(), StandardCharsets.UTF_8) + "="
                        + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
        HttpRequest request = HttpRequest.newBuilder(URI.create(TOKEN_URL))
                .timeout(Duration.ofSeconds(15))
                .header("Content-Type", "application/x-www-form-urlencoded")
                .POST(HttpRequest.BodyPublishers.ofString(encoded))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            // Wrong credentials, an inactive saleschannel and a refused customer all answer 400 invalid_grant;
            // quote the request_id from this body to TECSAFE support.
            throw new IOException("OFCP token request failed: " + response.statusCode() + " " + response.body());
        }
        return response.body();
    }

    private static String jsonString(String json, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        if (!m.find()) throw new IllegalStateException("missing " + key + " in token response");
        return m.group(1);
    }

    private static String jsonNumber(String json, String key) {
        Matcher m = Pattern.compile("\"" + key + "\"\\s*:\\s*(\\d+)").matcher(json);
        if (!m.find()) throw new IllegalStateException("missing " + key + " in token response");
        return m.group(1);
    }

    private static String quote(String value) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : value.toCharArray()) {
            switch (c) {
                case '"': sb.append("\\\""); break;
                case '\\': sb.append("\\\\"); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.append('"').toString();
    }

    // Usage:
    //
    //   OfcpAuth auth = new OfcpAuth(System.getenv("OFCP_SERVICE_ACCOUNT"), System.getenv("OFCP_SERVICE_ACCOUNT_TOKEN"));
    //   String guest = auth.getGuestToken(null, 7);
    //   String shopper = auth.getRegisteredCustomerToken("4711", "max@example.com", guest);
}
