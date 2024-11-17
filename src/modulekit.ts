import {
  APIEvent,
  APIMinimalEvent,
  APITeamWithDivision,
  RESTGetAPICommonData,
  RESTGetAPIEvents,
  RESTGetAPIPlayers,
  RESTGetAPITeam,
  RESTGetAPITeams,
  Role,
  Routes,
  StageType,
  State,
} from "khl-api-types";
import { Env, HockeyTechParams, Lang, League, numBool } from ".";
import { request } from "./rest";
import {
  GameStatus,
  Period,
  Periods,
  GamesByDate,
  GamesPerDay,
  RosterPlayer,
  Season,
  TeamsBySeason,
  ScorebarMatch,
  Schedule,
} from "hockeytech";
import { allTeams, getTeam } from "./teams";
import { doPlayerConversions } from "./players";
import { getLeagueSite, leagueNames } from "./league";

export const modulekitResponse = <K extends string, T>(
  params: HockeyTechParams,
  key: K,
  data: T,
) => {
  return {
    SiteKit: {
      Parameters: {
        lang_id: 1,
        league_id: "0",
        league_code: params.client_code,
        ...params,
      },
      [key]: data,
      Copyright: {
        required_copyright:
          "Official statistics provided by Kontinental Hockey League",
        required_link: getLeagueSite(params.client_code, params.lang ?? "ru"),
        powered_by: "Powered by khl-hockeytech, based on HockeyTech.com",
        powered_by_url: "https://github.com/shayypy/khl-hockeytech",
      },
    },
  };
};

export const emptyKeys = <T extends string>(...keys: T[]) =>
  Object.fromEntries(keys.map((key) => [key, ""])) as Record<T, "">;

export const stateToStatus = (state: State): GameStatus =>
  state === State.Soon
    ? GameStatus.NotStarted
    : state === State.InProgress
      ? GameStatus.InProgress
      : GameStatus.Final;

export const stateToStatusString = (state: State): string =>
  state === State.Soon
    ? "Not started"
    : state === State.InProgress
      ? "In progress"
      : "Final";

export const getPeriods = (until: number): Periods => {
  const allPeriods: Period[] = [
    {
      id: "1",
      length: "1200",
      long_name: "1st Period",
      mandatory: "1",
      short_name: "1st",
    },
    {
      id: "2",
      length: "1200",
      long_name: "2nd Period",
      mandatory: "1",
      short_name: "2nd",
    },
    {
      id: "3",
      length: "1200",
      long_name: "3rd Period",
      mandatory: "1",
      short_name: "3rd",
    },
    {
      id: "4",
      length: "300",
      long_name: "OT Period",
      mandatory: "0",
      short_name: "OT",
    },
    {
      id: "5",
      length: "0",
      long_name: "SO Period",
      mandatory: "0",
      short_name: "SO",
    },
  ];
  return Object.fromEntries(
    allPeriods
      .slice(0, until === -1 ? 3 : until)
      .map((period) => [Number(period.id), period]),
  ) as unknown as Periods;
};

type PartialScorebarMatchStatuses = Pick<
  ScorebarMatch,
  | "ScheduledTime"
  | "ScheduledFormattedTime"
  | "GameStatus"
  | "GameStatusString"
  | "GameStatusStringLong"
  | "Period"
  | "PeriodNameLong"
  | "PeriodNameShort"
>;

