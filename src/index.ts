import { IRequest, Router, error, jpeg, json } from "itty-router";
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
import { getchEvent, getchLightPlayer, getchTeams } from "./cache";
import { APIStage, RESTGetAPICommonData, Routes, State } from "khl-api-types";
import {
  getPlayerCurrentSeasonStats,
  getPlayerGameByGame,
  getPlayerProfileBio,
  getPlayerSeasonStats,
  searchPlayers,
} from "./players";
import { allTeams, getTeam } from "./teams";
import { getLeagueSite } from "./league";
import empty_avatar from "./public/empty_avatar";
import { base64ToArrayBuffer } from "./public";
import { gameCenterResponse, getGameClock } from "./gamecenter";
import { request } from "./rest";

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
const zClientCode = z
  .enum(["khl", "mhl", "whl", "zhhl"])
  .transform((code) => (code === "zhhl" ? "whl" : code));
const zDateAsString = z
  .string()
  .refine((v) => !Number.isNaN(new Date(v)))
  .transform((v) => new Date(v));
const zIntAsString = z
  .string()
  .refine((v) => /^\d+$/.test(v))
  .transform(Number);
const zSeasonId = zIntAsString.or(z.literal("latest"));

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
                season_id: zSeasonId,
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
                season_id: zSeasonId,
              }),
              z.object({
                view: z.literal("schedule"),
                season_id: zSeasonId,
                team_id: zIntAsString.optional(),
              }),
              z.object({
                view: z.literal("standingtypes"),
                season_id: zSeasonId,
              }),
              z.object({
                view: z.literal("statviewtype"),
                season_id: zSeasonId,
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
                season_id: zSeasonId,
                return_amount: zIntAsString,
                qualified: z.enum(["all", "qualified"]),
                type: z.enum(["skaters", "goalies"]),
              }),
              z.object({
                view: z.literal("brackets"),
                season_id: zSeasonId,
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
    const { searchParams } = new URL(request.url);
    if (!searchParams.has("url")) {
      return redirect("https://github.com/puckway/khl-hockeytech");
    }

    const url = z
      .string()
      .refine((v) =>
        /^https:\/\/(?:lscluster\.hockeytech\.com|cluster\.leaguestat\.com)\/feed\/?\?/.test(
          v,
        ),
      )
      .transform((v) => new URL(v))
      .parse(searchParams.get("url"));

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
              const seasonId = await parseSeasonId(
                env,
                league,
                params.season_id,
              );
              const players = await getTeamRoster(
                env,
                league,
                lang,
                seasonId,
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
              const seasonId = await parseSeasonId(
                env,
                league,
                params.season_id,
              );
              const teams = await getTeamsBySeason(env, league, lang, seasonId);
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
              const seasonId = await parseSeasonId(
                env,
                league,
                params.season_id,
              );
              const schedule = await getSeasonSchedule(
                env,
                league,
                lang,
                seasonId,
                params.team_id,
              );
              return modulekitResponse(params, key, schedule);
            }
            case "searchplayers": {
              const results = await searchPlayers(
                env,
                league,
                lang,
                params.search_term,
              );
              return modulekitResponse(params, key, results);
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
        const key =
          params.tab.substring(0, 1).toUpperCase() + params.tab.substring(1);
        try {
          switch (params.tab) {
            case "clock": {
              const game = await getGameClock(
                env,
                league,
                lang,
                params.game_id,
              );
              return gameCenterResponse(params, key, game);
            }
            default:
              break;
          }
        } catch (e) {
          console.error(e);
          return new Response(JSON.stringify({ error: String(e) }), {
            status: 200,
            headers: {
              "Content-Type": "text/html; charset=UTF-8",
            },
          });
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
  .get("/:league/game-center/:id", async (req, env) => {
    const { league, id } = z
      .object({
        league: zClientCode,
        id: zIntAsString,
      })
      .parse(req.params);
    const { lang } = z
      .object({ lang: zLang })
      .parse(Object.fromEntries(new URL(req.url).searchParams.entries()));

    const event = await getchEvent(env, league, id);
    return redirect(
      `${getLeagueSite(league, lang)}/game/${event.outer_stage_id}/${
        event.khl_id
      }/${event.game_state_key === State.Finished ? "resume" : "preview"}/`,
    );
  })
  .get("/:league/player/:id", async (req, env) => {
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
    return redirect(`${getLeagueSite(league, lang)}/players/${player.khl_id}/`);
  })
  .get("/:league/team/:id", async (req) => {
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
  .get("/assets/:league/logos/:id.:extension?", async (req, env) => {
    const { league, id } = z
      .object({
        league: zClientCode,
        id: zIntAsString,
        extension: z.literal("png").optional(),
      })
      .parse(req.params);

    const localTeam = getTeam(league, id);
    if (!localTeam) return json({ message: "No such team" }, { status: 404 });

    const teams = await getchTeams(env, league);
    const team = teams.find((t) => t.id === id);
    if (!team) return json({ message: "No such team" }, { status: 404 });

    return redirect(team.image);
  })
  .get("/assets/:league/players/:id.:extension?", async (req, env) => {
    const { league, id } = z
      .object({
        league: zClientCode,
        id: zIntAsString,
        extension: z.enum(["jpg", "jpeg"]).optional(),
      })
      .parse(req.params);

    const player = await getchLightPlayer(env, league, id);
    if (!player) return json({ message: "No such player" }, { status: 404 });

    // These are reliably https://www.khl.ru/img/teamplayers_db/{???}/{khl_id}.jpg
    // I don't know what the first parameter is, but we
    // need to fetch the player for their khl_id anyway.
    return player.image
      ? redirect(player.image)
      : jpeg(base64ToArrayBuffer(empty_avatar));
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

type MinimalStage = Pick<APIStage, "id" | "khl_id" | "season">;

const parseSeasonId = async (
  env: Env,
  league: League,
  value: z.infer<typeof zSeasonId>,
): Promise<number> => {
  if (typeof value === "number") return value;

  const key = `${league}-latest-stage`;
  const cached = await env.KV.get<MinimalStage>(key, "json");
  if (cached) return cached.id;

  // This shouldn't happen most of the time
  const data = await request<RESTGetAPICommonData>(league, Routes.data(), {
    params: { locale: "en" },
  });
  const { id, khl_id, season } = data.stages_v2[0];
  await env.KV.put(key, JSON.stringify({ id, khl_id, season }));
  return id;
};

export default {
  fetch: (request: IRequest, ...args: [Env, ExecutionContext]) =>
    router
      .handle(request, ...args)
      .then(json)
      .catch(error),
  scheduled: async (_: ScheduledEvent, env: Env) => {
    for (const league of ["khl", "whl", "mhl"] as const) {
      const data = await request<RESTGetAPICommonData>(league, Routes.data(), {
        params: { locale: "en" },
      });
      const { id, khl_id, season } = data.stages_v2[0];
      await env.KV.put(
        `${league}-latest-stage`,
        JSON.stringify({ id, khl_id, season }),
      );
    }
  },
};
