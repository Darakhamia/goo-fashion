"use client";

// Session ID persists across navigations on the same device.
// A new session is created only after 30 minutes of inactivity.
// Stored in localStorage so it survives browser close/reopen within the window.

const SESSION_KEY = "goo_sid";
const SESSION_TS_KEY = "goo_sid_ts";
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "s-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    const lastTs = Number(localStorage.getItem(SESSION_TS_KEY) ?? "0");
    const now = Date.now();

    if (existing && now - lastTs < SESSION_TIMEOUT_MS) {
      localStorage.setItem(SESSION_TS_KEY, String(now));
      return existing;
    }

    const id = uuid();
    localStorage.setItem(SESSION_KEY, id);
    localStorage.setItem(SESSION_TS_KEY, String(now));
    return id;
  } catch {
    return uuid();
  }
}

export function parseUTM(search: string): {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
} {
  try {
    const p = new URLSearchParams(search);
    return {
      utmSource:   p.get("utm_source")   ?? undefined,
      utmMedium:   p.get("utm_medium")   ?? undefined,
      utmCampaign: p.get("utm_campaign") ?? undefined,
    };
  } catch {
    return {};
  }
}

export function detectDevice(ua: string): "mobile" | "tablet" | "desktop" {
  const s = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|android.+mobile|blackberry|windows phone/.test(s)) return "mobile";
  return "desktop";
}