export const getEventStatuses = (
  event: Pick<APIEvent, "start_at" | "period" | "scores" | "game_state_key">,
): PartialScorebarMatchStatuses => {
  const d = new Date(event.start_at);
  const data = {
    GameStatus: stateToStatus(event.game_state_key),
    GameStatusString: "",
    GameStatusStringLong: "",
    ScheduledTime: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "Europe/Moscow",
    }),
    ScheduledFormattedTime: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/Moscow",
    }),

    Period: "",
    PeriodNameLong: "",
    PeriodNameShort: "",
  } satisfies PartialScorebarMatchStatuses;

  if (event.game_state_key === State.Finished) {
    data.GameStatusString = "Final";
    if (event.scores.bullitt !== null) {
      data.GameStatusStringLong = "Final SO";
    } else if (event.scores.overtime !== null) {
      data.GameStatusStringLong = "Final OT";
    } else {
      data.GameStatusStringLong = "Final";
    }
  } else if (event.game_state_key === State.Soon) {
    data.GameStatusString = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "Europe/Moscow",
    });
    data.GameStatusStringLong = `${data.ScheduledFormattedTime} MSK`;
  }

  const periods = [
    { Period: "1", PeriodNameShort: "1", PeriodNameLong: "1st" },
    { Period: "2", PeriodNameShort: "2", PeriodNameLong: "2nd" },
    { Period: "3", PeriodNameShort: "3", PeriodNameLong: "3rd" },
    { Period: "4", PeriodNameShort: "OT", PeriodNameLong: "OT" },
    { Period: "5", PeriodNameShort: "SO", PeriodNameLong: "SO" },
  ];
  let period: (typeof periods)[number] | undefined;
  if (event.period === null) period = periods[0];
  if (event.period === -1) {
    period =
      periods[
        Object.keys(event.scores).indexOf(
          Object.keys(event.scores).find(
            (key) => event.scores[key as keyof typeof event.scores] !== null,
          ) ?? "third_period",
        )
      ];
  }
  if (period) {
    Object.assign(data, period);
  }

  return data;
};

