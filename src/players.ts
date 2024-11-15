import type {
  NumericBoolean,
  PlayerBio,
  PlayerGameByGameStats,
  PlayerMedia,
} from "hockeytech";
import { Env, Lang, League } from ".";
import { APIPlayer, Routes } from "khl-api-types";
import { allTeams } from "./teams";
import { emptyKeys, RESTGetAPITables } from "./modulekit";
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
    active: hasRecentSeason ? "1" : "0",
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
    most_recent_team_name: mostRecentTeam
      ? `${mostRecentTeam.location} ${mostRecentTeam.name}`
      : "",
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
