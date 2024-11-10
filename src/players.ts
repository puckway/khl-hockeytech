import type { NumericBoolean, PlayerBio } from "hockeytech";
import { Env, Lang, League } from ".";
import { request } from "./rest";
import { APIPlayer, RESTGetAPIPlayers, Routes } from "khl-api-types";
import { allTeams } from "./teams";
import { emptyKeys } from "./modulekit";

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
  const players = await request<RESTGetAPIPlayers>(league, Routes.players(), {
    params: { locale, "q[id_in][]": playerId },
  });
  if (players.length === 0) {
    throw Error("no such person/player found");
  }
  const [{ player }] = players;

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
