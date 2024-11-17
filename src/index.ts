import { IRequest, Router, error, json } from "itty-router";
import { z } from "zod";
import {
  getDailySchedule,
  getGamesPerDay,
  getScorebar,
  getSeasonList,
  getSeasonSchedule,
  getTeamRoster,
  getTeamsBySeason,
  modulekitResponse,
} from "./modulekit";
import { NumericBoolean, PlayerMedia } from "hockeytech";
import { getchEvent, getchLightPlayer } from "./cache";
import { State } from "khl-api-types";
import {
  getPlayerCurrentSeasonStats,
  getPlayerGameByGame,
  getPlayerProfileBio,
  getPlayerSeasonStats,
} from "./players";
import { allTeams } from "./teams";
import { getLeagueSite } from "./league";
import { M3uParser } from "m3u-parser-generator";

export interface Env {
  KV: KVNamespace;
}

export type Lang = "en" | "ru";

export type League = "khl" | "whl" | "mhl";

export const numBool = (value: boolean): NumericBoolean => (value ? "1" : "0");

const redirect = (location: string, init?: ResponseInit) =>
  new Response(undefined, {
    status: 302,
    ...init,
    headers: {
      Location: location,
      ...init?.headers,
    },
  });

const zLang = z
  .ostring()
  .default("en")
  .transform((v) => (!["en", "ru"].includes(v) ? "en" : v))
  .refine((v): v is Lang => true);
const zClientCode = z.enum(["khl", "mhl", "whl"]);
const zDateAsString = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v)))
  .transform((v) => new Date(v));
const zIntAsString = z
  .string()
  .refine((v) => /^\d+$/.test(v))
  .transform(Number);

const zModulekitPlayerViewSchema = z.discriminatedUnion("category", [
  z.object({
    view: z.literal("player"),
    // These do not use `zIntAsString` because this schema is only used after
    // the data has already been transformed by a prior schema.
    player_id: z.number().int(),
    category: z.literal("profile"),
  }),
  z.object({
    view: z.literal("player"),
    // One is required, this is enforced in a superRefine later
    person_id: z.number().int().optional(),
    player_id: z.number().int().optional(),
    category: z.literal("media"),
  }),
  z.object({
    view: z.literal("player"),
    player_id: z.number().int(),
    category: z.literal("seasonstats"),
  }),
  z.object({
    view: z.literal("player"),
    player_id: z.number().int(),
    category: z.literal("gamebygame"),
  }),
  z.object({
    view: z.literal("player"),
    player_id: z.number().int(),
    category: z.literal("mostrecentseasonstats"),
  }),
]);

export const zHockeyTechParams = z.intersection(
  z.object({
    fmt: z.literal("json"),
    key: z.string(),
    client_code: zClientCode,
  }),
  z
    .union([
      z
        .object({
          feed: z.literal("modulekit"),
          lang: zLang,
        })
        .and(
          z
            .discriminatedUnion("view", [
              z.object({
                view: z.literal("gamesbydate"),
                fetch_date: zDateAsString,
              }),
              z.object({
                view: z.literal("gamesperday"),
                start_date: zDateAsString,
                end_date: zDateAsString,
              }),
              z.object({
                view: z.literal("roster"),
                season_id: zIntAsString,
                team_id: zIntAsString,
              }),
              z.object({
                view: z.literal("scorebar"),
                numberofdaysahead: zIntAsString,
                numberofdaysback: zIntAsString,
              }),
              // This should be 5 separate union objects but it's not because of how discriminatedUnion works.
              z.object({
                view: z.literal("player"),
                /** Exactly one of player_id or person_id is available. They should be considered identical. */
                player_id: zIntAsString.optional(),
                /** Exactly one of player_id or person_id is available. They should be considered identical. */
                person_id: zIntAsString.optional(),
                category: z.enum([
                  "profile",
                  "media",
                  "seasonstats",
                  "gamebygame",
                  "mostrecentseasonstats",
                ]),
              }),
              z.object({
                view: z.literal("seasons"),
              }),
              z.object({
                view: z.literal("teamsbyseason"),
                season_id: zIntAsString,
              }),
              z.object({
                view: z.literal("schedule"),
                season_id: zIntAsString,
                team_id: zIntAsString.optional(),
              }),
              z.object({
                view: z.literal("standingtypes"),
                season_id: zIntAsString,
              }),
              z.object({
                view: z.literal("statviewtype"),
                season_id: zIntAsString,
                stat: z.string(),
                type: z.enum([
                  "standings",
                  "topscorers",
                  "topgoalies",
                  "skaters",
                  "goalies",
                  "streaks",
                  "transactions",
                ]),
                first: zIntAsString.optional(),
                limit: zIntAsString.optional(),
                sort: z.string().optional(),
                order_direction: z.string().optional(),
                qualified: z.enum(["all", "qualified"]).optional(),
              }),
              z.object({
                view: z.literal("combinedplayers"),
                season_id: zIntAsString,
                return_amount: zIntAsString,
                qualified: z.enum(["all", "qualified"]),
                type: z.enum(["skaters", "goalies"]),
              }),
              z.object({
                view: z.literal("brackets"),
                season_id: zIntAsString,
              }),
              z.object({
                view: z.literal("searchplayers"),
                search_term: z.string(),
              }),
            ])
            .superRefine((data, ctx) => {
              if (data.view === "player") {
                const parsed = zModulekitPlayerViewSchema.safeParse(data);
                if (!parsed.success) parsed.error.issues.forEach(ctx.addIssue);
                else if (parsed.data.category === "media") {
                  if (
                    parsed.data.player_id === undefined &&
                    parsed.data.person_id === undefined
                  ) {
                    ctx.addIssue({
                      code: z.ZodIssueCode.custom,
                      message:
                        "One of `player_id` or `person_id` is required for `player.media`",
                    });
                  }
                }
              }
            }),
        ),
      z.object({
        feed: z.literal("gc"),
        lang_code: zLang,
        game_id: zIntAsString,
        tab: z.enum(["preview", "pxpverbose", "clock", "gamesummary"]),
      }),
    ])
    .refine((v): v is typeof v & { [key: string]: string } => true),
);

