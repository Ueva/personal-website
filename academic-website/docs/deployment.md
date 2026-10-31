# Deployment and caching

Build with `./build.ps1`, then deploy the complete `_site` directory to the
DigitalOcean web server. Development output is `_site_dev`; do not publish it.

## Cloudflare cache rule

Jekyll cannot set HTTP response headers. Configure the following in Cloudflare
under **Caching > Cache Rules** for `ueva.dev`. This works independently of the
web server running on the droplet; no unsupported `_headers` file is needed.

Create a rule named **Versioned website assets**, with this custom expression:

```text
(http.host eq "ueva.dev" and (
  starts_with(http.request.uri.path, "/assets/fonts/") or (
    starts_with(http.request.uri.path, "/assets/") and
    starts_with(http.request.uri.query, "v=")
  )
))
```

Set **Cache eligibility** to **Eligible for cache**, and **Browser TTL** to
**Override origin and use this TTL: 1 month (2592000 seconds)**. Leave Edge TTL
at its default (respect origin headers). Keep the standard cache key, including
query strings; do not use an Ignore Query String rule for these assets. Check
that another overlapping rule does not override these settings.

CSS, JavaScript, and homepage portrait URLs receive a new `?v=` value on each
build. Font filenames include their upstream version: when replacing a font,
use a new filename and update its CSS and preload references. Never overwrite
a font at a long-cached URL with different bytes. This rule excludes HTML,
PDFs, and unversioned images, allowing their existing cache policy to remain.

After deploying and enabling the rule, inspect a versioned asset's response
headers: `Cache-Control` should specify `max-age=2592000`. Revisit the page with
browser caching enabled to verify reuse, then run PageSpeed Insights again.
Do not infer a new PageSpeed score from local checks alone.

Cloudflare cache purges cannot clear visitors' browser caches. Change the asset
URL when its bytes change. Google Analytics and Cloudflare Web Analytics remain
enabled; their third-party payloads and cache headers are outside the site's
asset policy.

References:
- [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/)
- [Browser Cache TTL](https://developers.cloudflare.com/cache/how-to/edge-browser-cache-ttl/set-browser-ttl/)