export function detectBrowser(ua: string): string {
  if (/edg\//i.test(ua))       return "Edge";
  if (/opr\//i.test(ua))       return "Opera";
  if (/chrome/i.test(ua))      return "Chrome";
  if (/safari/i.test(ua))      return "Safari";
  if (/firefox/i.test(ua))     return "Firefox";
  return "Other";
}

export function detectOS(ua: string): string {
  if (/windows/i.test(ua))     return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/android/i.test(ua))     return "Android";
  if (/iphone|ipad|ipod/i.test(ua))  return "iOS";
  if (/linux/i.test(ua))       return "Linux";
  return "Other";
}

// ── Country detection via timezone (works on any hosting, no external API) ───
// Covers 300+ IANA timezones → ISO-3166-1 alpha-2 code.
const TZ_COUNTRY: Record<string, string> = {
  "Africa/Abidjan":"CI","Africa/Accra":"GH","Africa/Addis_Ababa":"ET","Africa/Algiers":"DZ",
  "Africa/Asmara":"ER","Africa/Bamako":"ML","Africa/Bangui":"CF","Africa/Banjul":"GM",
  "Africa/Bissau":"GW","Africa/Blantyre":"MW","Africa/Brazzaville":"CG","Africa/Bujumbura":"BI",
  "Africa/Cairo":"EG","Africa/Casablanca":"MA","Africa/Ceuta":"ES","Africa/Conakry":"GN",
  "Africa/Dakar":"SN","Africa/Dar_es_Salaam":"TZ","Africa/Djibouti":"DJ","Africa/Douala":"CM",
  "Africa/El_Aaiun":"EH","Africa/Freetown":"SL","Africa/Gaborone":"BW","Africa/Harare":"ZW",
  "Africa/Johannesburg":"ZA","Africa/Juba":"SS","Africa/Kampala":"UG","Africa/Khartoum":"SD",
  "Africa/Kigali":"RW","Africa/Kinshasa":"CD","Africa/Lagos":"NG","Africa/Libreville":"GA",
  "Africa/Lome":"TG","Africa/Luanda":"AO","Africa/Lubumbashi":"CD","Africa/Lusaka":"ZM",
  "Africa/Malabo":"GQ","Africa/Maputo":"MZ","Africa/Maseru":"LS","Africa/Mbabane":"SZ",
  "Africa/Mogadishu":"SO","Africa/Monrovia":"LR","Africa/Nairobi":"KE","Africa/Ndjamena":"TD",
  "Africa/Niamey":"NE","Africa/Nouakchott":"MR","Africa/Ouagadougou":"BF","Africa/Porto-Novo":"BJ",
  "Africa/Sao_Tome":"ST","Africa/Tripoli":"LY","Africa/Tunis":"TN","Africa/Windhoek":"NA",
  "America/Adak":"US","America/Anchorage":"US","America/Anguilla":"AI","America/Antigua":"AG",
  "America/Araguaina":"BR","America/Argentina/Buenos_Aires":"AR","America/Argentina/Catamarca":"AR",
  "America/Argentina/Cordoba":"AR","America/Argentina/Jujuy":"AR","America/Argentina/La_Rioja":"AR",
  "America/Argentina/Mendoza":"AR","America/Argentina/Rio_Gallegos":"AR","America/Argentina/Salta":"AR",
  "America/Argentina/San_Juan":"AR","America/Argentina/San_Luis":"AR","America/Argentina/Tucuman":"AR",
  "America/Argentina/Ushuaia":"AR","America/Aruba":"AW","America/Asuncion":"PY",
  "America/Atikokan":"CA","America/Bahia":"BR","America/Bahia_Banderas":"MX","America/Barbados":"BB",
  "America/Belem":"BR","America/Belize":"BZ","America/Blanc-Sablon":"CA","America/Boa_Vista":"BR",
  "America/Bogota":"CO","America/Boise":"US","America/Cambridge_Bay":"CA","America/Campo_Grande":"BR",
  "America/Cancun":"MX","America/Caracas":"VE","America/Cayenne":"GF","America/Cayman":"KY",
  "America/Chicago":"US","America/Chihuahua":"MX","America/Costa_Rica":"CR","America/Creston":"CA",
  "America/Cuiaba":"BR","America/Curacao":"CW","America/Danmarkshavn":"GL","America/Dawson":"CA",
  "America/Dawson_Creek":"CA","America/Denver":"US","America/Detroit":"US","America/Dominica":"DM",
  "America/Edmonton":"CA","America/Eirunepe":"BR","America/El_Salvador":"SV","America/Fortaleza":"BR",
  "America/Glace_Bay":"CA","America/Godthab":"GL","America/Goose_Bay":"CA","America/Grand_Turk":"TC",
  "America/Grenada":"GD","America/Guadeloupe":"GP","America/Guatemala":"GT","America/Guayaquil":"EC",
  "America/Guyana":"GY","America/Halifax":"CA","America/Havana":"CU","America/Hermosillo":"MX",
  "America/Indiana/Indianapolis":"US","America/Indiana/Knox":"US","America/Indiana/Marengo":"US",
  "America/Indiana/Petersburg":"US","America/Indiana/Tell_City":"US","America/Indiana/Vevay":"US",
  "America/Indiana/Vincennes":"US","America/Indiana/Winamac":"US","America/Inuvik":"CA",
  "America/Iqaluit":"CA","America/Jamaica":"JM","America/Juneau":"US","America/Kentucky/Louisville":"US",
  "America/Kentucky/Monticello":"US","America/Kralendijk":"BQ","America/La_Paz":"BO",
  "America/Lima":"PE","America/Los_Angeles":"US","America/Lower_Princes":"SX","America/Maceio":"BR",
  "America/Managua":"NI","America/Manaus":"BR","America/Marigot":"MF","America/Martinique":"MQ",
  "America/Matamoros":"MX","America/Mazatlan":"MX","America/Menominee":"US","America/Merida":"MX",
  "America/Metlakatla":"US","America/Mexico_City":"MX","America/Miquelon":"PM","America/Moncton":"CA",
  "America/Monterrey":"MX","America/Montevideo":"UY","America/Montserrat":"MS","America/Nassau":"BS",
  "America/New_York":"US","America/Nipigon":"CA","America/Nome":"US","America/Noronha":"BR",
  "America/North_Dakota/Beulah":"US","America/North_Dakota/Center":"US","America/North_Dakota/New_Salem":"US",
  "America/Ojinaga":"MX","America/Panama":"PA","America/Pangnirtung":"CA","America/Paramaribo":"SR",
  "America/Phoenix":"US","America/Port-au-Prince":"HT","America/Port_of_Spain":"TT",
  "America/Porto_Velho":"BR","America/Puerto_Rico":"PR","America/Punta_Arenas":"CL",
  "America/Rainy_River":"CA","America/Rankin_Inlet":"CA","America/Recife":"BR","America/Regina":"CA",
  "America/Resolute":"CA","America/Rio_Branco":"BR","America/Santarem":"BR","America/Santiago":"CL",
  "America/Santo_Domingo":"DO","America/Sao_Paulo":"BR","America/Scoresbysund":"GL",
  "America/Sitka":"US","America/St_Barthelemy":"BL","America/St_Johns":"CA","America/St_Kitts":"KN",
  "America/St_Lucia":"LC","America/St_Thomas":"VI","America/St_Vincent":"VC","America/Swift_Current":"CA",
  "America/Tegucigalpa":"HN","America/Thule":"GL","America/Thunder_Bay":"CA","America/Tijuana":"MX",
  "America/Toronto":"CA","America/Tortola":"VG","America/Vancouver":"CA","America/Whitehorse":"CA",
  "America/Winnipeg":"CA","America/Yakutat":"US","America/Yellowknife":"CA",
  "Antarctica/Casey":"AQ","Antarctica/Davis":"AQ","Antarctica/DumontDUrville":"AQ",
  "Antarctica/Macquarie":"AU","Antarctica/Mawson":"AQ","Antarctica/McMurdo":"AQ",
  "Antarctica/Palmer":"AQ","Antarctica/Rothera":"AQ","Antarctica/Syowa":"AQ",
  "Antarctica/Troll":"AQ","Antarctica/Vostok":"AQ",
  "Arctic/Longyearbyen":"SJ",
  "Asia/Aden":"YE","Asia/Almaty":"KZ","Asia/Amman":"JO","Asia/Anadyr":"RU","Asia/Aqtau":"KZ",
  "Asia/Aqtobe":"KZ","Asia/Ashgabat":"TM","Asia/Atyrau":"KZ","Asia/Baghdad":"IQ",
  "Asia/Bahrain":"BH","Asia/Baku":"AZ","Asia/Bangkok":"TH","Asia/Barnaul":"RU","Asia/Beirut":"LB",
  "Asia/Bishkek":"KG","Asia/Brunei":"BN","Asia/Chita":"RU","Asia/Choibalsan":"MN",
  "Asia/Colombo":"LK","Asia/Damascus":"SY","Asia/Dhaka":"BD","Asia/Dili":"TL","Asia/Dubai":"AE",
  "Asia/Dushanbe":"TJ","Asia/Famagusta":"CY","Asia/Gaza":"PS","Asia/Hebron":"PS",
  "Asia/Ho_Chi_Minh":"VN","Asia/Hong_Kong":"HK","Asia/Hovd":"MN","Asia/Irkutsk":"RU",
  "Asia/Jakarta":"ID","Asia/Jayapura":"ID","Asia/Jerusalem":"IL","Asia/Kabul":"AF",
  "Asia/Kamchatka":"RU","Asia/Karachi":"PK","Asia/Kathmandu":"NP","Asia/Khandyga":"RU",
  "Asia/Kolkata":"IN","Asia/Krasnoyarsk":"RU","Asia/Kuala_Lumpur":"MY","Asia/Kuching":"MY",
  "Asia/Kuwait":"KW","Asia/Macau":"MO","Asia/Magadan":"RU","Asia/Makassar":"ID",
  "Asia/Manila":"PH","Asia/Muscat":"OM","Asia/Nicosia":"CY","Asia/Novokuznetsk":"RU",
  "Asia/Novosibirsk":"RU","Asia/Omsk":"RU","Asia/Oral":"KZ","Asia/Phnom_Penh":"KH",
  "Asia/Pontianak":"ID","Asia/Pyongyang":"KP","Asia/Qatar":"QA","Asia/Qostanay":"KZ",
  "Asia/Qyzylorda":"KZ","Asia/Riyadh":"SA","Asia/Sakhalin":"RU","Asia/Samarkand":"UZ",
  "Asia/Seoul":"KR","Asia/Shanghai":"CN","Asia/Singapore":"SG","Asia/Srednekolymsk":"RU",
  "Asia/Taipei":"TW","Asia/Tashkent":"UZ","Asia/Tbilisi":"GE","Asia/Tehran":"IR",
  "Asia/Thimphu":"BT","Asia/Tokyo":"JP","Asia/Tomsk":"RU","Asia/Ulaanbaatar":"MN",
  "Asia/Urumqi":"CN","Asia/Ust-Nera":"RU","Asia/Vientiane":"LA","Asia/Vladivostok":"RU",
  "Asia/Yakutsk":"RU","Asia/Yangon":"MM","Asia/Yekaterinburg":"RU","Asia/Yerevan":"AM",
  "Atlantic/Azores":"PT","Atlantic/Bermuda":"BM","Atlantic/Canary":"ES","Atlantic/Cape_Verde":"CV",
  "Atlantic/Faroe":"FO","Atlantic/Madeira":"PT","Atlantic/Reykjavik":"IS","Atlantic/South_Georgia":"GS",
  "Atlantic/St_Helena":"SH","Atlantic/Stanley":"FK",
  "Australia/Adelaide":"AU","Australia/Brisbane":"AU","Australia/Broken_Hill":"AU",
  "Australia/Darwin":"AU","Australia/Eucla":"AU","Australia/Hobart":"AU","Australia/Lindeman":"AU",
  "Australia/Lord_Howe":"AU","Australia/Melbourne":"AU","Australia/Perth":"AU","Australia/Sydney":"AU",
  "Europe/Amsterdam":"NL","Europe/Andorra":"AD","Europe/Astrakhan":"RU","Europe/Athens":"GR",
  "Europe/Belgrade":"RS","Europe/Berlin":"DE","Europe/Bratislava":"SK","Europe/Brussels":"BE",
  "Europe/Bucharest":"RO","Europe/Budapest":"HU","Europe/Busingen":"DE","Europe/Chisinau":"MD",
  "Europe/Copenhagen":"DK","Europe/Dublin":"IE","Europe/Gibraltar":"GI","Europe/Guernsey":"GG",
  "Europe/Helsinki":"FI","Europe/Isle_of_Man":"IM","Europe/Istanbul":"TR","Europe/Jersey":"JE",
  "Europe/Kaliningrad":"RU","Europe/Kiev":"UA","Europe/Kirov":"RU","Europe/Lisbon":"PT",
  "Europe/Ljubljana":"SI","Europe/London":"GB","Europe/Luxembourg":"LU","Europe/Madrid":"ES",
  "Europe/Malta":"MT","Europe/Mariehamn":"AX","Europe/Minsk":"BY","Europe/Monaco":"MC",
  "Europe/Moscow":"RU","Europe/Nicosia":"CY","Europe/Oslo":"NO","Europe/Paris":"FR",
  "Europe/Podgorica":"ME","Europe/Prague":"CZ","Europe/Riga":"LV","Europe/Rome":"IT",
  "Europe/Samara":"RU","Europe/San_Marino":"SM","Europe/Sarajevo":"BA","Europe/Saratov":"RU",
  "Europe/Simferopol":"RU","Europe/Skopje":"MK","Europe/Sofia":"BG","Europe/Stockholm":"SE",
  "Europe/Tallinn":"EE","Europe/Tirane":"AL","Europe/Ulyanovsk":"RU","Europe/Uzhgorod":"UA",
  "Europe/Vaduz":"LI","Europe/Vatican":"VA","Europe/Vienna":"AT","Europe/Vilnius":"LT",
  "Europe/Volgograd":"RU","Europe/Warsaw":"PL","Europe/Zagreb":"HR","Europe/Zaporozhye":"UA",
  "Europe/Zurich":"CH",
  "Indian/Antananarivo":"MG","Indian/Chagos":"IO","Indian/Christmas":"CX","Indian/Cocos":"CC",
  "Indian/Comoro":"KM","Indian/Kerguelen":"TF","Indian/Mahe":"SC","Indian/Maldives":"MV",
  "Indian/Mauritius":"MU","Indian/Mayotte":"YT","Indian/Reunion":"RE",
  "Pacific/Apia":"WS","Pacific/Auckland":"NZ","Pacific/Bougainville":"PG","Pacific/Chatham":"NZ",
  "Pacific/Chuuk":"FM","Pacific/Easter":"CL","Pacific/Efate":"VU","Pacific/Enderbury":"KI",
  "Pacific/Fakaofo":"TK","Pacific/Fiji":"FJ","Pacific/Funafuti":"TV","Pacific/Galapagos":"EC",
  "Pacific/Gambier":"PF","Pacific/Guadalcanal":"SB","Pacific/Guam":"GU","Pacific/Honolulu":"US",
  "Pacific/Kiritimati":"KI","Pacific/Kosrae":"FM","Pacific/Kwajalein":"MH","Pacific/Majuro":"MH",
  "Pacific/Marquesas":"PF","Pacific/Midway":"UM","Pacific/Nauru":"NR","Pacific/Niue":"NU",
  "Pacific/Norfolk":"NF","Pacific/Noumea":"NC","Pacific/Pago_Pago":"AS","Pacific/Palau":"PW",
  "Pacific/Pitcairn":"PN","Pacific/Pohnpei":"FM","Pacific/Port_Moresby":"PG","Pacific/Rarotonga":"CK",
  "Pacific/Saipan":"MP","Pacific/Tahiti":"PF","Pacific/Tarawa":"KI","Pacific/Tongatapu":"TO",
  "Pacific/Wake":"UM","Pacific/Wallis":"WF",
};

function getCountryFromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return TZ_COUNTRY[tz] ?? null;
  } catch {
    return null;
  }
}