export type HockeyTechParams = z.infer<typeof zHockeyTechParams>;

const router = Router<IRequest, [Env, ExecutionContext]>();

router
  .get("/", async (request, env) => {
    const url = z
      .string()
      .refine((v) =>
        /^https:\/\/(?:lscluster\.hockeytech\.com|cluster\.leaguestat\.com)\/feed\/?\?/.test(
          v,
        ),
      )
      .transform((v) => new URL(v))
      .parse(new URL(request.url).searchParams.get("url"));

    const params = zHockeyTechParams.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const { feed, client_code: league } = params;

    switch (feed) {
      case "modulekit": {
        const lang = params.lang;
        const key =
          params.view.substring(0, 1).toUpperCase() + params.view.substring(1);
        try {
          switch (params.view) {
            case "gamesbydate": {
              const games = await getDailySchedule(
                env,
                league,
                lang,
                params.fetch_date,
              );
              return modulekitResponse(params, key, games);
            }
            case "gamesperday": {
              const games = await getGamesPerDay(
                env,
                league,
                lang,
                params.start_date,
                params.end_date,
              );
              return modulekitResponse(params, key, games);
            }
            case "roster": {
              const players = await getTeamRoster(
                env,
                league,
                lang,
                params.season_id,
                params.team_id,
              );
              return modulekitResponse(params, key, players);
            }
            case "scorebar": {
              const scorebar = await getScorebar(
                env,
                league,
                lang,
                params.numberofdaysback,
                params.numberofdaysahead,
              );
              return modulekitResponse(params, key, scorebar);
            }
            case "seasons": {
              const seasons = await getSeasonList(env, league, lang);
              return modulekitResponse(params, key, seasons);
            }
            case "teamsbyseason": {
              const teams = await getTeamsBySeason(
                env,
                league,
                lang,
                params.season_id,
              );
              return modulekitResponse(params, key, teams);
            }
            case "player": {
              // biome-ignore lint/style/noNonNullAssertion: One is required, as enforced in the `discriminatedUnion` `superRefine`
              const playerId = (params.player_id ?? params.person_id)!;
              switch (params.category) {
                case "profile": {
                  const player = await getPlayerProfileBio(
                    env,
                    league,
                    lang,
                    playerId,
                  );
                  return modulekitResponse(params, key, player);
                }
                case "media": {
                  // const media = await getPlayerProfileMedia(
                  //   env,
                  //   league,
                  //   lang,
                  //   playerId,
                  //   new URL(request.url).origin,
                  // );
                  const media: PlayerMedia[] = [];
                  return modulekitResponse(params, key, media);
                }
                case "seasonstats": {
                  const stats = await getPlayerSeasonStats(
                    env,
                    league,
                    lang,
                    playerId,
                  );
                  return modulekitResponse(params, key, stats);
                }
                case "gamebygame": {
                  const stats = await getPlayerGameByGame(
                    env,
                    league,
                    lang,
                    playerId,
                  );
                  return modulekitResponse(params, key, stats);
                }
                case "mostrecentseasonstats": {
                  const stats = await getPlayerCurrentSeasonStats(
                    env,
                    league,
                    lang,
                    playerId,
                  );
                  return modulekitResponse(params, key, stats);
                }
                default:
                  break;
              }
              break;
            }
            case "schedule": {
              const schedule = await getSeasonSchedule(
                env,
                league,
                lang,
                params.season_id,
                params.team_id,
              );
              return modulekitResponse(params, key, schedule);
            }
            default:
              break;
          }
        } catch (e) {
          console.error(e);
          // I don't like this but this is how HT returns errors, complete with a 200 response.
          return modulekitResponse(params, key, { error: String(e) });
        }
        break;
      }
      case "gc": {
        const lang = params.lang_code;
        switch (params.tab) {
          default:
            break;
        }
        break;
      }
      default:
        break;
    }

    return null;
  })
  // .get("/m3u8", async (request, env) => {
  //   const { playlist: playlistUrl } = z
  //     .object({
  //       playlist: z
  //         .string()
  //         .url()
  //         .transform((url) => new URL(url))
  //         .refine(
  //           (url) =>
  //             ["bl.webcaster.pro"].includes(url.host) &&
  //             url.pathname.endsWith(".m3u8"),
  //         ),
  //     })
  //     .parse(Object.fromEntries(new URL(request.url).searchParams.entries()));

  //   const [, , , identifier] = playlistUrl.pathname.split("/");
  //   const filename = `${identifier}.mp4`;

  //   const response = await fetch(playlistUrl, {
  //     method: "GET",
  //     headers: {
  //       Origin: "https://api-video.khl.ru",
  //       Referer: "https://api-video.khl.ru/",
  //     },
  //   });
  //   if (!response.ok) {
  //     return json(
  //       { message: response.statusText, raw: await response.text() },
  //       { status: response.status },
  //     );
  //   }

  //   const playlist = M3uParser.parse(await response.text());

  //   // return new Response(body, {
  //   //   headers: {
  //   //     "Content-Type": "video/mp4",
  //   //     "Content-Disposition": `attachment; filename="${filename}"`,
  //   //   },
  //   // });
  // })
  .get("/game-center/:league/:seasonId/:id", async (req, env) => {
    const { league, seasonId, id } = z
      .object({
        league: zClientCode,
        seasonId: zIntAsString,
        id: zIntAsString,
      })
      .parse(req.params);
    const { lang } = z
      .object({ lang: zLang })
      .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));

    const event = await getchEvent(env, league, seasonId, id);
    return redirect(
      `${getLeagueSite(league, lang)}/game/${event.outer_stage_id}/${
        event.khl_id
      }/${event.game_state_key === State.Finished ? "resume" : "preview"}/`,
    );
  })
  .get("/player/:league/:id", async (req, env) => {
    const { league, id } = z
      .object({
        league: zClientCode,
        id: zIntAsString,
      })
      .parse(req.params);
    const { lang } = z
      .object({ lang: zLang })
      .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));

    const player = await getchLightPlayer(env, league, id, lang);
    if (!player) {
      return json({ message: "No such player" }, { status: 404 });
    }
    return redirect(`${getLeagueSite(league, lang)}/players/${player.khl_id}`);
  })
  .get("/team/:league/:id", async (req) => {
    const { league, id } = z
      .object({
        league: zClientCode,
        id: zIntAsString,
      })
      .parse(req.params);
    const { lang } = z
      .object({ lang: zLang })
      .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));

    const team = allTeams[league].find((t) => t.id === id);
    if (team) {
      return redirect(
        `${getLeagueSite(league, lang)}/${
          league === "khl" ? "clubs" : "teams"
        }/${team.slug ?? team.names.en.toLowerCase().replace(/ /g, "_")}/`,
      );
    }
    // I don't think there is a way to get the slug from any API endpoint,
    // so we have no choice but to bail out here
    return json({ message: "No such team" }, { status: 404 });
  })
  // .get("/game_reports/official-game-report.php", async (req) => {
  //   const { client_code, game_id } = z
  //     .object({
  //       client_code: z.string(),
  //       game_id: z.string(),
  //       // lang_id: z.string(),
  //     })
  //     .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));

  //   // https://www.khl.ru/pdf/1217/885951/game-885951-en.pdf
  // })
  .all("*", () => error(404));

export default {
  fetch: (request: IRequest, ...args: [Env, ExecutionContext]) =>
    router
      .handle(request, ...args)
      .then(json)
      .catch(error),
};
