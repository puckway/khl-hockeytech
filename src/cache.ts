import {
  APIEventWithInfo,
  APILightPlayer,
  APITeam,
  RESTGetAPIEvent,
  RESTGetAPIPlayersLight,
  RESTGetAPITeam,
  Routes,
  State,
} from "khl-api-types";
import { Env, Lang, League } from ".";
import { request } from "./rest";

export const getchEvent = async (
  env: Env,
  league: League,
  seasonId: number,
  id: number,
  locale?: Lang,
) => {
  const key = `${locale ?? "en"}-event-${league}-event-${seasonId}-${id}`;
  let event = await env.KV.get<APIEventWithInfo>(key, "json");
  if (!event) {
    const data = await request<RESTGetAPIEvent>(league, Routes.event(), {
      params: { locale: locale ?? "en", stage_id: seasonId, id },
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

export const getchLightPlayer = async (
  env: Env,
  league: League,
  id: number,
  locale?: Lang,
) => {
  const key = `${locale ?? "en"}-player-${league}-${id}`;
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

// export const getchTeam = async (
//   env: Env,
//   league: League,
//   id: number,
//   locale?: Lang,
// ) => {
//   const key = `${locale ?? "en"}-team-${league}-${id}`;
//   let team = await env.KV.get<APITeam>(key, "json");
//   if (!team) {
//     const data = await request<RESTGetAPITeam>(league, Routes.team(), {
//       params: { locale: locale ?? "en", id },
//     });
//     ({ team } = data);
//     await env.KV.put(key, JSON.stringify(team), { expirationTtl: 86_400 });
//   }
//   return team;
// };
