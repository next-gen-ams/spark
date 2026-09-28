# ADR 0004: Use a blank callback and interactive fallback for Microsoft sessions

**Date**: 2026-09-28
**Status**: Accepted
**Deciders**: Coco Hu and Codex

## Context

MSAL keeps the signed-in account across browser sessions, but expired access tokens still require renewal. The tracker previously used the full application page as the hidden silent-renewal callback; in Safari this could time out while the page loaded its router and authentication logic. After that timeout, the interface repeatedly ran the same silent request, so “Try workspace again” could not recover the session.

## Decision

MSAL remains the only owner of cached authentication artefacts. Silent renewal uses a registered, script-free `/emt-tracker/auth-silent.html` callback and retries a silent timeout once. When Microsoft requires interaction or a silent timeout repeats, the tracker offers a real `acquireTokenRedirect` recovery for the cached account; it uses `loginRedirect` only when no account is cached.

Ordinary network and workspace API failures remain workspace retries. They are not presented as Microsoft session expiry.

## Alternatives Considered

### Keep retrying the full application callback

- **Pros**: No new redirect URI is required.
- **Cons**: The hidden iframe loads the router and authentication effects again, which can manipulate the response or time out.
- **Why not**: It reproduces the Safari failure and leaves the retry button in a loop.

### Force a fresh Microsoft login on every visit

- **Pros**: Simple authentication state.
- **Cons**: Adds unnecessary sign-in friction and discards the SSO and refresh behaviour already managed by MSAL.
- **Why not**: EMT members should reauthenticate only when Microsoft policy requires interaction.

### Increase the iframe timeout only

- **Pros**: Small configuration change.
- **Cons**: Delays the error without removing the application logic from the hidden callback.
- **Why not**: It masks the cause and makes a failed restore feel slower.

## Consequences

### Positive

- Normal refreshes and later visits can reuse the MSAL cache without another prompt.
- Expired sessions have a deterministic, working recovery action.
- Raw MSAL timeout messages are replaced with a user-readable reconnect state.

### Negative

- The blank callback URI must remain registered in Entra and deployed with the site.
- Authentication error codes must be classified separately from backend failures.

### Risks

- If the blank callback is removed or its Entra registration drifts, silent renewal can fail again; production checks verify the live callback and bundle together.
- Interactive redirects can still require credentials or MFA under tenant policy; the tracker does not bypass or extend those policies.
