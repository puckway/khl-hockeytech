import { League } from ".";

export const getLeagueSite = (league: League, lang: string) =>
  `https://${
    // no locale options for whl
    league === "whl"
      ? "whl"
      : league === "mhl"
        ? lang === "en"
          ? "engmhl"
          : "mhl"
        : lang === "ru"
          ? "www"
          : lang
  }.khl.ru`;
