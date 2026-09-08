# Support dashboard and client cabinet access

Support signs in at `/admin/login` with an individual Strapi **Users & Permissions** account whose role type is `support`. This is the custom website dashboard at `/admin/dashboard`; it is separate from Strapi's own CMS administrator accounts.

## Permissions

The role is reconciled by `strapi/src/utils/support-role.js` on backend startup:

- `find` and `findOne` for every application content type, plus user/role/media reads.
- `create` and `update` for machine, currency, preset, language, translation, translation entry, translation set, voice clip, product, product line and tutorial.
- Machine cells and preset cells have create/update permission because they are part of those editors. Media uploads are allowed for images/audio. Machine free mode and preset application are allowed.
- No deletion, account/role administration, client account changes, promotion creation, device-credential writes, or physical door-key issuance.

Existing admin currency, preset and localization editors remain available. Products/product lines use the client cabinet editors. The role also permits the listed content operations directly through Strapi's content API; this change does not add new CMS screens to the custom dashboard.

## Frontend configuration

Set `ADMIN_SESSION_SECRET` to at least 32 random characters, for example the output of `openssl rand -base64 48`. Keep it server-side, stable across restarts and identical across frontend instances. Rotating it signs out every support session. During migration, an existing `ADMIN_PASSWORD` is accepted only as this encryption-key fallback; it is never accepted as a login credential. Optionally set `APP_ORIGIN` to the canonical frontend origin; otherwise mutation Origin checks compare against the request Host.

`ADMIN_PASSWORD` no longer authenticates either the dashboard or a client cabinet. Existing shared-password cookies are rejected. The frontend still needs its existing Strapi service credentials for client-scoped reads.

## Creating another support user

In Strapi's CMS, open Content Manager → User (Users & Permissions), create a local user, set a unique username/email and a strong password, select **Support**, enable **Confirmed**, and leave **Blocked** off. Do not give Support to an existing customer account.

Alternatively, from the backend project directory, pass a JSON object with `username`, `email`, and `password` to `node scripts/create-support-user.js` on stdin. Passwords must be at least 16 characters. The script refuses an existing username/email and never resets accounts. Keep credential files outside Git and restrict them to the owner.

## Opening a client cabinet

Click the machine name in the dashboard table. A POST endpoint derives the client and active client user from the machine; the browser supplies only the machine ID. A machine must be assigned to a client with an enabled cabinet and an active client login.

The frontend issues a separate encrypted, HttpOnly support cookie for at most 30 minutes, capped by the 8-hour support login. No reusable password or credential is included in a URL or page props. The support cookie is tied to the exact support login. Every request rechecks the support user, role, blocked state, account update timestamp, target client user, and the selected machine's client assignment. Expired access returns to the dashboard. **Exit to dashboard** clears cabinet access while preserving the support login. A pre-existing normal client cookie is not replaced when opening a support cabinet.

The client cabinet keeps its client ownership checks. Support mutations additionally run with the support user's own Strapi JWT and an explicit content-operation allowlist. They never retry with service credentials. Support cannot use cabinet access to update the client's credentials or perform operations beyond the support role. Removing translation overrides or preset rows counts as deletion and is refused before changes are made.

Support sign-ins, cabinet entry/exit and dashboard/cabinet mutation attempts/results are stored in the **Support audit** collection with actor, session, target IDs, path/method and HTTP status. Passwords, JWTs and submitted form data are not recorded. Mutation attempts and cabinet entry require the audit store to be available. Block/delete a support user, change their role, or update their password/account to invalidate their existing support sessions.

## Validation and deployment

Run `npm test`, `npx tsc --noEmit`, and `npm run build` in `front`; run `npm test` in `strapi`. Browser verification covers sign-in, machine-click entry, visible support identity, exit and logout. API integration covers permitted machine edits, forbidden operations, and cross-origin rejection.

Deploy the backend support role, Support audit API and bootstrap hook before the frontend. Configure the frontend session secret before deploying the updated frontend. The test account is `artur.support`; its password is supplied privately, never committed. The existing client account `artur` is preserved.
