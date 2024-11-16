import { Lang, League } from ".";

export const allTeams: Record<
  League,
  {
    id: number;
    khl_id: number;
    names: Record<Lang, string>;
    locations: Record<Lang, string>;
    abbreviations: Record<Lang, string>;
    slug?: string;
  }[]
> = {
  khl: [
    {
      id: 18,
      khl_id: 7,
      names: { en: "Spartak", ru: "Спартак" },
      locations: { en: "Moscow", ru: "Москва" },
      abbreviations: { en: "SPR", ru: "СПР" },
    },
    {
      id: 30,
      khl_id: 37,
      names: { en: "Metallurg Mg", ru: "Металлург Мг" },
      locations: { en: "Magnitogorsk", ru: "Магнитогорск" },
      abbreviations: { en: "MMG", ru: "ММГ" },
    },
    {
      id: 26,
      khl_id: 1,
      names: { en: "Lokomotiv", ru: "Локомотив" },
      locations: { en: "Yaroslavl", ru: "Ярославль" },
      abbreviations: { en: "LOK", ru: "ЛОК" },
    },
    {
      id: 44,
      khl_id: 24,
      names: { en: "SKA", ru: "СКА" },
      locations: { en: "Saint Petersburg", ru: "Санкт-Петербург" },
      abbreviations: { en: "SKA", ru: "СКА" },
    },
    {
      id: 8,
      khl_id: 719,
      names: { en: "Dynamo Msk", ru: "Динамо М" },
      locations: { en: "Moscow", ru: "Москва" },
      abbreviations: { en: "DYN", ru: "ДИН" },
    },
    {
      id: 10,
      khl_id: 34,
      names: { en: "Avangard", ru: "Авангард" },
      locations: { en: "Omsk", ru: "Омск" },
      abbreviations: { en: "AVG", ru: "АВГ" },
    },
    {
      id: 32,
      khl_id: 38,
      names: { en: "Salavat Yulaev", ru: "Салават Юлаев" },
      locations: { en: "Ufa", ru: "Уфа" },
      abbreviations: { en: "SAL", ru: "СЮЛ" },
    },
    {
      id: 56,
      khl_id: 190,
      names: { en: "Avtomobilist", ru: "Автомобилист" },
      locations: { en: "Ekaterinburg", ru: "Екатеринбург" },
      abbreviations: { en: "AVT", ru: "АВТ" },
    },
    {
      id: 105,
      khl_id: 66,
      names: { en: "Lada", ru: "Лада" },
      locations: { en: "Togliatti", ru: "Тольятти" },
      abbreviations: { en: "LAD", ru: "ЛАД" },
    },
    {
      id: 22,
      khl_id: 26,
      names: { en: "Torpedo", ru: "Торпедо" },
      locations: { en: "Nizhny Novgorod", ru: "Нижний Новгород" },
      abbreviations: { en: "TOR", ru: "ТОР" },
    },
    {
      id: 28,
      khl_id: 25,
      names: { en: "Traktor", ru: "Трактор" },
      locations: { en: "Chelyabinsk", ru: "Челябинск" },
      abbreviations: { en: "TRK", ru: "ТРК" },
    },
    {
      id: 40,
      khl_id: 53,
      names: { en: "Ak Bars", ru: "Ак Барс" },
      locations: { en: "Kazan", ru: "Казань" },
      abbreviations: { en: "AKB", ru: "АКБ" },
    },
    {
      id: 24,
      khl_id: 29,
      names: { en: "Sibir", ru: "Сибирь" },
      locations: { en: "Novosibirsk Region", ru: "Новосибирская область" },
      abbreviations: { en: "SIB", ru: "СИБ" },
    },
    {
      id: 16,
      khl_id: 2,
      names: { en: "CSKA", ru: "ЦСКА" },
      locations: { en: "Moscow", ru: "Москва" },
      abbreviations: { en: "CSK", ru: "ЦСК" },
    },
    {
      id: 42,
      khl_id: 56,
      names: { en: "Severstal", ru: "Северсталь" },
      locations: { en: "Cherepovets", ru: "Череповец" },
      abbreviations: { en: "SEV", ru: "СЕВ" },
    },
    {
      id: 12,
      khl_id: 54,
      names: { en: "Amur", ru: "Амур" },
      locations: { en: "Khabarovsk", ru: "Хабаровск" },
      abbreviations: { en: "AMR", ru: "АМР" },
    },
    {
      id: 36,
      khl_id: 71,
      names: { en: "Neftekhimik", ru: "Нефтехимик" },
      locations: { en: "Nizhnekamsk", ru: "Нижнекамск" },
      abbreviations: { en: "NKH", ru: "НХК" },
    },
    {
      id: 38,
      khl_id: 207,
      names: { en: "Dinamo Mn", ru: "Динамо Мн" },
      locations: { en: "Minsk", ru: "Минск" },
      abbreviations: { en: "DMN", ru: "ДМН" },
    },
    {
      id: 46,
      khl_id: 198,
      names: { en: "Barys", ru: "Барыс" },
      locations: { en: "Astana", ru: "Астана" },
      abbreviations: { en: "BAR", ru: "БАР" },
    },
    {
      id: 61,
      khl_id: 418,
      names: { en: "Admiral", ru: "Адмирал" },
      locations: { en: "Vladivostok", ru: "Владивосток" },
      abbreviations: { en: "ADM", ru: "АДМ" },
    },
    {
      id: 34,
      khl_id: 19,
      names: { en: "Vityaz", ru: "Витязь" },
      locations: { en: "Moscow Region", ru: "Московская область" },
      abbreviations: { en: "VIT", ru: "ВИТ" },
    },
    {
      id: 315,
      khl_id: 568,
      names: { en: "Kunlun RS", ru: "Куньлунь РС" },
      locations: { en: "Beijing", ru: "Пекин" },
      abbreviations: { en: "KRS", ru: "КРС" },
      slug: "kunlun",
    },
    {
      id: 113,
      khl_id: 451,
      names: { en: "HC Sochi", ru: "ХК Сочи" },
      locations: { en: "Sochi", ru: "Сочи" },
      abbreviations: { en: "SCH", ru: "СОЧ" },
    },
  ],
  // The abbreviations here & for the WHL are completely arbitrary since I
  // couldn't find any place on the websites where they were used
  mhl: [
    {
      id: 375,
      khl_id: 230,
      names: { en: "Omskie Yastreby", ru: "Омские Ястребы" },
      locations: { en: "Omsk", ru: "Омск" },
      abbreviations: { en: "OMS", ru: "ОМС" },
    },
    {
      id: 455,
      khl_id: 217,
      names: { en: "Spartak", ru: "Спартак" },
      locations: { en: "Moscow", ru: "Москва" },
      abbreviations: { en: "SPR", ru: "СПР" },
      slug: "jhc_spartak",
    },
    {
      id: 625,
      khl_id: 226,
      names: { en: "Irbis", ru: "Ирбис" },
      locations: { en: "Kazan", ru: "Казань" },
      abbreviations: { en: "IRB", ru: "ИРБ" },
    },
    {
      id: 443,
      khl_id: 222,
      names: { en: "Krasnaya Armiya", ru: "Красная Армия" },
      locations: { en: "Moscow", ru: "Москва" },
      abbreviations: { en: "ARM", ru: "АРМ" },
    },
    {
      id: 395,
      khl_id: 234,
      names: { en: "Tolpar", ru: "Толпар" },
      locations: { en: "Ufa", ru: "Уфа" },
      abbreviations: { en: "TOL", ru: "ТОЛ" },
    },
    {
      id: 711,
      khl_id: 322,
      names: { en: "Dinamo-Shinnik", ru: "Динамо-Шинник" },
      locations: { en: "Bobruysk", ru: "Бобруйск" },
      abbreviations: { en: "DNS", ru: "ДНС" },
      slug: "dinamo_shinnik",
    },
    {
      id: 669,
      khl_id: 425,
      names: { en: "Loko-76", ru: "Локо-76" },
      locations: { en: "Yaroslavl", ru: "Ярославль" },
      abbreviations: { en: "L76", ru: "Л76" },
    },
    {
      id: 371,
      khl_id: 320,
      names: { en: "Mamonty Ugry", ru: "Мамонты Югры" },
      locations: { en: "Khanty-Mansiysk", ru: "Ханты-Мансийск" },
      abbreviations: { en: "MAM", ru: "МАМ" },
    },
    {
      id: 383,
      khl_id: 227,
      names: { en: "Belye Medvedi", ru: "Белые Медведи" },
      locations: { en: "Chelyabinsk", ru: "Челябинск" },
      abbreviations: { en: "BEL", ru: "БЕЛ" },
    },
    {
      id: 657,
      khl_id: 671,
      names: { en: "Mikhailov Academy", ru: "Академия Михайлова" },
      locations: { en: "Tulskiy Region", ru: "Тульская область" },
      abbreviations: { en: "MIK", ru: "МИК" },
    },
    {
      id: 629,
      khl_id: 258,
      names: { en: "Krylya Sovetov", ru: "Крылья Советов" },
      locations: { en: "Moscow", ru: "Москва" },
      abbreviations: { en: "SOV", ru: "СОВ" },
    },
    {
      id: 415,
      khl_id: 229,
      names: { en: "Ladya", ru: "Ладья" },
      locations: { en: "Togliatti", ru: "Тольятти" },
      abbreviations: { en: "LAD", ru: "ЛАД" },
    },
    {
      id: 347,
      khl_id: 215,
      names: { en: "Loko", ru: "Локо" },
      locations: { en: "Yaroslavl", ru: "Ярославль" },
      abbreviations: { en: "LOK", ru: "ЛОК" },
    },
    {
      id: 427,
      khl_id: 220,
      names: { en: "SKA-1946", ru: "СКА-1946" },
      locations: { en: "Saint Petersburg", ru: "Санкт-Петербург" },
      abbreviations: { en: "SKA", ru: "СКА" },
      slug: "ska_1946",
    },
    {
      id: 355,
      khl_id: 233,
      names: { en: "Stalnye Lisy", ru: "Стальные Лисы" },
      locations: { en: "Magnitogorsk", ru: "Магнитогорск" },
      abbreviations: { en: "STA", ru: "СТА" },
    },
    {
      id: 351,
      khl_id: 223,
      names: { en: "Chaika", ru: "Чайка" },
      locations: { en: "Nizhny Novgorod", ru: "Нижний Новгород" },
      abbreviations: { en: "CHA", ru: "ЦДХ" },
    },
    {
      id: 387,
      khl_id: 225,
      names: { en: "Avto", ru: "Авто" },
      locations: { en: "Yekaterinburg", ru: "Екатеринбург" },
      abbreviations: { en: "AVT", ru: "АВТ" },
    },
    {
      id: 439,
      khl_id: 224,
      names: { en: "Dynamo M", ru: "Динамо М" },
      locations: { en: "Balashikha", ru: "Москва" },
      abbreviations: { en: "DYM", ru: "ДИМ" },
      slug: "jhc_dynamo_msk",
    },
    {
      id: 391,
      khl_id: 231,
      names: { en: "Reaktor", ru: "Реактор" },
      locations: { en: "Nizhnekamsk", ru: "Нижнекамск" },
      abbreviations: { en: "REA", ru: "РЭА" },
    },
    {
      id: 447,
      khl_id: 422,
      names: { en: "Dynamo SPb", ru: "Динамо СПб" },
      locations: { en: "Saint Petersburg", ru: "Санкт-Петербург" },
      abbreviations: { en: "DYS", ru: "ДИС" },
      slug: "jhc_dynamo_spb",
    },
    {
      id: 467,
      khl_id: 219,
      names: { en: "Russkie Vityazi", ru: "Русские Витязи" },
      locations: { en: "Chekhov", ru: "Московская область" },
      abbreviations: { en: "VIT", ru: "ВИТ" },
    },
    {
      id: 673,
      khl_id: 435,
      names: { en: "Molot", ru: "Молот" },
      locations: { en: "Perm", ru: "Пермь" },
      abbreviations: { en: "MOL", ru: "МОЛ" },
    },
    {
      id: 359,
      khl_id: 321,
      names: { en: "Snezhnye Barsy", ru: "Снежные Барсы" },
      locations: { en: "Astana", ru: "Астана" },
      abbreviations: { en: "SZN", ru: "СЗН" },
    },
    {
      id: 411,
      khl_id: 228,
      names: { en: "Kuznetskie Medvedi", ru: "Кузнецкие Медведи" },
      locations: { en: "Novokuznetsk", ru: "Новокузнецк" },
      abbreviations: { en: "KUZ", ru: "КУЗ" },
    },
    {
      id: 435,
      khl_id: 214,
      names: { en: "Almaz", ru: "Алмаз" },
      locations: { en: "Cherepovets", ru: "Череповец" },
      abbreviations: { en: "ALM", ru: "АЛМ" },
    },
    {
      id: 423,
      khl_id: 275,
      names: { en: "Amurskie Tigry", ru: "Амурские Тигры" },
      locations: { en: "Khabarovsk", ru: "Хабаровск" },
      abbreviations: { en: "AMR", ru: "АМР" },
    },
    {
      id: 699,
      khl_id: 264,
      names: { en: "Krasnoyarskie Rysi", ru: "Красноярские Рыси" },
      locations: { en: "Krasnoyarsk", ru: "Красноярск" },
      abbreviations: { en: "RYS", ru: "РЫС" },
    },
    {
      id: 459,
      khl_id: 218,
      names: { en: "Atlant", ru: "СМО Атлант" },
      locations: { en: "Moscow Region", ru: "Московская область" },
      abbreviations: { en: "ATL", ru: "АТЛ" },
    },
    {
      id: 633,
      khl_id: 385,
      names: { en: "Sakhalinskie Akuly", ru: "Сахалинские Акулы" },
      locations: { en: "Sakhalin Region", ru: "Сахалинская область" },
      abbreviations: { en: "SAK", ru: "САК" },
    },
    {
      id: 431,
      khl_id: 569,
      // This one was originally Taifun and I just felt
      // like it should be translated properly
      names: { en: "Typhoon", ru: "Тайфун" },
      locations: { en: "Primorsky Krai", ru: "Приморский край" },
      abbreviations: { en: "TFN", ru: "ТФН" },
      slug: "taifun",
    },
    {
      id: 379,
      khl_id: 277,
      names: { en: "Tyumensky Legion", ru: "Тюменский Легион" },
      locations: { en: "Tyumen", ru: "Тюмень" },
      abbreviations: { en: "TYL", ru: "ТИЛ" },
    },
    {
      id: 707,
      khl_id: 790,
      names: { en: "AKM-Junior", ru: "АКМ-Юниор" },
      locations: { en: "Tula region", ru: "Тульская область" },
      abbreviations: { en: "AKM", ru: "АКМ" },
      slug: "akm_yunior",
    },
    {
      id: 545,
      khl_id: 183,
      names: { en: "HC Kapitan", ru: "ХК Капитан" },
      locations: { en: "Stupino", ru: "Ступино" },
      abbreviations: { en: "KAP", ru: "КАП" },
      slug: "kapitan",
    },
    {
      id: 581,
      khl_id: 454,
      names: { en: "SKA-Junior", ru: "СКА-Юниор" },
      locations: { en: "Leningrad Region", ru: "Красногорск" },
      abbreviations: { en: "SKJ", ru: "СКЮ" },
      slug: "ska_yunior",
    },
    {
      id: 621,
      khl_id: 232,
      names: { en: "Sibirskie Snaipery", ru: "Сибирские Снайперы" },
      locations: { en: "Novosibirisk", ru: "Новосибирская область" },
      abbreviations: { en: "SIB", ru: "СИБ" },
    },
    {
      id: 399,
      khl_id: 386,
      names: { en: "Sputnik", ru: "Спутник Ал" },
      locations: { en: "Almetyevsk", ru: "Альметьевск" },
      abbreviations: { en: "SPT", ru: "СПТ" },
    },
    {
      id: 703,
      khl_id: 734,
      names: { en: "Khors-Kareliya", ru: "Хорс-Карелия" },
      locations: { en: "Kondopoga", ru: "Кондопога" },
      abbreviations: { en: "KRS", ru: "ХРС" },
      slug: "hors_kareliya",
    },
    {
      id: 851,
      khl_id: 893,
      names: { en: "AKM-Novomoskovsk", ru: "АКМ-Новомосковск" },
      locations: { en: "Novomoskovsk", ru: "Новомосковск" },
      abbreviations: { en: "AKN", ru: "АКН" },
    },
  ],
  whl: [
    {
      id: 601,
      khl_id: 0,
      names: { en: "Agidel", ru: "Агидель" },
      locations: { en: "Ufa", ru: "Уфа" },
      abbreviations: { en: "AGD", ru: "АГД" },
    },
    {
      id: 665,
      khl_id: 782,
      names: { en: "Dynamo-Neva", ru: "Динамо-Нева" },
      locations: { en: "Saint Petersburg", ru: "Санкт-Петербург" },
      abbreviations: { en: "DYN", ru: "ДИН" },
    },
    {
      id: 593,
      khl_id: 532,
      names: { en: "Tornado", ru: "Торнадо" },
      locations: { en: "Moscow Region", ru: "Московская область" },
      abbreviations: { en: "TND", ru: "ТНД" },
    },
    {
      id: 677,
      khl_id: 791,
      names: { en: "Belye Medveditsy", ru: "Белые Медведицы" },
      locations: { en: "Chelyabinsk", ru: "Челябинск" },
      abbreviations: { en: "BEL", ru: "БЕЛ" },
    },
    {
      id: 661,
      khl_id: 780,
      names: { en: "MSMO 7.62", ru: "МСМО 7.62" },
      locations: { en: "Moscow Region", ru: "Московская область" },
      abbreviations: { en: "MSM", ru: "МСМ" },
      slug: "msmo762",
    },
    {
      id: 715,
      khl_id: 841,
      names: { en: "Torpedo", ru: "Торпедо" },
      locations: { en: "Nizhny Novgorod", ru: "Нижний Новгород" },
      abbreviations: { en: "TOR", ru: "ТОР" },
    },
    {
      id: 605,
      khl_id: 533,
      names: { en: "Biryusa", ru: "Бирюса" },
      locations: { en: "Krasnoyarsk", ru: "Красноярск" },
      abbreviations: { en: "BRY", ru: "БРЙ" },
    },
    {
      id: 597,
      khl_id: 536,
      names: { en: "SCSSO", ru: "СКСО" },
      locations: { en: "Yekaterinburg", ru: "Екатеринбург" },
      abbreviations: { en: "SCS", ru: "СКС" },
      slug: "sverdlovsk_region",
    },
  ],
};

export const getTeam = (league: League, teamId: string | number) =>
  allTeams[league].find((t) => t.id === Number(teamId));
