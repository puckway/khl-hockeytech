# khl-hockeytech

This is a proxy worker for the KHL (and its subleagues; WHL and MHL) that enables compatibility with HockeyTech consumers.

## Coverage (as represented by jonathas/hockeytech functions)

- [x] getDailySchedule
- [x] getGamesPerDay
- [x] getRoster
- [x] getScorebar
- [x] getPlayerProfileBio
- [x] getPlayerProfileMedia
- [ ] getPlayerProfileStatsBySeason
- [ ] getPlayerProfileGameByGameStats
- [ ] getPlayerProfileCurrentSeasonStats
- [x] getSeasonList
- [x] getTeamsBySeason
- [ ] getSeasonSchedule
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

### IDs & User-Facing URLs

Models in the KHL API have two separate IDs which you can read about [here](https://github.com/shayypy/khl-api/blob/main/mobile-api.md#ids). For the purpose of using data *from* this API *with* this API, any given `id` property (`player.id`, `team.id`, etc) will be populated with the `id` of the native object, and *not* its `khl_id`. You may now be asking: how can I construct `khl.ru` URLs for my users?

Consider one of the following approaches:

- **A:** Ship a list of teams with the application so that you already know the `khl_id` and names of every team (you can see our list [here](/src/teams.ts)).
- **B:** Use the following redirect paths. These are accessible on the proxy base mentioned above.

| Name        | Path                                  |
|-------------|---------------------------------------|
| Game Center | `/game-center/:league/:season_id/:id` |
| Player      | `/player/:league/:id`                 |
| Team        | `/team/:league/:id`                   |

### Caveats (bad data)

Be aware that some values will be empty strings or use placeholder data that may not accurately reflect real state due to limited data availability. This should not create incompatibility with Hockeytech clients, but you may want to create special exceptions when handling these leagues to avoid passing off placeholders as real data.

### Speed

The KHL API can be quite slow, so in order to speed up requests, some common types of data are cached on KV. Here's a brief rundown:

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