export const getDailySchedule = async (
  env: Env,
  league: League,
  locale: Lang,
  date: Date,
): Promise<GamesByDate[]> => {
  const lastSecond = new Date(date);
  lastSecond.setUTCHours(23, 59, 59, 0);

  const games = await request<RESTGetAPIEvents>(league, Routes.events(), {
    params: {
      locale,
      "q[start_at_lt_time_from_unixtime]": Math.ceil(
        lastSecond.getTime() / 1000,
      ),
      "q[start_at_gt_time_from_unixtime]": Math.ceil(date.getTime() / 1000),
      order_direction: "desc",
    },
  });
  const now = new Date();
  // biome-ignore format:
  const empty = emptyKeys("attendance", "capacity", "featured_player_id", "game_letter", "visiting_team_notes", "visiting_video_url", "visiting_video_url_fr", "visiting_webcast_url", "visiting_webcast_url_fr", "home_assistant_coach1", "home_assistant_coach2", "home_audio_url", "home_audio_url_fr", "home_coach", "home_manager", "home_team_notes", "home_video_url", "home_video_url_fr", "home_webcast_url", "home_webcast_url_fr", "imported_id", "intermission", "league_game_notes", "mvp1", "mvp2", "mvp3", "private_notes", "public_notes", "quick_score", "schedule_notes", "schedule_notes_fr", "tickets_url", "tickets_url_fr", "type_id", "venue", "visiting_assistant_coach1", "visiting_assistant_coach2", "visiting_audio_url", "visiting_audio_url_fr", "visiting_coach", "visiting_manager")
  return games.map(({ event }) => {
    const d = new Date(event.event_start_at);
    const home = getTeam(league, event.team_a.id);
    const away = getTeam(league, event.team_b.id);
    const statuses = getEventStatuses(event);
    return {
      date_played: d.toISOString().split("T")[0],
      date_played_fmt: d.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      end_time: event.end_at
        ? new Date(event.end_at).toLocaleTimeString(locale, {
            hour: "numeric",
            minute: "2-digit",
          })
        : "",
      final: numBool(event.game_state_key === State.Finished),
      forfeit: "0",
      game_clock: "0:00",
      game_id: String(event.id),
      // This is something that the KHL provides but I'm not sure where at the moment
      game_number: "0",
      game_status: statuses.GameStatusStringLong,
      goal_list: [],
      goal_summary: [],
      home_goal_count: event.score.split(":")[0],
      home_power_play_goals: "0",
      home_power_play_opportunities: "0",
      home_power_plays: "0",
      home_shots: "0",
      home_stats: {
        wins: "0",
        losses: "0",
        ties: "0",
        ot_wins: "0",
        ot_losses: "0",
        shootout_wins: "0",
        shootout_losses: "0",
        points: "0",
        use_shootouts: "1",
        record: "0-0-0-0",
      },
      home_team: String(event.team_a.id),
      home_team_city: event.team_a.location,
      home_team_code: home?.abbreviations[locale] ?? "",
      home_team_goals_by_period: {
        1: event.scores.first_period?.split(":")[0] ?? "0",
        2: event.scores.second_period?.split(":")[0] ?? "0",
        3: event.scores.third_period?.split(":")[0] ?? "0",
        4: event.scores.overtime?.split(":")[0] ?? "0",
        5: event.scores.bullitt?.split(":")[0] ?? "0",
      },
      home_team_name: event.team_a.name,
      home_team_nickname: home?.names[locale] ?? event.team_a.name,
      id: String(event.id),
      if_necessary: "0",
      last_modified: (d > now ? now : d).toISOString().replace("T", " "),
      league_id: "0",
      location: event.location ?? "",
      pending_final: "0",
      period: String(event.period ?? 0),
      periods: getPeriods(event.period ?? 0),
      playoff: numBool(event.not_regular ?? false),
      // playoff: numBool(
      //   (event.stage_name?.includes("Playoff") ||
      //     event.stage_name?.includes("Плей-офф")) ??
      //     false,
      // ),
      schedule_time: statuses.ScheduledTime,
      season_id: String(event.stage_id),
      shootout:
        event.period && event.period !== -1 ? numBool(event.period > 4) : "0",
      shootout_first_shooter_home: "0",
      start_time: d.toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
      started: numBool(event.game_state_key === State.InProgress),
      status: statuses.GameStatus,
      timezone: "Europe/Moscow",
      venue_location: event.location ?? "",
      visiting_goal_count: event.score.split(":")[1],
      visiting_power_play_goals: "0",
      visiting_power_play_opportunities: "0",
      visiting_power_plays: "0",
      visiting_shots: "0",
      visiting_stats: {
        wins: "0",
        losses: "0",
        ties: "0",
        ot_wins: "0",
        ot_losses: "0",
        shootout_wins: "0",
        shootout_losses: "0",
        points: "0",
        use_shootouts: "1",
        record: "0-0-0-0",
      },
      visiting_team: String(event.team_b.id),
      visiting_team_city: event.team_b.location,
      visiting_team_code: away?.abbreviations[locale] ?? "",
      visiting_team_goals_by_period: {
        1: event.scores.first_period?.split(":")[1] ?? "0",
        2: event.scores.second_period?.split(":")[1] ?? "0",
        3: event.scores.third_period?.split(":")[1] ?? "0",
        4: event.scores.overtime?.split(":")[1] ?? "0",
        5: event.scores.bullitt?.split(":")[1] ?? "0",
      },
      visiting_team_name: event.team_b.name,
      visiting_team_nickname: away?.names[locale] ?? event.team_b.name,
      ...empty,
    };
  });
};

export const getGamesPerDay = async (
  env: Env,
  league: League,
  locale: Lang,
  startDate: Date,
  endDate: Date,
): Promise<GamesPerDay[]> => {
  // This wasn't really working like I had expected.
  // It returns a list of timestamps, but they're not strictly game start
  // times, just days that one or more games starts on. This would be useful,
  // but we need a count of games on that day too.
  // const timestamps = await request<number[]>(
  //   league,
  //   Routes.eventsAllocation(),
  //   {
  //     params: {
  //       locale,
  //       "q[start_at_gt_time_from_unixtime]": Math.ceil(
  //         startDate.getTime() / 1000,
  //       ),
  //       "q[start_at_lt_time_from_unixtime]": Math.ceil(
  //         endDate.getTime() / 1000,
  //       ),
  //     },
  //   },
  // );
  const events = await request<RESTGetAPIEvents>(league, Routes.events(), {
    params: {
      locale,
      "q[start_at_gt_time_from_unixtime]": Math.ceil(
        startDate.getTime() / 1000,
      ),
      "q[start_at_lt_time_from_unixtime]": Math.ceil(endDate.getTime() / 1000),
    },
  });

  const dates = events.map(({ event }) => {
    const d = new Date(event.start_at);
    return {
      date_played: d.toISOString().split("T")[0],
      month: String(d.getUTCMonth() + 1),
      year: String(d.getUTCFullYear()),
      dayofweek: d.toLocaleString(locale, { weekday: "long" }),
      day: String(d.getUTCDate()),
      numberofgames: "1",
    } satisfies GamesPerDay;
  });

  return dates
    .filter((d, i, a) => {
      // Remove duplicates
      const found = a.find((dd) => dd.date_played === d.date_played);
      return found && a.indexOf(found) === i;
    })
    .map((date) => {
      // Count from the unfiltered whole
      const count = dates.filter(
        (d) => d.date_played === date.date_played,
      ).length;
      return {
        ...date,
        numberofgames: String(count),
      };
    });
};

