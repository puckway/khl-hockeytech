# khl-hockeytech

This is a drop-in proxy for the KHL, WHL, and MHL that enables compatibility with HockeyTech API consumers. [See usage instructions](#nitty-gritty--usage).

## Coverage (as represented by jonathas/hockeytech functions)

- [x] getDailySchedule
- [x] getGamesPerDay
- [x] getRoster
- [x] getScorebar
- [x] getPlayerProfileBio
- [x] getPlayerProfileMedia
  - This currently returns an empty list, but in the future it will return videos & images of game clips. <!-- - This returns "quotes" which are basically just clips/moments from games. For videos, `url` is an address on the worker's origin or a media server. Videos are always type `mp4` and images are always type `jpg`. -->
- [x] getPlayerProfileStatsBySeason
- [x] getPlayerProfileGameByGameStats
- [x] getPlayerProfileCurrentSeasonStats
- [x] getSeasonList
- [x] getTeamsBySeason
- [x] getSeasonSchedule
- [ ] getStandingTypes
- [ ] getStandings
- [ ] getLeadersSkaters
- [ ] getLeadersGoalies
- [ ] getTopSkaters
- [ ] getTopGoalies
- [ ] getSkatersByTeam
- [ ] getGoaliesByTeam
- [ ] getStreaks
- [ ] getTransactions
- [ ] getPlayoff
- [ ] searchPerson
- [ ] getGamePreview
- [ ] getGamePlayByPlay
- [ ] getGameClock
- [ ] getGameSummary

## Nitty Gritty & Usage

### Identifiers

Use `khl`, `mhl`, or `whl` as both your client code and key, depending on which league you would like to query. In case you find the client code `whl` to conflict in your application with the Western Hockey League, you can also use `zhhl` as an alias - `whl` will be returned in responses.

### Locale

This service supports `en` and `ru` locales. If an unsupported locale is specified, `en` will be used instead. Be aware that some values are only available in the `ru` locale.

The `Copyright.required_link` value in each response adapts to your provided client code and locale. For example, for a request to `khl` with the `ru` locale, you will see `https://www.khl.ru` here, but a request to `mhl` with the `en` locale will result in `https://engmhl.khl.ru` instead. You can use this value to construct static URLs that do not require custom IDs (see [IDs](#ids--user-facing-urls)). Unfortunately the WHL website is not available in non-Russian locales.

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

### IDs & User-Facing URLs

Models in the KHL API have two separate IDs which you can read about [here](https://github.com/shayypy/khl-api/blob/main/mobile-api.md#ids). For the purpose of using data *from* this API *with* this API, any given `id` property (`player.id`, `team.id`, etc) will be populated with the `id` of the native object, and *not* its `khl_id`. You may now be asking: how can I construct `khl.ru` URLs for my users?

#### `khl.ru` redirect routes

| Name             | Path                       |
|------------------|----------------------------|
| Game Center      | `/:league/game-center/:id` |
| Player           | `/:league/player/:id`      |
| Team<sup>1</sup> | `/:league/team/:id`        |

- <sup>1</sup>: You may instead consider shipping a list of teams with your application so that you already know the `khl_id` and name of every team (you can see our list [here](/src/teams.ts)).

#### Media redirect routes

| Name                        | Path                          |
|-----------------------------|-------------------------------|
| Team logo<sup>2</sup>       | `/assets/:league/logos/:id`   |
| Player headshot<sup>3</sup> | `/assets/:league/players/:id` |

- <sup>1</sup>: There is no guarantee that all images are returned in the requested format - these endpoints just blindly return the URL provided by the league.
- <sup>2</sup>: If a file extension is needed, `.png`<sup>1</sup> can be used.
- <sup>3</sup>: If a file extension is needed, `.jpg`/`.jpeg`<sup>1</sup> can be used.

### Caveats (bad data)

Be aware that some values will be empty strings or use placeholder data that may not accurately reflect real state due to limited data availability. This should not create incompatibility with Hockeytech clients, but you may want to create special exceptions when handling these leagues to avoid passing off placeholders as real data.

### Speed

The KHL API can be quite slow, so in order to speed up requests, some common types of data are cached on KV. Here's a brief rundown:

| Resource                                  | Cache TTL                 |
|-------------------------------------------|---------------------------|
| Players/player details                    | 3 days                    |
| Game schedule<sup>1</sup> (no live games) | Time until start or 1 day |
| Game schedule<sup>1</sup> (live games)    | 10 minutes                |
| Game details/pxp (not live)               | Time until start or 1 day |
| Game details/pxp (live)                   | 1 minute (minimum)        |
| Seasons                                   | 1 week                    |
| Teams                                     | 1 week                    |
| Standings                                 | 1 hour                    |

<sup>1</sup>: This endpoint (`getSeasonSchedule`) takes a *very* long time uncached (40+ seconds!). You should consider caching results locally if live game details are not top priority for you.
