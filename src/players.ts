import type {
  GoalieSeasonStat,
  GoalieSeasonStatTotal,
  NumericBoolean,
  PlayerBio,
  PlayerCurrentSeasonStats,
  PlayerGameByGameStats,
  PlayerMedia,
  PlayerSeasonStat,
  PlayerSeasonStatTotal,
  PlayerStatsBySeason,
  SearchPlayersResult,
  SkaterSeasonStat,
  SkaterSeasonStatTotal,
} from "hockeytech";
import { Env, Lang, League, numBool } from ".";
import {
  APIPlayer,
  RESTGetAPIPlayers,
  RESTGetAPIPlayersLight,
  Role,
  Routes,
  StageType,
  StatId,
  Stick,
} from "khl-api-types";
import { allTeams, getTeam } from "./teams";
import {
  emptyKeys,
  RESTGetAPITables,
  roleKeyToPosition,
  roleKeyToPositionId,
} from "./modulekit";
import { getchPlayer } from "./cache";
import { request } from "./rest";

// Names are in reverse order by default (last name first)
export const getPlayerName = (player: { name: string }) => {
  const nameParts = player.name.split(" ");
  const first_name = nameParts[nameParts.length - 1];
  const last_name = nameParts.slice(0, nameParts.length - 1).join(" ");
  const name = `${first_name} ${last_name}`;
  return { first_name, last_name, name };
};

export const doPlayerConversions = (
  player: Pick<APIPlayer, "name"> &
    Partial<
      Pick<
        APIPlayer,
        "height" | "weight" | "birthday" | "seasons_count" | "age"
      >
    >,
) => {
  // Heights are in centimeters
  let height = "";
  if (player.height) {
    const allInches = player.height * 0.39;
    const feet = Math.floor(allInches / 12);
    const remInches = Math.floor(allInches - feet * 12);
    height = `${feet}-${remInches}`;
  }

  let birthdate = "";
  if (player.birthday) {
    const date = new Date(player.birthday * 1000);
    birthdate = `${date.getUTCFullYear()}-${
      date.getUTCMonth() + 1
    }-${date.getUTCDate()}`;
  }

  return {
    ...getPlayerName(player),
    birthdate,
    height,
    weight: player.weight ? String(Math.round(player.weight * 2.2)) : "", // kg -> lb
    rookie:
      // We can't see seasons in all leagues so we're going to assume that anyone who is
      // at least 19 and has played more than 1 KHL season is not a rookie.
      (player.seasons_count &&
      player.seasons_count?.khl > 1 &&
      (player.age ? player.age < 19 : false)
        ? "1"
        : "0") as NumericBoolean,
  };
};

export const getPlayerProfileBio = async (
  env: Env,
  league: League,
  locale: Lang,
  playerId: number,
): Promise<PlayerBio> => {
  const player = await getchPlayer(env, league, playerId, locale);
  if (!player) {
    throw Error("no such person/player found");
  }

  const mostRecentTeam = player.team ?? player.teams[player.teams.length - 1];
  const team = allTeams[league].find((t) => t.id === mostRecentTeam?.id);

  const currentYear = new Date().getUTCFullYear();
  const hasRecentSeason =
    player.teams.filter(
      // Find any team with a `seasons` that includes either the current or
      // previous season. If the player has not played in 2 years, they are
      // probably considered inactive. However this is mostly moot since the
      // KHL doesn't seem to return obviously inactive players here anyway.
      (t) =>
        t.seasons.split(",").find((year) => year === String(currentYear)) !==
        undefined,
    ).length !== 0;

  // biome-ignore format:
  const empty = emptyKeys("birthprov", "birthtown", "careerhigh", "draft_type", "homeprov", "hometown");

  const converted = doPlayerConversions(player);
  return {
    active: numBool(hasRecentSeason),
    bio: `${converted.name} is a ${player.role} from ${
      player.country
    }, currently playing for ${
      player.team?.name ?? "an unknown team, or no team"
    }.`,
    birthcntry: player.country,
    shoots: player.stick?.toUpperCase() ?? "",
    catches: player.stick ? (player.stick === "l" ? "R" : "L") : "",
    current_team: player.team ? String(player.team.id) : "",
    division: player.team?.division ?? "",
    draft: [],
    homecntry: player.country,
    jersey_number: player.shirt_number?.toString() ?? "",
    most_recent_team_code: team?.abbreviations[locale] ?? "",
    most_recent_team_id: mostRecentTeam ? String(mostRecentTeam.id) : "",
    most_recent_team_name: mostRecentTeam?.name ?? "",
    position: player.role_key
      ? player.role_key.substring(0, 1).toUpperCase()
      : "",
    primary_image: player.image ?? "",
    ...empty,
    ...converted,
  };
};