// It would be cool to use the actual khl.ru scorebar here but I
// don't think there is a proper API for it, and would require
// scraping. Instead we can just re-implement `gamesperday` with
// different types.
export const getScorebar = async (
  env: Env,
  league: League,
  locale: Lang,
  daysBack: number,
  daysAhead: number,
): Promise<ScorebarMatch[]> => {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysBack * 86_400_000);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(now.getTime() + daysAhead * 86_400_000);
  endDate.setHours(23, 59, 59, 0);

  const events = await request<RESTGetAPIEvents>(league, Routes.events(), {
    params: {
      locale,
      "q[start_at_gt_time_from_unixtime]": Math.ceil(
        startDate.getTime() / 1000,
      ),
      "q[start_at_lt_time_from_unixtime]": Math.ceil(endDate.getTime() / 1000),
    },
  });
  if (events.length === 0) return [];
  events.sort(({ event: a }, { event: b }) => a.start_at - b.start_at);

  const tables = await request<RESTGetAPITables>(league, Routes.tables(), {
    params: {
      locale,
      // `stage_id` does not seem to actually do anything for this endpoint
      stage_id: events[0].event.stage_id ?? undefined,
    },
  });

  // biome-ignore format:
  const empty = emptyKeys("game_letter", "game_type", "HomeAudioUrl", "HomeVideoUrl", "HomeWebcastUrl", "VisitorAudioUrl", "VisitorVideoUrl", "VisitorWebcastUrl");
  const games = events.map(({ event }) => {
    const d = new Date(event.start_at);

    // Compile season stats for `HomeWins` (etc) keys
    // It could be argued that this should be done outside of the loop, and I
    // almost did it that way, but I kept it like this so that it would be
    // cross-stage in case the response contains multiple stages. This could
    // definitely be accommodated for but for now this is fine.
    const records = {
      home: {
        goals: 0,
        wins: 0,
        regulationLosses: 0,
        overtimeLosses: 0,
        shootoutLosses: 0,
      },
      away: {
        goals: 0,
        wins: 0,
        regulationLosses: 0,
        overtimeLosses: 0,
        shootoutLosses: 0,
      },
    };
    for (const table of tables) {
      const stage = table.stages.find((s) => s.id === event.stage_id);
      if (stage) {
        switch (stage.type) {
          case StageType.Regular: {
            const homeStats = stage.regular.find(
              (stat) => stat.id === event.team_a.id,
            );
            if (homeStats) {
              records.home = {
                goals: Number(homeStats.gf),
                wins:
                  Number(homeStats.w) +
                  Number(homeStats.otw || "0") +
                  Number(homeStats.sow || "0"),
                regulationLosses: Number(homeStats.l),
                overtimeLosses: Number(homeStats.otl || "0"),
                shootoutLosses: Number(homeStats.sol || "0"),
              };
            }
            const awayStats = stage.regular.find(
              (stat) => stat.id === event.team_b.id,
            );
            if (awayStats) {
              records.away = {
                goals: Number(awayStats.gf),
                wins:
                  Number(awayStats.w) +
                  Number(awayStats.otw || "0") +
                  Number(awayStats.sow || "0"),
                regulationLosses: Number(awayStats.l),
                overtimeLosses: Number(awayStats.otl || "0"),
                shootoutLosses: Number(awayStats.sol || "0"),
              };
            }
            break;
          }
          case StageType.Playoff: {
            const pairs = stage.playoff
              .flatMap((level) => level.pairs)
              .filter(
                (pair) =>
                  pair.team_a.id === event.team_a.id ||
                  pair.team_a.id === event.team_b.id ||
                  pair.team_b.id === event.team_a.id ||
                  pair.team_b.id === event.team_b.id,
              );
            if (pairs.length === 0) break;

            for (const { team_a: a, team_b: b, games } of pairs) {
              const aKey = a.id === event.team_a.id ? "home" : "away";
              const bKey = b.id === event.team_b.id ? "away" : "home";
              for (const game of games) {
                const lossKey =
                  game.ots === "OT" ? "overtimeLosses" : "regulationLosses";
                const [aGoals, bGoals] = game.score.split(":").map(Number);
                // We assume the game is over since there's no way to tell
                // unless this endpoint does not populate unfinished games
                if (aGoals > bGoals) {
                  records[aKey].wins += 1;
                  records[bKey][lossKey] += 1;
                } else if (bGoals > aGoals) {
                  records[bKey].wins += 1;
                  records[aKey][lossKey] += 1;
                }
                records[aKey].goals += aGoals;
                records[bKey].goals += bGoals;
              }
            }
            break;
          }
          default:
            break;
        }
        break;
      }
    }

    return {
      ...empty,
      ...getEventStatuses(event),
      ID: String(event.id),
      SeasonID: String(event.stage_id ?? ""),
      Date: d.toISOString().split("T")[0],
      league_name: leagueNames[league].names[locale],
      league_code: league,
      game_number: "0",
      quick_score: "0",
      GameDate: d.toLocaleString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      GameDateISO8601: d.toISOString(),
      // This is probably not right
      Ord: d.toISOString().replace("T", " "),
      Timezone: "Europe/Moscow",
      TimezoneShort: "MSK",
      GameClock: "00:00",
      GameSummaryUrl: String(event.khl_id),
      HomeCity: event.team_a.location,
      HomeCode:
        allTeams[league].find((t) => t.id === event.team_a.id)?.abbreviations[
          locale
        ] ?? "",
      HomeGoals: String(records.home.goals),
      HomeID: String(event.team_a.id),
      HomeNickname: event.team_a.name,
      HomeLogo: event.team_a.image,
      HomeLongName: `${event.team_a.location} ${event.team_a.name}`,
      HomeOTLosses: String(records.home.overtimeLosses),
      HomeRegulationLosses: String(records.home.regulationLosses),
      HomeShootoutLosses: String(records.home.shootoutLosses),
      HomeWins: String(records.home.wins),
      VisitorCity: event.team_b.location,
      VisitorCode:
        allTeams[league].find((t) => t.id === event.team_b.id)?.abbreviations[
          locale
        ] ?? "",
      VisitorGoals: String(records.away.goals),
      VisitorID: String(event.team_b.id),
      VisitorNickname: event.team_b.name,
      VisitorLogo: event.team_b.image,
      VisitorLongName: `${event.team_b.location} ${event.team_b.name}`,
      VisitorOTLosses: String(records.away.overtimeLosses),
      VisitorRegulationLosses: String(records.away.regulationLosses),
      VisitorShootoutLosses: String(records.away.shootoutLosses),
      VisitorWins: String(records.away.wins),
      TicketUrl:
        // It seems like the other leagues don't have online ticket sales
        league === "khl"
          ? `${getLeagueSite(league, locale)}/tickets/${d.getUTCMonth() + 1}/${
              event.team_a.khl_id
            }/`
          : "",
      Intermission: "0",
      venue_location: "",
      venue_name: "",
    } satisfies ScorebarMatch;
  });

  return games;
};

