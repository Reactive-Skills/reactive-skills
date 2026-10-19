# Site analytics

reactive-skills.com counts page views with self-hosted [Umami](https://umami.is).
The site is a Next.js static export on GitHub Pages, so there is no analytics proxy.
Browsers load `https://umami-production-abb4.up.railway.app/script.js` directly and send page views to that host's `/api/send` endpoint.

`apps/site/src/lib/analytics.config.json` holds the host, public website id and exact tracked hostnames.
`apps/site/src/lib/analytics.js` derives the script URL from that configuration.
`apps/site/src/components/site/Analytics.jsx` renders one deferred tag in the root layout with `data-domains="reactive-skills.com"` and `data-do-not-track="true"`.
Localhost, previews and other hostnames do not send page views; browsers with Do Not Track still request the script but send no analytics data.

Only page views are enabled: no custom events, identify calls, performance tracking, recorder or heatmaps.
The live script was inspected before adding the privacy wording: it sets no cookies, writes no browser storage, reads the `umami.disabled` opt-out key, and defaults collection requests to `credentials: 'omit'`.
Page views include URLs (with query strings and fragments), referrer, title, hostname, screen size and language; Umami derives browser, device and approximate location information from requests.
Self-hosted data stays until deleted, as described in [Umami's FAQ](https://docs.umami.is/docs/faq).
Public disclosure lives at `/privacy/`; the site's separate theme preference uses browser storage.

Run `pnpm test:site` to check the rendered layout's script source, website id, hostname restriction and Do Not Track attribute without contacting Umami.
Run `NEXT_PUBLIC_ROOT_SITE=true pnpm --filter @reactive-skills/site build` to verify the static export.
When changing collectors, update the configuration, component, tests and privacy wording together.
To remove analytics, remove the component and its layout import, the configuration and helper, and the analytics test, then update `/privacy/` and this document.