export const getPlayerProfileMedia = async (
  env: Env,
  league: League,
  locale: Lang,
  playerId: number,
  origin: string,
): Promise<PlayerMedia[]> => {
  const player = await getchPlayer(env, league, playerId, locale);
  if (!player) {
    throw Error("no such person/player found");
  }

  return player.quotes
    .filter((quote) => quote.free)
    .map((quote) => {
      let url: string;
      let media_type: string;
      if (quote.m3u8_url) {
        media_type = "mp4";
        const playlistProxy = new URL(origin);
        playlistProxy.pathname = "/m3u8";
        playlistProxy.searchParams.set("playlist", quote.m3u8_url);
        url = playlistProxy.href;
      } else {
        media_type = "jpg";
        url = quote.image_url;
      }

      return {
        id: String(quote.id),
        person_id: String(playerId),
        media_type,
        lang_id: "0",
        title: quote.description,
        uploaded: new Date(quote.finish_ts).toISOString(),
        is_primary: "1",
        uploaded_name: `${quote.id}.${media_type}`,
        file_name: `${quote.id}.${media_type}`,
        modified: new Date(quote.finish_ts).toISOString(),
        deleted: "0",
        height: "720",
        width: "1280",
        player_id: String(playerId),
        thumb: quote.image_url,
        url,
      };
    });
};

export const getPlayerGameByGame = async (
  env: Env,
  league: League,
  locale: Lang,
  playerId: number,
): Promise<PlayerGameByGameStats> => {
  const player = await getchPlayer(env, league, playerId, locale);
  if (!player) {
    throw Error("no such person/player found");
  }

  const allSeasons = await request<RESTGetAPITables>(league, Routes.tables(), {
    params: { locale },
  });
  const seasonYears = player.teams
    .flatMap((team) => team.seasons.split(","))
    .filter((s, i, a) => a.indexOf(s) === i)
    .sort((a, b) => Number(b.split("/")[0]) - Number(a.split("/")[0]));

  const seasons_played: PlayerGameByGameStats["seasons_played"] = [];
  for (const years of seasonYears) {
    const season = allSeasons.find((s) => s.season === years);
    if (season) {
      seasons_played.push(
        ...season.stages.map((stage) => ({
          season_id: stage.id,
          season_name: `${season.season} ${stage.title}`,
        })),
      );
    }
  }

  return {
    seasons_played,
    // Seems to be empty fairly often in real responses. I'm not sure there's
    // a good way to get this for the KHL
    games: [],
  };
};

