import { RESTGetAPIEvents, Routes, State } from "khl-api-types";
import { Env, HockeyTechParams, Lang, League, numBool } from ".";
import { request } from "./rest";
import {
  GameStatus,
  Period,
  Periods,
  GamesByDate,
  GamesPerDay,
} from "hockeytech";
import { getTeam } from "./teams";

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
        required_link: "https://www.khl.ru",
        powered_by: "Powered by khl-hockeytech, based on HockeyTech.com",
        powered_by_url: "https://github.com/shayypy/khl-hockeytech",
      },
    },
  };
};

export const stateToStatus = (state: State): GameStatus =>
  state === State.Soon
    ? GameStatus.NotStarted
    : state === State.InProgress
      ? GameStatus.InProgress
      : GameStatus.Final;

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

export const getDailySchedule = async (
  env: Env,
  league: League,
  locale: Lang,
  date: Date,
): Promise<GamesByDate[]> => {
  const games = await request<RESTGetAPIEvents>(league, Routes.events(), {
    params: {
      locale,
      "q[start_at_lt_time_from_unixtime]": Math.ceil(date.getTime() / 1000),
      order_direction: "desc",
    },
  });
  const now = new Date();
  return games.map(({ event }) => {
    const d = new Date(event.event_start_at);
    const home = getTeam(league, event.team_a.id);
    const away = getTeam(league, event.team_b.id);
    return {
      attendance: "",
      capacity: "",
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
      featured_player_id: "",
      final: numBool(event.game_state_key === State.Finished),
      forfeit: "0",
      game_clock: "0:00",
      game_id: String(event.id),
      game_letter: "",
      // This is something that the KHL provides but I'm not sure where at the moment
      game_number: "0",
      game_status: stateToStatus(event.game_state_key),
      goal_list: [],
      goal_summary: [],
      home_assistant_coach1: "",
      home_assistant_coach2: "",
      home_audio_url: "",
      home_audio_url_fr: "",
      home_coach: "",
      home_goal_count: event.score.split(":")[0],
      home_manager: "",
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
      home_team_notes: "",
      home_video_url: "",
      home_video_url_fr: "",
      home_webcast_url: "",
      home_webcast_url_fr: "",
      id: String(event.id),
      if_necessary: "0",
      imported_id: "",
      intermission: "",
      last_modified: (d > now ? now : d).toISOString().replace("T", " "),
      league_game_notes: "",
      league_id: "0",
      location: event.location ?? "",
      mvp1: "",
      mvp2: "",
      mvp3: "",
      pending_final: "0",
      period: String(event.period ?? 0),
      periods: getPeriods(event.period ?? 0),
      playoff: numBool(event.not_regular ?? false),
      // playoff: numBool(
      //   (event.stage_name?.includes("Playoff") ||
      //     event.stage_name?.includes("Плей-офф")) ??
      //     false,
      // ),
      private_notes: "",
      public_notes: "",
      quick_score: "",
      schedule_notes: "",
      schedule_notes_fr: "",
      schedule_time: new Date(event.start_at).toLocaleTimeString(locale),
      season_id: String(event.stage_id),
      shootout:
        event.period && event.period !== -1 ? numBool(event.period > 4) : "0",
      shootout_first_shooter_home: "0",
      start_time: d.toLocaleTimeString(locale, {
        hour: "numeric",
        minute: "2-digit",
      }),
      started: numBool(event.game_state_key === State.InProgress),
      status: stateToStatus(event.game_state_key),
      tickets_url: "",
      tickets_url_fr: "",
      timezone: "Europe/Moscow",
      type_id: "",
      venue: "",
      venue_location: event.location ?? "",
      visiting_assistant_coach1: "",
      visiting_assistant_coach2: "",
      visiting_audio_url: "",
      visiting_audio_url_fr: "",
      visiting_coach: "",
      visiting_goal_count: event.score.split(":")[1],
      visiting_manager: "",
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
      visiting_team_notes: "",
      visiting_video_url: "",
      visiting_video_url_fr: "",
      visiting_webcast_url: "",
      visiting_webcast_url_fr: "",
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