const COUNTRY_CACHE_KEY = "goo_country";
const COUNTRY_CACHE_TS  = "goo_country_ts";
const COUNTRY_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 h

// Returns the visitor's real country via Cloudflare's public trace endpoint.
// Response is cached in localStorage for 24 h so it's only fetched once per day.
// Falls back to timezone-based heuristic when the fetch fails.
export async function getCountryCode(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const cached = localStorage.getItem(COUNTRY_CACHE_KEY);
    const cachedTs = Number(localStorage.getItem(COUNTRY_CACHE_TS) ?? "0");
    if (cached && Date.now() - cachedTs < COUNTRY_CACHE_TTL) return cached;
  } catch { /* ignore storage errors */ }

  try {
    const res = await fetch("https://cloudflare.com/cdn-cgi/trace", {
      signal: AbortSignal.timeout(2500),
    });
    const text = await res.text();
    const m = /^loc=([A-Z]{2})$/m.exec(text);
    const code = m?.[1] ?? null;
    if (code) {
      try {
        localStorage.setItem(COUNTRY_CACHE_KEY, code);
        localStorage.setItem(COUNTRY_CACHE_TS, String(Date.now()));
      } catch { /* ignore */ }
      return code;
    }
  } catch { /* network error — fall through */ }

  return getCountryFromTimezone();
}

// Post a payload without blocking navigation.
// sendBeacon falls back to fetch(keepalive) for older browsers.
export function beacon(url: string, data: unknown): void {
  try {
    const body = JSON.stringify(data);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon(url, blob);
      if (ok) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* swallow — analytics must never break the page */
  }
}