export const roleKeyToPosition = (key: Role) =>
  key === Role.Forward ? "F" : key === Role.Defenseman ? "D" : "G";

export const roleKeyToPositionId = (key: Role) =>
  key === Role.Forward ? "8" : key === Role.Defenseman ? "1" : "7";

export const getTeamRoster = async (
  env: Env,
  league: League,
  locale: Lang,
  seasonId: number,
  teamId: number,
): Promise<RosterPlayer[]> => {
  const data = await request<RESTGetAPIPlayers>(league, Routes.players(), {
    params: {
      locale,
      stage_id: seasonId,
    },
  });
  const { team } = await request<RESTGetAPITeam>(league, Routes.team(), {
    params: {
      locale,
      stage_id: seasonId,
      id: teamId,
    },
  });

  return team.players.map((player) => {
    // biome-ignore format:
    const empty = emptyKeys("phonetic_name", "display_name", "hometown", "homeprov", "homeplace", "birthtown", "birthprov", "birthplace", "birthcntry", "height_hyphenated", "veteran_description", "nhlteam", "draft_status");

    const dplayer = data.find(({ player: p }) => p.id === player.id)?.player;
    const converted = doPlayerConversions({ ...player, ...dplayer });
    return {
      ...empty,
      id: String(player.id),
      person_id: String(player.id),
      active: "1",
      shoots: dplayer?.stick?.toUpperCase() ?? "",
      homecntry: player.country,
      h: converted.height,
      w: converted.weight,
      hidden: "0",
      current_team: String(team.id),
      player_id: String(player.id),
      playerId: String(player.id),
      status: "None",
      birthdate_year: dplayer?.birthday
        ? `'${new Date(dplayer?.birthday * 1000).toLocaleString(locale, {
            year: "2-digit",
          })}`
        : "",
      rawbirthdate: converted.birthdate,
      latest_team_id: String(team.id),
      veteran_status: "0",
      team_name: team.name,
      division: team.division ?? "",
      tp_jersey_number: player.shirt_number ? String(player.shirt_number) : "",
      position_id: roleKeyToPositionId(player.role_key),
      position: roleKeyToPosition(player.role_key),
      isRookie: converted.rookie,
      draftinfo: [],
      player_image: player.image ?? "",
      ...converted,
    };
  });
};

