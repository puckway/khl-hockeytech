import type { PlayerBio } from "hockeytech";
import { Env, Lang, League } from ".";
import { request } from "./rest";
import { RESTGetAPIPlayers, Routes } from "khl-api-types";
import { allTeams } from "./teams";

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

  let birthdate = "";
  if (player.birthday) {
    const date = new Date(player.birthday * 1000);
    birthdate = `${date.getUTCFullYear()}-${
      date.getUTCMonth() + 1
    }-${date.getUTCDate()}`;
  }

  // Names are in reverse order by default (last name first)
  const nameParts = player.name.split(" ");
  const first_name = nameParts[nameParts.length - 1];
  const last_name = nameParts.slice(0, nameParts.length - 1).join(" ");
  const name = `${first_name} ${last_name}`;

  // Heights are in centimeters
  let height = "";
  if (player.height) {
    const allInches = player.height * 0.39;
    const feet = Math.floor(allInches / 12);
    const remInches = Math.floor(allInches - feet * 12);
    height = `${feet}-${remInches}`;
  }

  const mostRecentTeam = player.team ?? player.teams[player.teams.length - 1];
  const team = allTeams[league].find((t) => t.id === mostRecentTeam?.id);

  return {
    // educated guess
    active: player.seasons_count.team !== 0 ? "1" : "0",
    bio: `${name} is a ${player.role} from ${
      player.country
    }, currently playing for ${
      player.team?.name ?? "an unknown team, or no team"
    }.`,
    birthcntry: player.country,
    birthdate,
    birthprov: "",
    birthtown: "",
    careerhigh: "",
    shoots: player.stick?.toUpperCase() ?? "",
    catches: player.stick?.toUpperCase() ?? "",
    current_team: player.team ? String(player.team.id) : "",
    division: player.team?.division ?? "",
    draft: [],
    draft_type: "",
    first_name,
    last_name,
    name,
    height,
    weight: player.weight ? String(Math.round(player.weight * 2.2)) : "", // kg -> lb
    homecntry: player.country,
    homeprov: "",
    hometown: "",
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
    rookie:
      // We can't see seasons in all leagues so we're going to assume that anyone who is
      // at least 19 and has played more than 1 KHL season is not a rookie.
      player.seasons_count.khl > 1 && (player.age ? player.age < 19 : false)
        ? "1"
        : "0",
  };
};
