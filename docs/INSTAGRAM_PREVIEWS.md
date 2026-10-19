# Instagram link previews

Instagram asks for a sign-in to show a post, so a server cannot read it as a web page. The suite looks up **one public post
or reel** through a lookup service instead, and shows the author, the caption and a picture. Nothing else is asked for or
kept: no comments, no profiles, no counts.

## Switches (environment variables)

| Variable | What it does |
|---|---|
| `APIFY_TOKEN` | Turns on the cloud provider (Apify). Create it in Apify under Settings, API and integrations. |
| `SOCIAL_ACTOR` | Which Apify actor to use. Default `apify/instagram-scraper`. |
| `META_APP_ID`, `META_APP_SECRET` | Turn on Meta's own oEmbed lookup, tried first when set. Needs a Meta developer app with oEmbed Read. |
| `SOCIAL_DAILY_CAP` | Most lookups that cost money per day. Default 60. |
| `SOCIAL_PROVIDER=off` | Turns every lookup off at once (the kill switch). |

With none of these set, nothing is looked up and Instagram links simply show no preview.

## Behaviour

- Only links to a single public post or reel (`/p/…`, `/reel/…`, `/tv/…`). Profiles, stories, hashtag pages and search pages are refused.
- Results are kept 30 days (table `mjengo_social_cache`), so the same link is paid for once. The picture is kept in our own
  storage and served at `/api/social-image/<id>` to signed-in people only, because Instagram's picture addresses expire.
- Private or removed posts show "That post is private, removed or not public."
- Before using a provider, make sure a data-processing agreement is in place with it.
