import { League } from ".";

interface LeaugeInfo {
  names: { en: string; ru: string };
  abbreviations: { en: string; ru: string };
}

export const leagueNames: Record<League, LeaugeInfo> = {
  khl: {
    names: {
      en: "Kontinental Hockey Leauge",
      ru: "Континентальная Хоккейная Лига",
    },
    abbreviations: { en: "KHL", ru: "КХЛ" },
  },
  whl: {
    names: { en: "Women's Hockey Leauge", ru: "Женская Хоккейная Лига" },
    abbreviations: { en: "WHL", ru: "ЖХЛ" },
  },
  mhl: {
    names: { en: "Minor Hockey Leauge", ru: "Молодежная Хоккейная Лига" },
    abbreviations: { en: "MHL", ru: "МХЛ" },
  },
};

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
