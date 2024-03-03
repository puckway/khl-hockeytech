import { APIRouteBases } from "khl-api-types";
import { Lang } from ".";

export interface JsonFetchOptions {
  method?: "GET";
  params?: { locale?: Lang; stage_id?: number } & Record<
    string,
    string | number | boolean | undefined
  >;
}

export class KhlApiError extends Error {}

export const request = async <T>(
  baseKey: keyof typeof APIRouteBases,
  path: `/${string}`,
  options?: JsonFetchOptions,
) => {
  const method = options?.method ?? "GET";
  const url = new URL(APIRouteBases[baseKey] + path);
  if (options?.params) {
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined) {
        url.searchParams.set(key, String(val));
      }
    }
  }

  const response = await fetch(url, {
    method,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new KhlApiError(
      `Failed to ${method} ${url.href} (${response.status}): ${text}`,
    );
  }

  return JSON.parse(text) as T;
};