export const getPlayerSeasonStats = async (
  env: Env,
  league: League,
  locale: Lang,
  playerId: number,
): Promise<PlayerStatsBySeason> => {
  const player = await getchPlayer(env, league, playerId, locale);
  if (!player) {
    throw Error("no such person/player found");
  }

  const allSeasons = await request<RESTGetAPITables>(league, Routes.tables(), {
    params: { locale },
  });
  allSeasons.sort(
    (a, b) => Number(b.season.split("/")[0]) - Number(a.season.split("/")[0]),
  );
  const latestSeason = allSeasons[0];
  const latestStage = latestSeason.stages[latestSeason.stages.length - 1];
  const regularStage = latestSeason.stages[0];
  const playoffStage: typeof regularStage | undefined = latestSeason.stages[1];

  // It doesn't look like the KHL offers a way to get career stats for a
  // player, so we're just going to include the latest season and a totals
  // object for compliance.
  const stats: Array<PlayerSeasonStat | PlayerSeasonStatTotal> = [];

  if (player.role_key === Role.Goaltender) {
    // biome-ignore format:
    const numbers: Pick<
      GoalieSeasonStatTotal, "assists" | "gaa" | "games_played" | "goals" | "goals_against" | "goals_against_average" | "losses" | "minutes_played" | "ot" | "ot_losses" | "penalty_minutes" | "points" | "savepct" | "saves" | "seconds_played" | "shootout_goals_against" | "shootout_losses" | "shootout_saves" | "shootout_shots" | "shots_against" | "shotspct" | "shutouts" | "sosavepct" | "ties" | "total_losses" | "wins"
    > = {
      assists: 0,
      gaa: "0.00",
      games_played: 0,
      goals: 0,
      goals_against: 0,
      goals_against_average: "0.00",
      losses: 0,
      minutes_played: 0,
      ot: 0,
      ot_losses: 0,
      penalty_minutes: 0,
      points: 0,
      savepct: "0.000",
      saves: 0,
      seconds_played: 0,
      shootout_goals_against: 0,
      shootout_losses: 0,
      shootout_saves: 0,
      shootout_shots: 0,
      shots_against: 0,
      shotspct: "0.000",
      shutouts: 0,
      sosavepct: "0.000",
      ties: 0,
      total_losses: 0,
      wins: 0,
    };
    type StatKeys = keyof typeof numbers;
    for (const stat of player.stats) {
      switch (stat.id) {
        case StatId.Points:
          numbers.points = stat.val;
          break;
        case StatId.PenaltyInMinutes:
          numbers.penalty_minutes = stat.val;
          break;
        case StatId.TimeOnIce:
          numbers.seconds_played = Math.floor(stat.val * 1000);
          numbers.minutes_played = stat.val;
          break;
        case StatId.GamesPlayed:
          numbers.games_played = stat.val;
          break;
        case StatId.Goals:
          numbers.goals = stat.val;
          break;
        case StatId.GoalsAllowed:
          numbers.goals_against = stat.val;
          break;
        case StatId.Losses:
          numbers.losses = stat.val;
          numbers.total_losses += stat.val;
          break;
        case StatId.Saves:
          numbers.saves = stat.val;
          break;
        case StatId.Shutouts:
          numbers.shutouts = stat.val;
          break;
        case StatId.Wins:
          numbers.wins = stat.val;
          break;
        default:
          break;
      }
    }
    numbers.assists = Math.max(numbers.points - numbers.goals, 0);

    numbers.gaa = (
      (numbers.goals_against * 60) /
      (numbers.minutes_played || 1)
    ).toFixed(2);
    numbers.goals_against_average = numbers.gaa;

    numbers.shots_against = numbers.saves + numbers.goals_against;
    numbers.savepct = (numbers.saves / (numbers.shots_against || 1)).toFixed(3);

    stats.push(
      {
        ...(Object.fromEntries(
          Object.entries(numbers).map(([key, val]) => [key, String(val)]),
        ) as Pick<GoalieSeasonStat, StatKeys>),
        season_id: String(latestStage.id),
        season_name: `${latestSeason.season} ${latestStage.title}`,
        shortname: latestSeason.season,
        career: "1",
        playoff: numBool(latestStage.type === StageType.Playoff),
        veteran: "",
        veteran_status: "",
        team_city: player.team.location,
        team_code: getTeam(league, player.team.id)?.abbreviations[locale] ?? "",
        team_id: String(player.team.id),
        team_name: player.team.name,
        team_nickname: player.team.name,
        division: player.team.division ?? "",
        max_start_date: "",
      } satisfies GoalieSeasonStat,
      {
        ...numbers,
        season_name: "Total",
        shortname: "Total",
        playoff: latestStage.title === StageType.Playoff ? 1 : 0,
        season_id: latestStage.id,
        veteran_status: 0,
        career: 1,
        max_start_date: 0,
      } satisfies GoalieSeasonStatTotal,
    );
  } else {
    // biome-ignore format:
    const numbers: Pick<
      SkaterSeasonStatTotal, "assists" | "empty_net_goals" | "faceoff_attempts" | "faceoff_pct" | "faceoff_wins" | "first_goals" | "game_tieing_goals" | "game_winning_goals" | "games_played" | "goals" | "hits" | "insurance_goals" | "overtime_goals" | "penalty_minutes" | "penalty_minutes_per_game" | "plus_minus" | "points" | "points_per_game" | "power_play_assists" | "power_play_goals" | "shooting_percentage" | "shootout_attempts" | "shootout_goals" | "shootout_percentage" | "shootout_winning_goals" | "short_handed_assists" | "short_handed_goals" | "shots" | "unassisted_goals" | "jersey_number"
    > = {
      assists: 0,
      games_played: 0,
      goals: 0,
      penalty_minutes: 0,
      points: 0,
      empty_net_goals: 0,
      faceoff_attempts: 0,
      faceoff_pct: 0,
      faceoff_wins: 0,
      first_goals: 0,
      game_tieing_goals: 0,
      game_winning_goals: 0,
      hits: 0,
      insurance_goals: 0,
      overtime_goals: 0,
      penalty_minutes_per_game: "0.00",
      plus_minus: 0,
      points_per_game: "0.00",
      power_play_assists: 0,
      power_play_goals: 0,
      shooting_percentage: "0.0",
      shootout_attempts: 0,
      shootout_goals: 0,
      shootout_percentage: "0.0",
      shootout_winning_goals: 0,
      short_handed_assists: 0,
      short_handed_goals: 0,
      shots: 0,
      unassisted_goals: 0,
      jersey_number: player.shirt_number ?? 0,
    };
    type StatKeys = keyof typeof numbers;
    for (const stat of player.stats) {
      switch (stat.id) {
        case StatId.Points:
          numbers.points = stat.val;
          break;
        case StatId.PenaltyInMinutes:
          numbers.penalty_minutes = stat.val;
          break;
        case StatId.GamesPlayed:
          numbers.games_played = stat.val;
          break;
        case StatId.Goals:
          numbers.goals = stat.val;
          break;
        case StatId.FaceoffsWon:
          numbers.faceoff_wins = stat.val;
          break;
        case StatId.PlusMinus:
          numbers.plus_minus = stat.val;
          break;
        default:
          break;
      }
    }
    numbers.assists = Math.max(numbers.points - numbers.goals, 0);
    numbers.points_per_game = (
      numbers.points / (numbers.games_played || 1)
    ).toFixed(2);

    stats.push(
      {
        ...(Object.fromEntries(
          Object.entries(numbers).map(([key, val]) => [key, String(val)]),
        ) as Pick<SkaterSeasonStat, StatKeys>),
        season_id: String(latestStage.id),
        season_name: `${latestSeason.season} ${latestStage.title}`,
        shortname: latestSeason.season,
        active: "1",
        career: "1",
        playoff: numBool(latestStage.type === StageType.Playoff),
        veteran: "",
        veteran_status: "",
        team_city: player.team.location,
        team_code: getTeam(league, player.team.id)?.abbreviations[locale] ?? "",
        team_id: String(player.team.id),
        team_name: player.team.name,
        team_nickname: player.team.name,
        division: player.team.division ?? "",
        max_start_date: "",
      } satisfies SkaterSeasonStat,
      {
        ...numbers,
        season_name: "Total",
        shortname: "Total",
        playoff: latestStage.title === StageType.Playoff ? 1 : 0,
        season_id: latestStage.id,
        veteran_status: 0,
        career: 1,
        max_start_date: 0,
      } satisfies SkaterSeasonStatTotal,
    );
  }

  return {
    regular: latestStage.id === regularStage?.id ? stats : undefined,
    playoff: latestStage.id === playoffStage?.id ? stats : undefined,
  };
};

