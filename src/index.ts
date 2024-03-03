import { IRequest, Router, error, json } from "itty-router";
import { z } from "zod";
import {
  getDailySchedule,
  getGamesPerDay,
  modulekitResponse,
} from "./modulekit";
import { NumericBoolean } from "hockeytech";

export interface Env {
  KV: KVNamespace;
}

export type Lang = "en" | "ru";

export type League = "khl" | "whl" | "mhl";

export const numBool = (value: boolean): NumericBoolean => (value ? "1" : "0");

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
          z.discriminatedUnion("view", [
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
            // z.object({
            //   view: z.literal("player"),
            //   player_id: zIntAsString,
            //   category: z.literal("profile"),
            // }),
            // z.object({
            //   view: z.literal("player"),
            //   // To quote jonathas/hockeytech: ????
            //   person_id: zIntAsString,
            //   category: z.literal("media"),
            // }),
            // z.object({
            //   view: z.literal("player"),
            //   player_id: zIntAsString,
            //   category: z.literal("seasonstats"),
            // }),
            // z.object({
            //   view: z.literal("player"),
            //   player_id: zIntAsString,
            //   category: z.literal("gamebygame"),
            // }),
            // z.object({
            //   view: z.literal("player"),
            //   player_id: zIntAsString,
            //   category: z.literal("mostrecentseasonstats"),
            // }),
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
          ]),
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

const router = Router();

router
  .get("/", async (request: IRequest, env: Env, context: ExecutionContext) => {
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
        switch (params.view) {
          case "gamesbydate": {
            const games = await getDailySchedule(
              env,
              league,
              lang,
              params.fetch_date,
            );
            return modulekitResponse(params, "Gamesbydate", games);
          }
          case "gamesperday": {
            const games = await getGamesPerDay(
              env,
              league,
              lang,
              params.start_date,
              params.end_date,
            );
            return modulekitResponse(params, "Gamesperday", games);
          }
          default:
            break;
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
  .all("*", () => error(404));

export default {
  fetch: (request: IRequest, ...args: [Env, ExecutionContext]) =>
    router
      .handle(request, ...args)
      .then(json)
      .catch(error),
};
