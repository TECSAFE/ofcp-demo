"! <p class="shorttext synchronized">OFCP token exchange for a shop backend</p>
"! NetWeaver 7.40 SP08+ / S/4HANA (cl_http_client, /UI2/CL_JSON).
"!
"! 1. Saleschannel token (15 min): the shop's service account + app password from the
"!    TECSAFE cockpit (Saleschannel -> Credentials). Cached per instance until shortly before expiry.
"! 2. Customer token (5 min): derived from the saleschannel token for one shopper or guest.
"!    Hand this one to the browser / TECSAFE widgets, never the saleschannel token.
"!
"! Prerequisites: the certificate chain of auth.tec-digital.de imported into the SSL client PSE
"! 'ANONYM' (STRUST), and an outbound proxy in SICF/SM59 settings if your system needs one.
"! Keep the service account credentials in a secure store (e.g. SSF / secure storage), not in code.
"!
"! Usage:
"!   DATA(lo_auth) = NEW zcl_ofcp_auth( iv_service_account = lv_account iv_app_password = lv_password ).
"!   DATA(lv_guest) = lo_auth->get_guest_token( iv_guest_session_ttl = 7 ).
"!   DATA(lv_shopper) = lo_auth->get_registered_customer_token(
"!                        iv_customer_id    = '4711'
"!                        iv_email          = 'max@example.com'
"!                        iv_previous_token = lv_guest ).
CLASS zcl_ofcp_auth DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    CONSTANTS c_token_url TYPE string VALUE 'https://auth.tec-digital.de/application/o/token/'.
    "! TODO: replace with the saleschannel client id shown in the cockpit next to your credentials.
    CONSTANTS c_saleschannel_client_id TYPE string VALUE 'TODO_SALESCHANNEL_CLIENT_ID'.
    "! TODO: replace with the customer client id shown in the cockpit next to your credentials.
    CONSTANTS c_customer_client_id TYPE string VALUE 'TODO_CUSTOMER_CLIENT_ID'.

    METHODS constructor
      IMPORTING iv_service_account TYPE string
                iv_app_password    TYPE string.

    METHODS get_saleschannel_token
      RETURNING VALUE(rv_token) TYPE string
      RAISING   zcx_ofcp_auth.

    "! Guest token; pass the browser's previous customer token to keep the guest session.
    METHODS get_guest_token
      IMPORTING iv_previous_token    TYPE string OPTIONAL
                iv_guest_session_ttl TYPE i DEFAULT 7
      RETURNING VALUE(rv_token)      TYPE string
      RAISING   zcx_ofcp_auth.

    "! Token of a logged-in shopper; the previous (guest) token merges the guest's data into the account.
    METHODS get_registered_customer_token
      IMPORTING iv_customer_id    TYPE string
                iv_email          TYPE string
                iv_previous_token TYPE string OPTIONAL
      RETURNING VALUE(rv_token)   TYPE string
      RAISING   zcx_ofcp_auth.

    "! Raw exchange: iv_ofcp_customer_json holds customerPayload (saleschannelCustomerID,
    "! saleschannelCustomerEmail, optional customerGroup, customerCompany, customerTeams, filterTags;
    "! omit for a guest), previousSaleschannelCustomerJwt and guestSessionTTL (days).
    METHODS get_customer_token
      IMPORTING iv_ofcp_customer_json TYPE string
      RETURNING VALUE(rv_token)       TYPE string
      RAISING   zcx_ofcp_auth.

  PRIVATE SECTION.
    TYPES:
      BEGIN OF ty_token_response,
        access_token TYPE string,
        expires_in   TYPE i,
      END OF ty_token_response.

    DATA mv_service_account TYPE string.
    DATA mv_app_password TYPE string.
    DATA mv_saleschannel_token TYPE string.
    DATA mv_refresh_after TYPE timestamp.

    METHODS request_token
      IMPORTING it_form            TYPE tihttpnvp
      RETURNING VALUE(rs_response) TYPE ty_token_response
      RAISING   zcx_ofcp_auth.

    CLASS-METHODS json_string
      IMPORTING iv_value       TYPE string
      RETURNING VALUE(rv_json) TYPE string.
ENDCLASS.


