# khl-hockeytech

This is a proxy worker for the KHL (and its subleagues; WHL and MHL) that enables compatibility with HockeyTech consumer clients.

## Nitty Gritty & Usage

### Identifiers

Use `khl`, `mhl`, or `whl` as both your client code and key, depending on which league you would like to query.

### Locale

This service supports `en` and `ru` locales. If an unsupported locale is specified, `en` will be used instead.

### URL Construction

Assemble your URLs with the standard leaguestat/hockeytech hosts. Affix this value as a search parameter named `url` on the proxy base: `https://khl.shayy.workers.dev`.

### Example

Example use with the `hockeytech` package:

```ts
import HockeyTech from "hockeytech";

const client = new HockeyTech("khl", "khl", "en", "https://khl.shayy.workers.dev?url=");

const scorebar = await client.getScorebar(1, 1);
```

## Limits & Implementation Notes

The KHL API is quite slow, so in order to speed up requests, many common types of data are cached on KV. Here's a short rundown:

| Resource                      | Cache TTL                 |
|-------------------------------|---------------------------|
| Players/player details        | 3 days                    |
| Game schedule (no live games) | Time until start or 1 day |
| Game schedule (live games)    | 5 minutes                 |
| Game details/pxp (not live)   | Time until start or 1 day |
| Game details/pxp (live)       | 1 minute (minimum)        |
| Seasons                       | 1 week                    |
| Teams/team details            | 1 day                     |
| Standings                     | 1 hour                    |