interface APITableStageRegularStats {
  id: number;
  /** Relative path on an unknown origin */
  tv_image: string;
  khl_id: number;
  gp: string;
  w: string;
  otw: string;
  sow: string;
  sol: string;
  otl: string;
  l: string;
  pts: string;
  pts_pct: string;
  gf: string;
  ga: string;
  /** Absolute URL */
  image: string;
  name: string;
  location: string;
  division: string;
  division_key: string;
  conference: string;
  conference_key: string;
}

enum PlayoffLevel {
  Quarterfinal = 3,
  Semifinal = 2,
  ConferenceFinal = 1,
  Final = 0,

  // Aliases - do we want "third" and "fourth" since they
  // aren't used in nhl convention?
  FirstRound = 3,
  SecondRound = 2,
  // ThirdRound = 1,
  // FourthRound = 0,
}

type PlayoffPairTeam = Pick<
  APITeamWithDivision,
  "id" | "khl_id" | "name" | "image" | "conference_key"
> & {
  tv_image: string;
  pos: number;
};

interface APITableStagePlayoffStats {
  level: PlayoffLevel;
  title: string;
  pairs: {
    games: {
      /** `a goals`:`b goals` */
      score: string;
      /**
       * Which team is the visitor. If `0`, team A is visiting. If `1`, team B is visiting.
       */
      visitor: 0 | 1;
      event_id: number;
      ots: "OT" | null;
    }[];
    /**
     * Which team won the bracket. If `0`, team A won. If `1`, team B won.
     * This correlates to whichever team has the higher value in `score`.
     */
    winner: 0 | 1;
    /** games won by A, games won by B */
    score: [number, number];
    teams: [PlayoffPairTeam, PlayoffPairTeam];
    team_a: PlayoffPairTeam;
    team_b: PlayoffPairTeam;
  }[];
}

