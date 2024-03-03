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
  const parsed = JSON.parse(text);
  if ("error" in parsed && "code" in parsed.error) {
    throw new KhlApiError(
      `Failed to ${method} ${url.href} (${parsed.error.code}): ${
        parsed.error.message ?? text
      }`,
    );
  }

  return parsed as T;
};
