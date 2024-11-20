import type { GamesByDate, HomeOrVisitor } from "hockeytech";
import {
  numBool,
  type Env,
  type HockeyTechParams,
  type Lang,
  type League,
} from ".";
import { getchEvent } from "./cache";
import {
  emptyKeys,
  getEventStatuses,
  getEventTicketsUrl,
  getPeriods,
} from "./modulekit";
import { State } from "khl-api-types";
import { getTeam } from "./teams";

export const gameCenterResponse = <K extends string, T>(
  params: HockeyTechParams,
  key: K,
  data: T,
) => {
  return {
    GC: {
      Parameters: {
        lang_id: 1,
        league_id: "0",
        league_code: params.client_code,
        ...params,
      },
      [key]: data,
    },
  };
};

export const getGameClock = async (
  env: Env,
  league: League,
  locale: Lang,
  gameId: number,
): Promise<GameClock> => {
  const event = await getchEvent(env, league, gameId, locale);
  const statuses = getEventStatuses(event);
  // biome-ignore format:
  const empty = emptyKeys("text_game_summary", "official_game_report", "home_audio_url", "home_video_url", "home_webcast_url", "visiting_audio_url", "visiting_video_url", "visiting_webcast_url", "home_lineup_card", "visiting_lineup_card", "game_lineups");

  const scoring = { home: {}, visiting: {} } as GameClock["scoring"];
  const getPeriodGoals = (period: number, teamId: number) =>
    event.goals.filter(
      (goal) => goal.period === period && goal.author.team_id === teamId,
    ).length;
  for (const period of ["1", "2", "3", "4", "5"] as const) {
    const homeGoals = getPeriodGoals(Number(period), event.team_a.id);
    const awayGoals = getPeriodGoals(Number(period), event.team_b.id);
    if (Number(period) < 4 || homeGoals !== 0) {
      scoring.home[period] = String(homeGoals);
    }
    if (Number(period) < 4 || awayGoals !== 0) {
      scoring.visiting[period] = String(awayGoals);
    }
  }

  return {
    ...empty,
    period: statuses.Period,
    game_clock: "00:00:00",
    game_date_iso_8601: new Date(event.start_at).toISOString(),
    timezone: "Europe/Moscow",
    timezone_short: "MSK",
    started: numBool(event.game_state_key !== State.Soon),
    game_number: "0",
    season_id: String(event.stage_id ?? ""),
    season_name: event.stage_name,
    home_team: {
      name: event.team_a.name,
      team_id: String(event.team_a.id),
      team_code: getTeam(league, event.team_a.id)?.abbreviations[locale] ?? "",
      team_nickname: event.team_a.name,
      team_city: event.team_a.location,
    },
    visiting_team: {
      name: event.team_b.name,
      team_id: String(event.team_b.id),
      team_code: getTeam(league, event.team_b.id)?.abbreviations[locale] ?? "",
      team_nickname: event.team_b.name,
      team_city: event.team_b.location,
    },
    tickets_url: getEventTicketsUrl(league, locale, event) ?? "",
    venue: event.arena.name,
    final: numBool(event.game_state_key === State.Finished),
    status: statuses.GameStatus,
    home_goal_count: String(
      event.goals.filter((g) => g.author.team_id === event.team_a.id).length,
    ),
    visiting_goal_count: String(
      event.goals.filter((g) => g.author.team_id === event.team_b.id).length,
    ),
    progress: statuses.GameStatusStringLong,
    progress_short: statuses.GameStatusString,
    period_name: statuses.PeriodNameLong,
    scoring,
    shots_on_goal: {
      // TODO: distribute team.shots intelligently across periods (somehow)
      home: { "1": 0, "2": 0, "3": 0 },
      visiting: { "1": 0, "2": 0, "3": 0 },
    },
    power_play: {
      total: {
        home: String(event.team_a.ppc),
        visiting: String(event.team_a.ppc),
      },
      goals: {
        home: String(event.team_a.ppg),
        visiting: String(event.team_a.ppg),
      },
    },
    updated: {
      clock: 0,
      meta: 0,
      lineup: 0,
      goals: event.goals.length,
      penalties: 0,
      penaltyshots: 0,
      shots: 0,
      hits: 0,
      faceoffs: 0,
      pxp: 0,
      shootouts: 0,
      h2h: 0,
      pxpverbose: 0,
    },
  } satisfies GameClock;
};

type GameTeam = Pick<HomeOrVisitor, "name" | "team_id" | "team_code"> & {
  team_city: string;
  team_nickname: string;
};

interface Scoring {
  "1": string;
  "2": string;
  "3": string;
  [key: `${number}`]: string | undefined;
}

type GameClock = Pick<
  GamesByDate,
  | "period"
  | "game_clock"
  | "timezone"
  | "started"
  | "game_number"
  | "season_id"
  | "home_audio_url"
  | "home_video_url"
  | "home_webcast_url"
  | "visiting_audio_url"
  | "visiting_video_url"
  | "visiting_webcast_url"
  | "tickets_url"
  | "venue"
  | "final"
  | "status"
  | "home_goal_count"
  | "visiting_goal_count"
> & {
  game_date_iso_8601: string;
  timezone_short: string;
  season_name: string;
  home_team: GameTeam;
  visiting_team: GameTeam;
  text_game_summary: string;
  official_game_report: string;
  progress: string;
  progress_short: string;
  period_name: string;
  home_lineup_card: string;
  visiting_lineup_card: string;
  game_lineups: string;
  updated: {
    clock: number;
    meta: number;
    lineup: number;
    goals: number;
    penalties: number;
    penaltyshots: number;
    shots: number;
    hits: number;
    faceoffs: number;
    pxp: number;
    shootouts: number;
    h2h: number;
    pxpverbose: number;
  };
  scoring: {
    home: Scoring;
    visiting: Scoring;
  };
  shots_on_goal: {
    home: Record<string, number>;
    visiting: Record<string, number>;
  };
  power_play: {
    total: { home: string; visiting: string };
    goals: { home: string; visiting: string };
  };
};