interface APITableStageBase {
  id: number;
  title: string;
  type: StageType;
  regular: APITableStageRegularStats[] | null;
  playin: null;
  playoff: APITableStagePlayoffStats[] | null;
  display_rule: string;
}

interface APITableStageRegular extends APITableStageBase {
  type: StageType.Regular;
  regular: APITableStageRegularStats[];
  playoff: null;
}

interface APITableStagePlayoff extends APITableStageBase {
  type: StageType.Playoff;
  regular: null;
  playoff: APITableStagePlayoffStats[];
}

type APITableStage = APITableStageRegular | APITableStagePlayoff;

export type RESTGetAPITables = {
  season: string;
  stages: APITableStage[];
}[];

export const getSeasonList = async (
  env: Env,
  league: League,
  locale: Lang,
): Promise<Season[]> => {
  const data = await request<RESTGetAPICommonData>(league, Routes.data(), {
    params: { locale },
  });
  const stages = data.stages_v2;
  const seasons: Season[] = [];
  for (const stage of stages) {
    const [startYear, endYear] = stage.season.split("/").map(Number);
    seasons.push({
      season_id: String(stage.id),
      season_name: `${stage.season} ${stage.title}`,
      shortname: stage.season,
      playoff: numBool(stage.type === StageType.Playoff),
      career: "1",
      // This data isn't provided by the KHL so we just manufacture plausible
      // container dates that can be used to vaguely sort stages chronologically
      // ---
      // A regular stage runs through Jul 1 - Feb 24. A playoff stage goes from
      // Feb 25 - Jun 30. This is intentionally imprecise, and covers the entire
      // calendar year.
      start_date: (stage.type === StageType.Playoff
        ? new Date(endYear, 1, 25)
        : new Date(startYear, 6, 1)
      )
        .toISOString()
        .split("T")[0],
      end_date: (stage.type === StageType.Playoff
        ? new Date(endYear, 5, 30)
        : new Date(endYear, 1, 24)
      )
        .toISOString()
        .split("T")[0],
    });
  }
  return seasons;
};

export const getTeamsBySeason = async (
  env: Env,
  league: League,
  locale: Lang,
  seasonId: number,
): Promise<TeamsBySeason[]> => {
  const data = await request<RESTGetAPITeams>(league, Routes.teams(), {
    params: {
      locale,
      stage_id: seasonId,
    },
  });

  return data.map(({ team }) => {
    const t = getTeam(league, team.id);
    return {
      id: String(team.id),
      city: team.location,
      code: t?.abbreviations[locale] ?? "",
      name: team.name,
      nickname: t?.names[locale] ?? team.name,
      team_caption: "",
      team_logo_url: team.image,
      // These aren't numbers
      // division_id: team.division_key,
      division_id: "",
      division_long_name: team.division ?? "",
      division_short_name: (team.division ?? "")
        .replace(/division|Дивизион/i, "")
        .trim(),
    };
  });
};