export const getPlayerCurrentSeasonStats = async (
  env: Env,
  league: League,
  locale: Lang,
  playerId: number,
): Promise<PlayerCurrentSeasonStats> => {
  const player = await getchPlayer(env, league, playerId, locale);
  if (!player) {
    throw Error("no such person/player found");
  }

  const allSeasons = await request<RESTGetAPITables>(league, Routes.tables(), {
    params: { locale },
  });
  allSeasons.sort(
    (a, b) => Number(b.season.split("/")[0]) - Number(a.season.split("/")[0]),
  );
  const latestSeason = allSeasons[0];
  const latestStage = latestSeason.stages[latestSeason.stages.length - 1];

  // biome-ignore format:
  const numbers: Pick<
    PlayerCurrentSeasonStats, "assists" | "games_played" | "goals" | "empty_net_goals" | "faceoff_attempts" | "faceoff_pct" | "faceoff_wa" | "faceoff_wins" | "first_goals" | "game_tieing_goals" | "game_winning_goals" | "ice_time" | "ice_time_avg" | "insurance_goals" | "major_penalties" | "minor_penalties" | "overtime_goals" | "penalty_minutes" | "penalty_minutes_per_game" | "plus_minus" | "points" | "points_per_game" | "power_play_assists" | "power_play_goals" | "power_play_points" | "shooting_percentage" | "shootout_attempts" | "shootout_games_played" | "shootout_goals" | "shootout_percentage" | "shootout_winning_goals" | "short_handed_assists" | "short_handed_goals" | "short_handed_points" | "shots" | "shots_on" | "unassisted_goals"
  > = {
    assists: "0",
    games_played: "0",
    goals: "0",
    empty_net_goals: "0",
    faceoff_attempts: "0",
    faceoff_pct: "0",
    faceoff_wins: "0",
    first_goals: "0",
    game_tieing_goals: "0",
    game_winning_goals: "0",
    insurance_goals: "0",
    overtime_goals: "0",
    penalty_minutes: "0",
    penalty_minutes_per_game: "0",
    plus_minus: "0",
    points: "0",
    points_per_game: "0",
    power_play_assists: "0",
    power_play_goals: "0",
    shooting_percentage: "0",
    shootout_attempts: "0",
    shootout_goals: "0",
    shootout_percentage: "0",
    shootout_winning_goals: "0",
    short_handed_assists: "0",
    short_handed_goals: "0",
    shots: "0",
    unassisted_goals: "0",
    faceoff_wa: "0",
    ice_time: "0",
    ice_time_avg: "0.0000",
    major_penalties: "0",
    minor_penalties: "0",
    power_play_points: "0",
    shootout_games_played: "0",
    short_handed_points: "0",
    shots_on: "0"
  };
  for (const stat of player.stats) {
    switch (stat.id) {
      case StatId.Points:
        numbers.points = String(stat.val);
        break;
      case StatId.PenaltyInMinutes:
        numbers.penalty_minutes = String(stat.val);
        break;
      case StatId.TimeOnIce:
        // assuming this needs to be minutes
        numbers.ice_time = String(Math.floor(stat.val));
        break;
      case StatId.GamesPlayed:
        numbers.games_played = String(stat.val);
        break;
      case StatId.Goals:
        numbers.goals = String(stat.val);
        break;
      case StatId.PlusMinus:
        numbers.plus_minus = String(stat.val);
        break;
      case StatId.PenaltyInMinutesAgainst:
        numbers.penalty_minutes = String(stat.val);
        break;
      case StatId.FaceoffsWon:
        numbers.faceoff_wins = String(stat.val);
        break;
      default:
        break;
    }
  }
  numbers.points_per_game = String(
    Math.max(
      Number(numbers.points) / (Number(numbers.games_played) || 1),
      0,
    ).toFixed(2),
  );
  numbers.assists = String(
    Math.max(Number(numbers.points) - Number(numbers.goals), 0),
  );
  numbers.ice_time_avg = String(
    Math.max(
      Number(numbers.ice_time) / (Number(numbers.games_played) || 1),
      0,
    ).toFixed(3),
  );

  const { first_name, last_name } = getPlayerName(player);
  return {
    ...numbers,
    season_id: String(latestStage.id),
    season_name: `${latestSeason.season} ${latestStage.title}`,
    division: player.team.division ?? "",
    player_id: String(player.id),
    first_name,
    last_name,
    team_id: String(player.team.id),
    team_name: player.team.name,
  } satisfies PlayerCurrentSeasonStats;
};