CLASS zcl_ofcp_auth IMPLEMENTATION.
  METHOD constructor.
    mv_service_account = iv_service_account.
    mv_app_password = iv_app_password.
  ENDMETHOD.


  METHOD get_saleschannel_token.
    DATA lv_now TYPE timestamp.
    GET TIME STAMP FIELD lv_now.
    IF mv_saleschannel_token IS NOT INITIAL AND lv_now < mv_refresh_after.
      rv_token = mv_saleschannel_token.
      RETURN.
    ENDIF.

    DATA(ls_response) = request_token( VALUE #(
      ( name = 'grant_type' value = 'client_credentials' )
      ( name = 'client_id'  value = c_saleschannel_client_id )
      ( name = 'username'   value = mv_service_account )
      ( name = 'password'   value = mv_app_password )
      ( name = 'scope'      value = 'ofcp' ) ) ).

    mv_saleschannel_token = ls_response-access_token.
    " Refresh 60 s before the token expires.
    mv_refresh_after = cl_abap_tstmp=>add( tstmp = lv_now
                                           secs  = ls_response-expires_in - 60 ).
    rv_token = mv_saleschannel_token.
  ENDMETHOD.


  METHOD get_guest_token.
    DATA(lv_json) = |\{"guestSessionTTL":{ iv_guest_session_ttl }|.
    IF iv_previous_token IS NOT INITIAL.
      lv_json = |{ lv_json },"previousSaleschannelCustomerJwt":{ json_string( iv_previous_token ) }|.
    ENDIF.
    rv_token = get_customer_token( |{ lv_json }\}| ).
  ENDMETHOD.


  METHOD get_registered_customer_token.
    DATA(lv_json) = |\{"customerPayload":\{"saleschannelCustomerID":{ json_string( iv_customer_id ) },|
                 && |"saleschannelCustomerEmail":{ json_string( iv_email ) }\}|.
    IF iv_previous_token IS NOT INITIAL.
      lv_json = |{ lv_json },"previousSaleschannelCustomerJwt":{ json_string( iv_previous_token ) }|.
    ENDIF.
    rv_token = get_customer_token( |{ lv_json }\}| ).
  ENDMETHOD.


  METHOD get_customer_token.
    DATA(lv_saleschannel_token) = get_saleschannel_token( ).
    DATA(ls_response) = request_token( VALUE #(
      ( name = 'grant_type'            value = 'client_credentials' )
      ( name = 'client_id'             value = c_customer_client_id )
      ( name = 'client_assertion_type' value = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer' )
      ( name = 'client_assertion'      value = lv_saleschannel_token )
      ( name = 'scope'                 value = 'ofcp' )
      ( name = 'ofcp_customer'         value = iv_ofcp_customer_json ) ) ).
    rv_token = ls_response-access_token.
  ENDMETHOD.


  METHOD request_token.
    DATA lo_client TYPE REF TO if_http_client.
    DATA lv_status TYPE i.
    DATA lv_message TYPE string.

    cl_http_client=>create_by_url(
      EXPORTING
        url                = c_token_url
        ssl_id             = 'ANONYM'
      IMPORTING
        client             = lo_client
      EXCEPTIONS
        argument_not_found = 1
        plugin_not_active  = 2
        internal_error     = 3
        OTHERS             = 4 ).
    IF sy-subrc <> 0.
      RAISE EXCEPTION TYPE zcx_ofcp_auth
        EXPORTING iv_text = |OFCP token request: cannot create HTTP client (sy-subrc { sy-subrc })|.
    ENDIF.

    lo_client->request->set_method( if_http_request=>co_request_method_post ).
    lo_client->request->set_content_type( 'application/x-www-form-urlencoded' ).
    " fields_to_string URL-encodes names and values (the customer JSON needs it).
    lo_client->request->set_cdata( cl_http_utility=>fields_to_string( fields = it_form ) ).

    lo_client->send(
      EXCEPTIONS
        http_communication_failure = 1
        http_invalid_state         = 2
        http_processing_failed     = 3
        http_invalid_timeout       = 4
        OTHERS                     = 5 ).
    IF sy-subrc = 0.
      lo_client->receive(
        EXCEPTIONS
          http_communication_failure = 1
          http_invalid_state         = 2
          http_processing_failed     = 3
          OTHERS                     = 4 ).
    ENDIF.
    IF sy-subrc <> 0.
      lo_client->get_last_error( IMPORTING message = lv_message ).
      lo_client->close( ).
      RAISE EXCEPTION TYPE zcx_ofcp_auth
        EXPORTING iv_text = |OFCP token request failed: { lv_message }|.
    ENDIF.

    lo_client->response->get_status( IMPORTING code = lv_status ).
    DATA(lv_body) = lo_client->response->get_cdata( ).
    lo_client->close( ).

    IF lv_status <> 200.
      " Wrong credentials, an inactive saleschannel and a refused customer all answer
      " 400 invalid_grant; quote the request_id from this body to TECSAFE support.
      RAISE EXCEPTION TYPE zcx_ofcp_auth
        EXPORTING iv_text = |OFCP token request failed: { lv_status } { lv_body }|.
    ENDIF.

    /ui2/cl_json=>deserialize( EXPORTING json = lv_body
                               CHANGING  data = rs_response ).
    IF rs_response-access_token IS INITIAL.
      RAISE EXCEPTION TYPE zcx_ofcp_auth
        EXPORTING iv_text = |OFCP token request: no access_token in { lv_body }|.
    ENDIF.
  ENDMETHOD.


  METHOD json_string.
    " Serializing a plain string yields a quoted, escaped JSON string literal.
    rv_json = /ui2/cl_json=>serialize( data = iv_value ).
  ENDMETHOD.
ENDCLASS.