export const getSeasonSchedule = async (
  env: Env,
  league: League,
  locale: Lang,
  seasonId: number,
  teamId?: number,
): Promise<Schedule[]> => {
  const allKey = `${locale ?? "en"}-schedule-${league}-${seasonId}`;
  const allCached = await env.KV.get<Schedule[]>(allKey, "json");
  if (allCached)
    return teamId === undefined
      ? allCached
      : allCached.filter(
          (game) =>
            game.home_team === String(teamId) ||
            game.visiting_team === String(teamId),
        );

  const key = `${allKey}${teamId ?? ""}`;
  const cached = await env.KV.get<Schedule[]>(key, "json");
  if (cached) return cached;

  const events: APIEvent[] = [];
  let page = 1;
  while (true) {
    const data = await request<RESTGetAPIEvents>(league, Routes.events(), {
      params: {
        locale,
        stage_id: seasonId,
        "q[team_a_or_team_b_in][]": teamId,
        page,
      },
    });
    events.push(...data.map(({ event }) => event));
    if (data.length < 16) {
      break;
    }
    page += 1;
  }
  events.sort((a, b) => a.start_at - b.start_at);

  // biome-ignore format:
  const empty = emptyKeys("schedule_notes", "game_type", "game_letter", "home_audio_url", "home_video_url", "visiting_audio_url", "visiting_video_url", "notes_text", "venue_name", "venue_url", "home_team_division_long", "home_team_division_short", "visiting_team_division_long", "visiting_team_division_short");
  const formatted = events.map((event) => {
    const date = new Date(event.start_at);
    const teamA = getTeam(league, event.team_a.id);
    const teamB = getTeam(league, event.team_b.id);

    const statuses = getEventStatuses(event);

    return {
      ...empty,
      client_code: league,
      id: String(event.id),
      game_id: String(event.id),
      season_id: String(event.stage_id ?? seasonId),
      quick_score: "0",
      date_played: `${date.getUTCFullYear()}-${
        date.getUTCMonth() + 1
      }-${date.getUTCDate()}`,
      date: date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
      }),
      date_with_day: date.toLocaleDateString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
      date_time_played: date,
      GameDateISO8601: date,
      home_team: String(event.team_a.id),
      visiting_team: String(event.team_b.id),
      home_goal_count: event.score.split(":")[0],
      visiting_goal_count: event.score.split(":")[1],
      period: statuses.Period,
      overtime: numBool(event.scores.overtime !== null),
      shootout: numBool(event.scores.bullitt !== null),
      schedule_time: statuses.ScheduledTime,
      game_clock: "00:00",
      timezone: "Europe/Moscow",
      // The KHL does keep track of this but it's not in this endpoint
      attendance: "0",
      // same as above
      game_number: "0",
      status: statuses.GameStatus,
      location: event.team_a.location,
      game_status: statuses.GameStatusString,
      intermission: "0",
      if_necessary: "0",
      period_trans: statuses.Period,
      started: numBool(event.game_state_key !== State.InProgress),
      final: numBool(event.game_state_key === State.Finished),
      tickets_url:
        league === "khl"
          ? `${getLeagueSite(league, locale)}/tickets/${
              date.getUTCMonth() + 1
            }/${event.team_a.khl_id}/`
          : "",
      home_webcast_url: `https://video.khl.ru/events/${event.id}`,
      visiting_webcast_url: `https://video.khl.ru/events/${event.id}`,
      home_team_name: `${event.team_a.location} ${event.team_a.name}`,
      home_team_code: teamA?.abbreviations[locale] ?? "",
      home_team_nickname: event.team_a.name,
      home_team_city: event.team_a.location,
      visiting_team_name: `${event.team_b.location} ${event.team_b.name}`,
      visiting_team_code: teamB?.abbreviations[locale] ?? "",
      visiting_team_nickname: event.team_b.name,
      visiting_team_city: event.team_b.location,
      use_shootouts: "1",
      venue_location: event.team_a.location,
      // valid value for a hockeytech response, but feels wrong
      last_modified: "0000-00-00 00:00:00",
      scheduled_time: statuses.ScheduledFormattedTime,
      mobile_calendar: `${getLeagueSite(league, locale)}/calendar/ics/${
        event.team_a.khl_id
      };${event.team_b.khl_id};/`,
    } satisfies Schedule;
  });

  const firstStart = events.find(
    (event) => event.game_state_key === State.Soon,
  )?.start_at;
  const hasLiveGames =
    events.find((event) => event.game_state_key === State.InProgress) !==
    undefined;

  // This is a lot of data, but it shouldn't exceed the 25mib limit for a KV
  // value. In testing, the response for every game in the 2024/25 KHL season
  // was 1.15mib (including modulekit wrapper data).
  await env.KV.put(key, JSON.stringify(formatted), {
    expirationTtl: hasLiveGames
      ? 600
      : firstStart === undefined
        ? // 24 hours
          3600 * 24
        : undefined,
    expiration:
      !hasLiveGames && firstStart !== undefined
        ? Math.floor(firstStart / 1000)
        : undefined,
  });

  return formatted;
};
