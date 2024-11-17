import {
  APIEventWithInfo,
  APILightPlayer,
  APIPlayer,
  APITeamWithDivision,
  RESTGetAPIEvent,
  RESTGetAPIPlayers,
  RESTGetAPIPlayersLight,
  RESTGetAPITeams,
  Routes,
  State,
} from "khl-api-types";
import { Env, Lang, League } from ".";
import { request } from "./rest";

export const getchEvent = async (
  env: Env,
  league: League,
  id: number,
  locale?: Lang,
) => {
  const key = `${locale ?? "en"}-event-${league}-event-${id}`;
  let event = await env.KV.get<APIEventWithInfo>(key, "json");
  if (!event) {
    const data = await request<RESTGetAPIEvent>(league, Routes.event(), {
      params: { locale: locale ?? "en", id },
    });
    event = data.event;
    const now = new Date();
    const ttl =
      event.game_state_key === State.Soon
        ? Math.min(Math.max((event.start_at - now.getTime()) / 1000, 60), 3600)
        : event.game_state_key === State.InProgress
          ? 300
          : 86400;
    await env.KV.put(key, JSON.stringify(event), { expirationTtl: ttl });
  }
  return event;
};

export const getchPlayer = async (
  env: Env,
  league: League,
  id: number,
  locale?: Lang,
) => {
  const key = `${locale ?? "en"}-player-${league}-${id}`;
  let player = await env.KV.get<APIPlayer>(key, "json");
  if (!player) {
    const data = await request<RESTGetAPIPlayers>(league, Routes.players(), {
      params: { locale: locale ?? "en", "q[id_in][]": id },
    });
    if (data.length === 0) {
      return null;
    }
    ({ player } = data[0]);
    await env.KV.put(key, JSON.stringify(player), {
      expirationTtl: 86_400 * 3,
    });
  }
  return player;
};

export const getchLightPlayer = async (
  env: Env,
  league: League,
  id: number,
  locale?: Lang,
) => {
  const key = `${locale ?? "en"}-player-light-${league}-${id}`;
  let player = await env.KV.get<APILightPlayer>(key, "json");
  if (!player) {
    const data = await request<RESTGetAPIPlayersLight>(
      league,
      Routes.playersLight(),
      { params: { locale: locale ?? "en", "q[id_in][]": id } },
    );
    if (data.length === 0) {
      return null;
    }
    // We use find() in case the q[id_in][] parameter silently stops working
    // https://github.com/shayypy/khl-api/blob/main/mobile-api.md#query-parameters-5
    player = data.find((p) => p.id === id) ?? null;
    if (!player) {
      return null;
    }
    await env.KV.put(key, JSON.stringify(player), {
      expirationTtl: 86_400 * 3,
    });
  }
  return player;
};

export const getchTeams = async (
  env: Env,
  league: League,
  locale?: Lang,
): Promise<APITeamWithDivision[]> => {
  const key = `${locale ?? "en"}-teams-${league}`;
  let teams = await env.KV.get<APITeamWithDivision[]>(key, "json");
  if (!teams) {
    const data = await request<RESTGetAPITeams>(league, Routes.teams(), {
      params: { locale: locale ?? "en" },
    });
    teams = data.map(({ team }) => team);
    // 1 week
    await env.KV.put(key, JSON.stringify(teams), { expirationTtl: 86_400 * 7 });
  }
  return teams;
};
