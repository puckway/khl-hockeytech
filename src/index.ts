import { IRequest, Router, error, json } from "itty-router";
import { z } from "zod";
import {
  getDailySchedule,
  getGamesPerDay,
  getSeasonList,
  getTeamRoster,
  getTeamsBySeason,
  modulekitResponse,
} from "./modulekit";
import { NumericBoolean } from "hockeytech";
import { getchEvent, getchLightPlayer } from "./cache";
import { State } from "khl-api-types";
import { getPlayerProfileBio } from "./players";

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
    person_id: z.number().int(), // To quote jonathas/hockeytech: ????
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
                type: z.string(),
              }),
              // L229
            ])
            .superRefine((data, ctx) => {
              if (data.view === "player") {
                const parsed = zModulekitPlayerViewSchema.safeParse(data);
                if (!parsed.success) parsed.error.issues.forEach(ctx.addIssue);
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

const getSite = (league: League, lang: string) =>
  `https://${
    // no locale options for whl
    league === "whl"
      ? "whl"
      : league === "mhl"
        ? // only russian and english for mhl
          lang === "en"
          ? "engmhl"
          : "mhl"
        : // ru, en, & cn for khl
          lang === "ru"
          ? "www"
          : lang
  }.khl.ru`;

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
                default:
                  break;
              }
              break;
            }
            default:
              break;
          }
        } catch (e) {
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
      `${getSite(league, lang)}/game/${event.outer_stage_id}/${event.khl_id}/${
        event.game_state_key === State.Finished ? "resume" : "preview"
      }/`,
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
      return json({ message: "No such player with that ID" }, { status: 404 });
    }
    return redirect(`${getSite(league, lang)}/players/${player.khl_id}`);
  })
  .all("*", () => error(404));

export default {
  fetch: (request: IRequest, ...args: [Env, ExecutionContext]) =>
    router
      .handle(request, ...args)
      .then(json)
      .catch(error),
};
