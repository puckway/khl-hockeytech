import {
  APIEventWithInfo,
  RESTGetAPIEvent,
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