export const searchPlayers = async (
  env: Env,
  league: League,
  locale: Lang,
  query: string,
): Promise<SearchPlayersResult[]> => {
  const lightPlayers = await request<RESTGetAPIPlayersLight>(
    league,
    Routes.playersLight(),
    { params: { locale: locale ?? "en" } },
  );

  const q = query.toLowerCase();
  const found = lightPlayers
    .filter((player) => {
      const { first_name, last_name, name } = getPlayerName(player);
      return (
        name.toLowerCase().includes(q) ||
        first_name.toLowerCase().startsWith(q) ||
        last_name.toLowerCase().startsWith(q)
      );
    })
    // The players endpoint only returns 16 players so there's
    // no point in requesting more
    .slice(0, 16);
  if (found.length === 0) return [];

  const params = new URLSearchParams({ locale: locale ?? "en" });
  for (const player of found) params.append("q[id_in][]", String(player.id));
  const players = await request<RESTGetAPIPlayers>(league, Routes.players(), {
    params,
  });

  // biome-ignore format:
  const empty = emptyKeys("birthtown", "birthprov", "profile_image")
  const data = players.map(({ player }) => {
    const { name: _, rookie: __, ...converted } = doPlayerConversions(player);
    const lastActive =
      player.quotes.length === 0 ? null : new Date(player.quotes[0].start_ts);

    const team = player.team ?? player.teams[0];
    return {
      person_id: String(player.id),
      player_id: String(player.id),
      ...empty,
      ...converted,
      rawbirthdate: converted.birthdate,
      active: "1",
      phonetic_name: "", // Could be cool to include this
      shoots: player.stick ? player.stick.toUpperCase() : "",
      catches: player.stick ? (player.stick === Stick.Left ? "R" : "L") : "",
      jersey_number: String(player.shirt_number ?? ""),
      birthcntry: player.country,
      team_id: String(team?.id ?? ""),
      role_id: roleKeyToPositionId(player.role_key),
      // player.quotes is sorted most recent first (thank you)
      season_id: player.quotes[0]?.stage_id.toString() ?? "",
      role_name: "Player",
      all_roles: "Player",
      last_team_name: team?.name ?? "",
      last_team_code: team
        ? getTeam(league, team.id)?.abbreviations[locale] ?? ""
        : "",
      division: team?.division ?? "",
      position: roleKeyToPosition(player.role_key),
      score: "0.0", // I don't know what this is
      last_active_date:
        lastActive === null
          ? ""
          : `${lastActive.getUTCFullYear()}-${
              lastActive.getUTCMonth() + 1
            }-${lastActive.getUTCDate()}`,
    } satisfies SearchPlayersResult;
  });

  return data;
};
