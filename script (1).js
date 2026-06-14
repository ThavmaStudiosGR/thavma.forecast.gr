// ================================================================
// THAVMA FORECAST V9 — script.js
// Rate-limited fetches, fallbacks MET Norway + wttr.in
// Night descriptions fix, loading screen, search/favorites fix
// ================================================================
document.addEventListener("DOMContentLoaded", () => {
  // ================================================================
  // 1. STATE
  // ================================================================
  let state = {
    city: "Αθήνα",
    fullLocation: "Αθήνα, Αττική, Ελλάδα",
    unit: "C",
    theme: "dynamic",
    lang: "GR",
    refresh: "manual",
    lat: 37.9838,
    lon: 23.7275,
    favorites: ["Αθήνα", "Θεσσαλονίκη", "Πάτρα"],
    countryCode: "GR",
    model: "best_match",
    windUnit: "kmh",
    timezone: "Europe/Athens",
  };
  let lastForecastData = null,
    lastOWMData = null,
    realisticAnimFrame = null;
  let liveRefreshInterval = null,
    localClockInterval = null;
  let liveStatsLog = [],
    liveStatsTimer = null,
    chartInstances = {};
  let historicalFetchCache = {};
  let alertsList = [],
    alertIdx = 0;
  const OWM_KEY = "5796b108674015391a0c81d217ed0352";
  let currentWindyLayer = "rain",
    currentWindyModel = "ecmwf";
  let currentHercSlug = "precipitation";

  try {
    const s = localStorage.getItem("thavmaV9");
    if (s) state = { ...state, ...JSON.parse(s) };
  } catch (e) {}

  [
    "unitSelect",
    "themeSelect",
    "langSelect",
    "refreshSelect",
    "modelSelect",
    "windUnitSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      const key = id.replace("Select", "");
      if (state[key]) el.value = state[key];
    }
  });

  function saveState() {
    try {
      localStorage.setItem("thavmaV9", JSON.stringify(state));
    } catch (e) {}
    renderFavorites();
    updateHeartStatus();
  }

  // ================================================================
  // 2. LOADING SCREEN
  // ================================================================
  function showLoading(msg) {
    const ls = document.getElementById("loadingScreen");
    const lt = document.getElementById("loadingText");
    if (ls) ls.classList.remove("hidden");
    if (lt && msg) lt.innerText = msg;
  }
  function hideLoading() {
    const ls = document.getElementById("loadingScreen");
    if (ls) {
      ls.style.opacity = "0";
      setTimeout(() => ls.classList.add("hidden"), 400);
    }
  }

  // ================================================================
  // 3. DICTIONARY
  // ================================================================
  const dict = {
    GR: {
      now: "Τώρα",
      hourly: "Ωριαία",
      daily: "Ημερήσια",
      stats: "Στατιστικά",
      map: "Χάρτης",
      home: "Αρχική",
      search: "Αναζήτηση περιοχής...",
      analysis: "● LIVE",
      settings: "Ρυθμίσεις",
      feels: "Αίσθηση",
      humidity: "Υγρασία",
      pressure: "Πίεση",
      uv: "UV Δείκτης",
      wind: "Άνεμος",
      rain_prob: "Πιθ. Βροχής",
      sunrise: "Ανατολή",
      sunset: "Δύση",
      dew: "Σημείο Δρόσου",
      today: "Σήμερα",
      morning: "Πρωί",
      evening: "Βράδυ",
      max_wind: "Μέγ. Άνεμος",
      precip: "Υετός",
      now_label: "Τώρα",
      local_time: "τοπική ώρα",
      weather_desc: {
        0: "Ηλιοφάνεια",
        1: "Κυρίως Ηλιοφάνεια",
        2: "Μερικώς Νεφελώδης",
        3: "Νεφελώδης",
        45: "Ομίχλη",
        48: "Πάχνη",
        51: "Παροδικές Βροχές",
        53: "Παροδικές Βροχές",
        55: "Ασθενής Βροχόπτωση",
        61: "Ασθενής Βροχόπτωση",
        63: "Βροχή",
        65: "Ισχυρή Βροχόπτωση ⚠️",
        66: "Χιονόνερο",
        67: "Χιονόνερο ⚠️",
        71: "Παροδικές Χιονοπτώσεις",
        73: "Ασθενείς Χιονοπτώσεις",
        75: "Χιονοπτώσεις",
        77: "Χαλαζοπτώσεις ⚠️",
        80: "Παροδικές Βροχές",
        81: "Βροχή",
        82: "Ισχυρή Βροχόπτωση ⚠️",
        85: "Χαλαζοπτώσεις ⚠️",
        86: "Ισχυρή Χαλαζόπτωση ⚠️⚠️",
        95: "Καταιγίδες ",
        96: "Ισχυρές Καταιγίδες ⚠️",
        99: "Σφοδρές Καταιγίδες ⚠️⚠️",
      },
      wind_dirs: ["Β", "ΒΑ", "Α", "ΝΑ", "Ν", "ΝΔ", "Δ", "ΒΔ"],
      day_labels: ["Κυρ", "Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ"],
    },
    EN: {
      now: "Now",
      hourly: "Hourly",
      daily: "Daily",
      stats: "Stats",
      map: "Map",
      home: "Home",
      search: "Search location...",
      analysis: "● LIVE",
      settings: "Settings",
      feels: "Feels Like",
      humidity: "Humidity",
      pressure: "Pressure",
      uv: "UV Index",
      wind: "Wind",
      rain_prob: "Rain Prob.",
      sunrise: "Sunrise",
      sunset: "Sunset",
      dew: "Dew Point",
      today: "Today",
      morning: "Morning",
      evening: "Evening",
      max_wind: "Max Wind",
      precip: "Precip.",
      now_label: "Now",
      local_time: "local time",
      weather_desc: {
        0: "Clear Sky",
        1: "Mainly Clear",
        2: "Partly Cloudy",
        3: "Overcast",
        45: "Fog",
        48: "Icy Fog",
        51: "Occasional Rain",
        53: "Occasional Rain",
        55: "Light Rain",
        61: "Light Rain",
        63: "Rain",
        65: "Heavy Rain ⚠️",
        66: "Sleet",
        67: "Heavy Sleet ⚠️",
        71: "Occasional Snow",
        73: "Light Snow",
        75: "Snowfall",
        77: "Hail ⚠️",
        80: "Occasional Rain",
        81: "Rain",
        82: "Heavy Rain ⚠️",
        85: "Hail ⚠️",
        86: "Heavy Hail ⚠️⚠️",
        95: "Thunderstorm",
        96: "Strong Thunderstorm ⚠️",
        99: "Severe Thunderstorm ⚠️⚠️",
      },
      wind_dirs: ["N", "NE", "E", "SE", "S", "SW", "W", "NW"],
      day_labels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    },
  };

  function t(k) {
    return (dict[state.lang] || dict.GR)[k] || dict.GR[k] || k;
  }
  // td with isDay: night shows Αίθριος instead of Ηλιοφάνεια
  function td(code, isDay = 1) {
    const d = (dict[state.lang] || dict.GR).weather_desc || {};
    const dGR = dict.GR.weather_desc || {};
    let desc = d[code] || dGR[code] || "—";
    if (!isDay) {
      if (code === 0) desc = state.lang === "GR" ? "Αίθριος" : "Clear";
      if (code === 1)
        desc = state.lang === "GR" ? "Κυρίως Αίθριος" : "Mainly Clear";
    }
    return desc;
  }
  function windDir(deg) {
    return (dict[state.lang] || dict.GR).wind_dirs[Math.round(deg / 45) % 8];
  }

  // ================================================================
  // 4. UTILITIES
  // ================================================================
  function formatTemp(c) {
    return state.unit === "F"
      ? Math.round((c * 9) / 5 + 32) + "°F"
      : Math.round(c) + "°C";
  }
  function formatWind(kmh) {
    if (state.windUnit === "ms") return Math.round(kmh / 3.6) + " m/s";
    if (state.windUnit === "knots") return Math.round(kmh * 0.539957) + " kn";
    return Math.round(kmh) + " km/h";
  }
  function getBeaufort(kmh) {
    if (kmh < 1) return 0;
    if (kmh < 6) return 1;
    if (kmh < 12) return 2;
    if (kmh < 20) return 3;
    if (kmh < 29) return 4;
    if (kmh < 39) return 5;
    if (kmh < 50) return 6;
    if (kmh < 62) return 7;
    if (kmh < 75) return 8;
    if (kmh < 89) return 9;
    if (kmh < 103) return 10;
    if (kmh < 118) return 11;
    return 12;
  }
  function getUVLabel(uv) {
    if (uv < 3) return { label: "Χαμηλός", color: "#4caf50" };
    if (uv < 6) return { label: "Μέτριος", color: "#ffeb3b" };
    if (uv < 8) return { label: "Υψηλός", color: "#ff9800" };
    if (uv < 11) return { label: "Πολύ Υψηλός", color: "#f44336" };
    return { label: "Ακραίος", color: "#9c27b0" };
  }
  function calcDewPoint(tempC, humidity) {
    const a = 17.27,
      b = 237.7;
    const alpha = (a * tempC) / (b + tempC) + Math.log(humidity / 100);
    return Math.round((b * alpha) / (a - alpha));
  }
  function isSevereCode(code) {
    return code >= 80;
  }
  function setEl(id, val) {
    const e = document.getElementById(id);
    if (e) e.innerText = val;
  }
  function setHTML(id, val) {
    const e = document.getElementById(id);
    if (e) e.innerHTML = val;
  }

  // ================================================================
  // 5. LOCAL TIME
  // ================================================================
  function getLocalTime(tz) {
    try {
      return new Date().toLocaleTimeString("el-GR", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch (e) {
      return new Date().toLocaleTimeString();
    }
  }
  function getLocalHour(tz) {
    try {
      return parseInt(
        new Date().toLocaleTimeString("en-US", {
          timeZone: tz,
          hour: "2-digit",
          hour12: false,
        })
      );
    } catch (e) {
      return new Date().getHours();
    }
  }
  function startLocalClock() {
    if (localClockInterval) clearInterval(localClockInterval);
    function tick() {
      const tz = state.timezone || "UTC";
      const s = getLocalTime(tz);
      setEl("uniLocalTime", s);
      setEl("nowLocalTime", s + " " + (t("local_time") || "τοπική ώρα"));
    }
    tick();
    localClockInterval = setInterval(tick, 1000);
  }
  function getCurrentHourIndex(times, tz) {
    const h = getLocalHour(tz || "UTC");
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: tz || "UTC",
    });
    let idx = times.findIndex((t) => {
      if (!t) return false;
      const [d, tp] = t.split("T");
      return d === today && parseInt((tp || "00").split(":")[0]) === h;
    });
    if (idx < 0) idx = times.findIndex((t) => t && t.startsWith(today));
    return idx < 0 ? 0 : idx;
  }

  // ================================================================
  // 6. RATE-LIMITED FETCH ENGINE (fixes "too many requests")
  // ================================================================
  let __apiQueue = Promise.resolve(),
    __lastApiCallAt = 0;
  const __sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  async function fetchWithTimeout(url, opts = {}, timeout = 12000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
      return await fetch(url, { ...opts, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function queuedFetch(url) {
    const isWeatherApi = /open-meteo\.com/.test(url);
    if (!isWeatherApi) return fetchWithTimeout(url, {}, 12000);
    const run = async () => {
      const gap = Date.now() - __lastApiCallAt;
      if (gap < 800) await __sleep(800 - gap);
      __lastApiCallAt = Date.now();
      return fetchWithTimeout(url, {}, 12000);
    };
    const next = __apiQueue.then(run, run);
    __apiQueue = next.catch(() => {});
    return next;
  }

  async function fetchJSONRetry(url, retries = 4, delay = 1500) {
    for (let i = 0; i <= retries; i++) {
      try {
        const r = await queuedFetch(url);
        if (r.status === 429) {
          const retryAfter =
            parseFloat(r.headers.get("retry-after") || "0") * 1000;
          await __sleep(retryAfter || delay * Math.pow(2, i));
          continue;
        }
        if (!r.ok) throw new Error("HTTP " + r.status);
        return await r.json();
      } catch (e) {
        if (i === retries) throw e;
        await __sleep(delay * Math.pow(2, i));
      }
    }
  }
  window.__fetchJSONRetry = fetchJSONRetry;

  // ================================================================
  // 7. FALLBACK ENGINES (MET Norway + wttr.in)
  // ================================================================
  function toLocalIsoHour(iso, tz) {
    try {
      return new Date(iso)
        .toLocaleString("sv-SE", {
          timeZone: tz || "Europe/Athens",
          hour12: false,
        })
        .replace(" ", "T")
        .substring(0, 16);
    } catch (e) {
      return (iso || "").replace("Z", "").substring(0, 16);
    }
  }
  function metSymbolToCode(symbol = "") {
    const s = String(symbol).toLowerCase();
    if (s.includes("thunder")) return s.includes("heavy") ? 96 : 95;
    if (s.includes("sleet")) return s.includes("heavy") ? 67 : 66;
    if (s.includes("snow"))
      return s.includes("heavy") ? 75 : s.includes("light") ? 71 : 73;
    if (s.includes("rain")) {
      if (s.includes("heavy")) return s.includes("showers") ? 82 : 65;
      if (s.includes("light")) return s.includes("showers") ? 80 : 61;
      return s.includes("showers") ? 81 : 63;
    }
    if (s.includes("fog")) return 45;
    if (s.includes("cloudy")) return s.includes("partly") ? 2 : 3;
    if (s.includes("fair")) return 1;
    if (s.includes("clear")) return 0;
    return 2;
  }
  function buildFallbackFromMetNo(metData, tz) {
    const series = metData?.properties?.timeseries || [];
    if (!series.length) throw new Error("MET Norway empty");
    const hourly = {
      time: [],
      temperature_2m: [],
      weathercode: [],
      precipitation_probability: [],
      precipitation: [],
      apparent_temperature: [],
      relative_humidity_2m: [],
      surface_pressure: [],
      windspeed_10m: [],
      winddirection_10m: [],
      is_day: [],
      uv_index: [],
    };
    const byDay = {};
    series.slice(0, 24 * 14).forEach((item) => {
      const details = item.data?.instant?.details || {};
      const next =
        item.data?.next_1_hours ||
        item.data?.next_6_hours ||
        item.data?.next_12_hours ||
        {};
      const local = toLocalIsoHour(item.time, tz);
      const hour = parseInt(local.split("T")[1]?.split(":")[0] || "12");
      const temp = Number(details.air_temperature ?? 0);
      const symbol = next.summary?.symbol_code || "partlycloudy_day";
      const code = metSymbolToCode(symbol);
      const amount = Number(next.details?.precipitation_amount ?? 0);
      const windKmh = Number(details.wind_speed ?? 0) * 3.6;
      const humidity = Number(details.relative_humidity ?? 0);
      hourly.time.push(local);
      hourly.temperature_2m.push(temp);
      hourly.weathercode.push(code);
      hourly.precipitation_probability.push(
        amount > 0
          ? Math.min(95, Math.round(35 + amount * 30))
          : code >= 51
          ? 25
          : 0
      );
      hourly.precipitation.push(amount);
      hourly.apparent_temperature.push(
        Math.round(
          (temp + (humidity > 70 ? 1 : 0) - (windKmh > 25 ? 1 : 0)) * 10
        ) / 10
      );
      hourly.relative_humidity_2m.push(Math.round(humidity));
      hourly.surface_pressure.push(
        Number(details.air_pressure_at_sea_level ?? 1013)
      );
      hourly.windspeed_10m.push(Math.round(windKmh));
      hourly.winddirection_10m.push(Number(details.wind_from_direction ?? 0));
      hourly.is_day.push(hour >= 7 && hour < 20 ? 1 : 0);
      hourly.uv_index.push(0);
      const day = local.split("T")[0];
      byDay[day] ||
        (byDay[day] = {
          temps: [],
          codes: [],
          pops: [],
          winds: [],
          dirs: [],
          rain: 0,
        });
      byDay[day].temps.push(temp);
      byDay[day].codes.push(code);
      byDay[day].pops.push(hourly.precipitation_probability.at(-1));
      byDay[day].winds.push(Math.round(windKmh));
      byDay[day].dirs.push(Number(details.wind_from_direction ?? 0));
      byDay[day].rain += amount;
    });
    const days = Object.keys(byDay).slice(0, 14);
    const sev = (c) =>
      c >= 95
        ? 900
        : c >= 80
        ? 800
        : c >= 71
        ? 700
        : c >= 61
        ? 600
        : c >= 51
        ? 500
        : c >= 45
        ? 400
        : c >= 3
        ? 300
        : c;
    const daily = {
      time: [],
      temperature_2m_max: [],
      temperature_2m_min: [],
      weathercode: [],
      precipitation_probability_max: [],
      windspeed_10m_max: [],
      winddirection_10m_dominant: [],
      sunrise: [],
      sunset: [],
      uv_index_max: [],
      precipitation_sum: [],
    };
    days.forEach((day) => {
      const d = byDay[day];
      const worst = d.codes.reduce(
        (a, b) => (sev(b) > sev(a) ? b : a),
        d.codes[0] ?? 2
      );
      daily.time.push(day);
      daily.temperature_2m_max.push(Math.max(...d.temps));
      daily.temperature_2m_min.push(Math.min(...d.temps));
      daily.weathercode.push(worst);
      daily.precipitation_probability_max.push(Math.max(...d.pops, 0));
      daily.windspeed_10m_max.push(Math.max(...d.winds, 0));
      daily.winddirection_10m_dominant.push(
        d.dirs[Math.floor(d.dirs.length / 2)] || 0
      );
      daily.sunrise.push(`${day}T06:05`);
      daily.sunset.push(`${day}T20:35`);
      daily.uv_index_max.push(0);
      daily.precipitation_sum.push(Math.round(d.rain * 10) / 10);
    });
    const i = getCurrentHourIndex(hourly.time, tz);
    return {
      timezone: tz || state.timezone,
      hourly,
      daily,
      current_weather: {
        temperature: hourly.temperature_2m[i] ?? hourly.temperature_2m[0],
        windspeed: hourly.windspeed_10m[i] ?? 0,
        winddirection: hourly.winddirection_10m[i] ?? 0,
        weathercode: hourly.weathercode[i] ?? 2,
        is_day: hourly.is_day[i] ?? 1,
        time: hourly.time[i] || hourly.time[0],
      },
      _source: "MET Norway",
    };
  }
  async function fetchMetNoForecast(lat, lon, tz) {
    const r = await fetchWithTimeout(
      `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`,
      {},
      9000
    );
    if (!r.ok) throw new Error("MET Norway HTTP " + r.status);
    return buildFallbackFromMetNo(await r.json(), tz);
  }

  // ================================================================
  // 8. MAIN FETCH (with rate limiting + fallbacks)
  // ================================================================
  let __fetchInFlight = false;
  async function fetchWeather(forcedCity) {
    if (__fetchInFlight) return;
    __fetchInFlight = true;
    showLoading(
      state.lang === "GR"
        ? "Η ιστοσελίδα φορτώνει... παρακαλώ περιμένετε!"
        : "This website is loading... please wait!"
    );
    const query =
      forcedCity ||
      document.getElementById("cityInput")?.value.trim() ||
      state.city;
    try {
      const langCode = state.lang === "GR" ? "el" : "en";
      // Geocoding
      const geo = await fetchJSONRetry(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          query
        )}&count=1&language=${langCode}`
      );
      if (!geo.results?.length) {
        setEl(
          "nowCity",
          state.lang === "GR" ? "Δεν βρέθηκε η περιοχή" : "Location not found"
        );
        hideLoading();
        return;
      }
      const loc = geo.results[0];
      let parts = [loc.name];
      if (loc.admin1 && loc.admin1 !== loc.name) parts.push(loc.admin1);
      if (loc.country) parts.push(loc.country);
      const fullLoc = parts.join(", ");
      state.city = loc.name;
      state.fullLocation = fullLoc;
      state.lat = loc.latitude;
      state.lon = loc.longitude;
      state.countryCode = loc.country_code || "";
      state.timezone = loc.timezone || "UTC";
      saveState();
      startLocalClock();
      historicalFetchCache = {};

      // Primary: Open-Meteo (queued, rate-limited)
      let forecast;
      try {
        forecast = await fetchJSONRetry(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
            `&current_weather=true` +
            `&hourly=temperature_2m,weathercode,precipitation_probability,precipitation,apparent_temperature,relative_humidity_2m,surface_pressure,windspeed_10m,winddirection_10m,is_day` +
            `&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max,windspeed_10m_max,winddirection_10m_dominant,sunrise,sunset,uv_index_max,precipitation_sum` +
            `&forecast_days=14&models=${
              state.model || "best_match"
            }&timezone=auto`,
          2,
          1000
        );
      } catch (primaryErr) {
        console.warn(
          "Open-Meteo failed, trying MET Norway fallback",
          primaryErr
        );
        try {
          forecast = await fetchMetNoForecast(
            loc.latitude,
            loc.longitude,
            loc.timezone || state.timezone
          );
        } catch (fallbackErr) {
          console.warn("MET Norway failed too", fallbackErr);
          setEl(
            "nowCity",
            state.lang === "GR"
              ? "Δεν φορτώθηκαν δεδομένα — ξαναδοκίμασε"
              : "Data failed — try again"
          );
          hideLoading();
          return;
        }
      }

      // UV — separate queued fetch (best_match always has uv_index)
      try {
        const uvData = await fetchJSONRetry(
          `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&hourly=uv_index&daily=uv_index_max&forecast_days=14&models=best_match&timezone=auto`,
          1,
          800
        );
        if (uvData.hourly?.uv_index)
          forecast.hourly.uv_index = uvData.hourly.uv_index.map((v) => v ?? 0);
        if (uvData.daily?.uv_index_max)
          forecast.daily.uv_index_max = uvData.daily.uv_index_max.map(
            (v) => v ?? 0
          );
      } catch (e) {
        /* UV optional */
      }

      if (!forecast.daily.uv_index_max)
        forecast.daily.uv_index_max = new Array(14).fill(0);
      if (!forecast.hourly.uv_index)
        forecast.hourly.uv_index = new Array(forecast.hourly.time.length).fill(
          0
        );

      // OWM live current (non-queued, different API)
      let owm = {};
      try {
        const owmRes = await fetchWithTimeout(
          `https://api.openweathermap.org/data/2.5/weather?lat=${loc.latitude}&lon=${loc.longitude}&appid=5796b108674015391a0c81d217ed0352&units=metric&lang=${langCode}`,
          {},
          8000
        );
        if (owmRes.ok) owm = await owmRes.json();
      } catch (e) {
        /* OWM optional, forecast fallback used */
      }

      if (forecast.timezone) state.timezone = forecast.timezone;
      lastForecastData = forecast;
      lastOWMData = owm;

      renderDashboard(forecast, owm, fullLoc);
      renderStatsTab(forecast);
      initLiveStats();
      fetchHistoricalStats(state.lat, state.lon);

      const stEl = document.getElementById("stationName");
      if (stEl) {
        const mn = {
          best_match: "Open-Meteo",
          ecmwf_ifs025: "ECMWF IFS",
          gfs_seamless: "GFS",
          ecmwf_aifs025: "ECMWF AI",
          icon_seamless: "ICON",
          meteofrance_seamless: "Météo-France",
          gem_seamless: "GEM",
        };
        stEl.innerText =
          (forecast._source || mn[state.model] || "Open-Meteo") +
          (owm.main ? " + OWM" : "");
      }
      setEl(
        "statsLastUpdate",
        (state.lang === "GR" ? "Τελευταία ανανέωση: " : "Last update: ") +
          new Date().toLocaleTimeString(state.lang === "GR" ? "el-GR" : "en-US")
      );
      hideLoading();
    } catch (e) {
      console.error("fetchWeather:", e);
      setEl(
        "nowCity",
        state.lang === "GR"
          ? "Σφάλμα σύνδεσης — ξαναδοκίμασε"
          : "Connection error — try again"
      );
      hideLoading();
    } finally {
      __fetchInFlight = false;
    }
  }

  // ================================================================
  // 9. ALERTS SYSTEM
  // ================================================================
  function buildAllAlerts(forecastData, owmData, hIdx) {
    const alerts = [];
    const isGR = state.lang === "GR";
    if (forecastData?.daily) {
      const windMax = forecastData.daily.windspeed_10m_max[0] || 0;
      const maxT = forecastData.daily.temperature_2m_max[0] || 0;
      const minT = forecastData.daily.temperature_2m_min[0] || 0;
      const rainSum = forecastData.daily.precipitation_sum?.[0] ?? 0;
      const uvMax = forecastData.daily.uv_index_max?.[0] ?? 0;
      let worstCode = forecastData.current_weather?.weathercode || 0;
      let worstTime = "";
      if (forecastData.hourly) {
        for (let i = hIdx; i < hIdx + 24; i++) {
          const c = forecastData.hourly.weathercode?.[i] || 0;
          if (c > worstCode) {
            worstCode = c;
            worstTime =
              forecastData.hourly.time?.[i]?.split("T")[1]?.substring(0, 5) ||
              "";
          }
        }
      }
      if (worstCode >= 99)
        alerts.push({
          level: "red",
          icon: "🔴",
          badge: isGR ? "ΚΟΚΚΙΝΗ" : "RED",
          msg: isGR
            ? `Σφοδρές καταιγίδες${
                worstTime ? " στις " + worstTime : ""
              }! Αποφύγετε μετακινήσεις.`
            : `Severe thunderstorms${
                worstTime ? " at " + worstTime : ""
              }! Avoid travel.`,
        });
      else if (worstCode >= 95)
        alerts.push({
          level: "orange",
          icon: "🟠",
          badge: isGR ? "ΠΟΡΤΟΚΑΛΙ" : "ORANGE",
          msg: isGR
            ? `Καταιγίδες${
                worstTime ? " στις " + worstTime : ""
              }. Πιθανές τοπικές πλημμύρες ή θύελλες! Μείνετε σε εσωτερικούς χώρους και ακολουθήστε τις οδηγίες των αρχών.`
            : `Thunderstorms${
                worstTime ? " at " + worstTime : ""
              }. Possible floods or severe thunderstorms! Stay inside and follow the instructions of the Authorities.`,
        });
      else if (worstCode >= 80 || rainSum > 30)
        alerts.push({
          level: "yellow",
          icon: "🟡",
          badge: isGR ? "ΚΙΤΡΙΝΗ" : "YELLOW",
          msg: isGR
            ? `Βροχοπτώσεις κατά διαστήματα ισχυρές.${
                worstTime ? " στις " + worstTime : "/ τώρα"
              }. Πιθανές τοπικές πλημμύρες.`
            : `Heavy rain${
                worstTime ? " at " + worstTime : "/ now"
              }. Possible flooding.`,
        });
      if (windMax >= 100)
        alerts.push({
          level: "red",
          icon: "🔴",
          badge: isGR ? "ΚΟΚΚΙΝΗ" : "RED",
          msg: isGR
            ? `Εξαιρετικά ισχυροί άνεμοι ${getBeaufort(
                windMax
              )} Μποφόρ (${Math.round(windMax)} km/h)!`
            : `Extremely strong winds ${getBeaufort(windMax)} Bft (${Math.round(
                windMax
              )} km/h)!`,
        });
      else if (windMax >= 75)
        alerts.push({
          level: "orange",
          icon: "🟠",
          badge: isGR ? "ΠΟΡΤΟΚΑΛΙ" : "ORANGE",
          msg: isGR
            ? `Ισχυροί άνεμοι ${getBeaufort(windMax)} Μποφόρ (${Math.round(
                windMax
              )} km/h).`
            : `Strong winds ${getBeaufort(windMax)} Bft (${Math.round(
                windMax
              )} km/h).`,
        });
      else if (windMax >= 50)
        alerts.push({
          level: "yellow",
          icon: "🟡",
          badge: isGR ? "ΚΙΤΡΙΝΗ" : "YELLOW",
          msg: isGR
            ? `Αυξημένοι άνεμοι ${getBeaufort(windMax)} Μποφόρ (${Math.round(
                windMax
              )} km/h).`
            : `Elevated winds ${getBeaufort(windMax)} Bft (${Math.round(
                windMax
              )} km/h).`,
        });
      if (maxT >= 42)
        alerts.push({
          level: "red",
          icon: "🔴",
          badge: isGR ? "ΚΟΚΚΙΝΗ" : "RED",
          msg: isGR
            ? `Καύσωνας! Μέγιστη ${Math.round(maxT)}°C. Κίνδυνος για τη ζωή!`
            : `Extreme heat! Max ${Math.round(maxT)}°C. Life-threatening!`,
        });
      else if (maxT >= 38)
        alerts.push({
          level: "orange",
          icon: "🟠",
          badge: isGR ? "ΠΟΡΤΟΚΑΛΙ" : "ORANGE",
          msg: isGR
            ? `Ισχυρός καύσωνας! Μέγιστη ${Math.round(maxT)}°C.`
            : `Severe heat! Max ${Math.round(maxT)}°C.`,
        });
      else if (maxT >= 35)
        alerts.push({
          level: "yellow",
          icon: "🟡",
          badge: isGR ? "ΚΙΤΡΙΝΗ" : "YELLOW",
          msg: isGR
            ? `Υψηλές θερμοκρασίες ${Math.round(maxT)}°C.`
            : `High temperatures ${Math.round(maxT)}°C.`,
        });
      if (minT <= -10)
        alerts.push({
          level: "orange",
          icon: "🟠",
          badge: isGR ? "ΠΟΡΤΟΚΑΛΙ" : "ORANGE",
          msg: isGR
            ? `Ισχυρός παγετός! Ελάχιστη ${Math.round(minT)}°C.`
            : `Severe frost! Min ${Math.round(minT)}°C.`,
        });
      else if (minT <= 0)
        alerts.push({
          level: "yellow",
          icon: "🟡",
          badge: isGR ? "ΚΙΤΡΙΝΗ" : "YELLOW",
          msg: isGR
            ? `Παγετός! Ελάχιστη ${Math.round(minT)}°C.`
            : `Frost! Min ${Math.round(minT)}°C.`,
        });
      if (worstCode >= 73 && worstCode <= 77)
        alerts.push({
          level: "orange",
          icon: "🟠",
          badge: isGR ? "ΠΟΡΤΟΚΑΛΙ" : "ORANGE",
          msg: isGR
            ? `Χιονόπτωση${
                worstTime ? " στις " + worstTime : ""
              }. Δυσκολίες στις μετακινήσεις.`
            : `Snowfall${
                worstTime ? " at " + worstTime : ""
              }. Travel difficulties.`,
        });
      if (uvMax >= 11)
        alerts.push({
          level: "red",
          icon: "☀️",
          badge: isGR ? "UV ΑΚΡΑΙΟΣ" : "UV EXTREME",
          msg: isGR
            ? `Ακραίος UV: ${uvMax.toFixed(1)}! Αποφύγετε έκθεση στον ήλιο.`
            : `Extreme UV: ${uvMax.toFixed(1)}! Avoid sun exposure.`,
        });
      else if (uvMax >= 8)
        alerts.push({
          level: "orange",
          icon: "☀️",
          badge: isGR ? "UV ΥΨΗΛΟΣ" : "UV HIGH",
          msg: isGR
            ? `Υψηλός UV: ${uvMax.toFixed(1)}. Αντηλιακό, γυαλιά, καπέλο!`
            : `High UV: ${uvMax.toFixed(1)}. Sunscreen, glasses, hat!`,
        });
    }
    // Satirical if no serious alerts
    if (alerts.length === 0 && forecastData?.hourly) {
      for (let offset = 0; offset < 6; offset++) {
        const i = hIdx + offset;
        const code = forecastData.hourly.weathercode?.[i];
        const timeStr =
          forecastData.hourly.time?.[i]?.split("T")[1]?.substring(0, 5) || "";
        const label =
          offset === 0
            ? isGR
              ? "τώρα"
              : "now"
            : isGR
            ? `σε ~${offset}ω`
            : `in ~${offset}h`;
        if (
          code >= 51 &&
          code <= 82 &&
          code !== 71 &&
          code !== 73 &&
          code !== 75 &&
          code !== 77
        ) {
          alerts.push({
            level: "info",
            icon: "🌂",
            badge: isGR ? "ΒΡΟΧΗ" : "RAIN",
            msg: isGR
              ? `🌂 Πάρτε ομπρελίτσα! Βροχή ${label} (${timeStr})!`
              : `🌂 Grab your umbrella! Rain ${label} (${timeStr})!`,
          });
          break;
        }
        if (code >= 95) {
          alerts.push({
            level: "orange",
            icon: "",
            badge: isGR ? "ΚΑΤΑΙΓΙΔΑ" : "STORM",
            msg: isGR
              ? ` Καταιγίδα ${label} (${timeStr})! Μείνετε σε κλειστό χώρο!`
              : ` Thunderstorm ${label} (${timeStr})! Stay indoors!`,
          });
          break;
        }
      }
    }
    return alerts;
  }

  function renderAlertsBanner(alerts) {
    alertsList = alerts;
    alertIdx = 0;
    const banner = document.getElementById("alertsBanner");
    if (!banner) return;
    if (!alerts || alerts.length === 0) {
      banner.classList.add("hidden");
      return;
    }
    banner.classList.remove("hidden");
    showAlertAt(0);
  }
  function showAlertAt(idx) {
    if (!alertsList.length) return;
    idx = ((idx % alertsList.length) + alertsList.length) % alertsList.length;
    alertIdx = idx;
    const a = alertsList[idx];
    const banner = document.getElementById("alertsBanner");
    const content = document.getElementById("alertBannerContent");
    const counter = document.getElementById("alertCounter");
    if (!banner || !content) return;
    banner.className = `alerts-banner level-${a.level}`;
    const bc =
      {
        red: "badge-red",
        orange: "badge-orange",
        yellow: "badge-yellow",
        info: "badge-info",
      }[a.level] || "badge-info";
    content.innerHTML = `<span class="alert-level-badge ${bc}">${a.icon} ${a.badge}</span><span>${a.msg}</span>`;
    if (counter)
      counter.innerText =
        alertsList.length > 1 ? `${idx + 1}/${alertsList.length}` : "";
    const prev = document.getElementById("alertPrev");
    const next = document.getElementById("alertNext");
    if (prev) prev.style.display = alertsList.length > 1 ? "flex" : "none";
    if (next) next.style.display = alertsList.length > 1 ? "flex" : "none";
  }
  document
    .getElementById("alertPrev")
    ?.addEventListener("click", () => showAlertAt(alertIdx - 1));
  document
    .getElementById("alertNext")
    ?.addEventListener("click", () => showAlertAt(alertIdx + 1));

  // ================================================================
  // 10. SVG ICONS (using img tags for the new .png icons you provided)
  // Icons saved in /icons/ folder
  // ================================================================
  function getIconImg(code, isDay = 1, size = "26px") {
    // Map WMO code + isDay to icon filename
    const map = {
      "0_1": "sun.png",
      "0_0": "moon.png",
      "1_1": "sun_cloud.png",
      "1_0": "moon_cloud.png",
      "2_1": "sun_cloud.png",
      "2_0": "moon_cloud.png",
      "3_1": "cloud.png",
      "3_0": "cloud.png",
      "45_1": "fog.png",
      "45_0": "fog.png",
      "48_1": "fog.png",
      "48_0": "fog.png",
      "51_1": "rain_light.png",
      "51_0": "rain_light.png",
      "53_1": "rain_light.png",
      "53_0": "rain_light.png",
      "55_1": "rain_light.png",
      "55_0": "rain_light.png",
      "61_1": "rain_light.png",
      "61_0": "rain_light.png",
      "63_1": "rain.png",
      "63_0": "rain.png",
      "65_1": "rain_heavy.png",
      "65_0": "rain_heavy.png",
      "66_1": "sleet.png",
      "66_0": "sleet.png",
      "67_1": "sleet.png",
      "67_0": "sleet.png",
      "71_1": "snow_light.png",
      "71_0": "snow_light.png",
      "73_1": "snow.png",
      "73_0": "snow.png",
      "75_1": "snow.png",
      "75_0": "snow.png",
      "77_1": "hail.png",
      "77_0": "hail.png",
      "80_1": "rain_sun.png",
      "80_0": "rain_moon.png",
      "81_1": "rain.png",
      "81_0": "rain.png",
      "82_1": "rain_heavy.png",
      "82_0": "rain_heavy.png",
      "85_1": "hail.png",
      "85_0": "hail.png",
      "86_1": "hail.png",
      "86_0": "hail.png",
      "95_1": "storm.png",
      "95_0": "storm.png",
      "96_1": "storm_sun.png",
      "96_0": "storm.png",
      "99_1": "storm.png",
      "99_0": "storm.png",
    };
    const key = `${code}_${isDay ? 1 : 0}`;
    const file = map[key] || map[`${code}_1`] || "cloud.png";
    // Try to use the icon file; fallback to inline SVG if not found
    return `<img src="icons/${file}" width="${size}" height="${size}" style="display:inline-block;vertical-align:middle;" onerror="this.style.display='none';this.nextSibling.style.display='inline-block';" alt=""/><span style="display:none">${getInlineSVG(
      code,
      isDay
    )}</span>`;
  }

  // Keep inline SVG as fallback
  function getInlineSVG(code, isDay = 1) {
    const SUN = `<g class="svg-sun-group" style="transform-origin:12px 12px"><circle cx="12" cy="12" r="4.5" fill="#ffca28"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="12" y1="3" x2="12" y2="1"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="12" y1="21" x2="12" y2="23"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="3" y1="12" x2="1" y2="12"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="21" y1="12" x2="23" y2="12"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="5.6" y1="5.6" x2="4.2" y2="4.2"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="18.4" y1="5.6" x2="19.8" y2="4.2"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="5.6" y1="18.4" x2="4.2" y2="19.8"/><line stroke="#ffca28" stroke-width="2" stroke-linecap="round" x1="18.4" y1="18.4" x2="19.8" y2="19.8"/></g>`;
    const MOON = `<path fill="#eceff1" d="M17 12A5 5 0 0 1 9 7a7 7 0 1 0 8 5z"/>`;
    const CL = `<path fill="#b0bec5" d="M5 15a2.5 2.5 0 0 1 0-5 3.5 3.5 0 0 1 6.5-1A3 3 0 0 1 17 10.5a2.5 2.5 0 0 1 0 4.5H5z"/>`;
    const CD = `<path fill="#546e7a" d="M4 17a3 3 0 0 1 0-6 4.5 4.5 0 0 1 8.5-1.5A3.5 3.5 0 0 1 19 12a3 3 0 0 1 0 6H4z"/>`;
    const CL2 = `<path fill="#b0bec5" d="M9 18a2 2 0 0 1 0-4 3 3 0 0 1 5.5-1A2.5 2.5 0 0 1 18 15a2 2 0 0 1 0 3H9z"/>`;
    const DR = (x, y, d = 0) =>
      `<line stroke="#4fc3f7" stroke-width="2" stroke-linecap="round" style="animation:rainFall 0.9s ${d}s linear infinite" x1="${x}" y1="${y}" x2="${
        x - 1
      }" y2="${y + 4}"/>`;
    const FL = (cx, cy, r, d = 0) =>
      `<g style="animation:snowFall 1.4s ${d}s linear infinite;transform-origin:${cx}px ${cy}px"><line x1="${cx}" y1="${
        cy - r
      }" x2="${cx}" y2="${
        cy + r
      }" stroke="#e3f2fd" stroke-width="1.2" stroke-linecap="round"/><line x1="${
        cx - r * 0.866
      }" y1="${cy - r * 0.5}" x2="${cx + r * 0.866}" y2="${
        cy + r * 0.5
      }" stroke="#e3f2fd" stroke-width="1.2" stroke-linecap="round"/><line x1="${
        cx + r * 0.866
      }" y1="${cy - r * 0.5}" x2="${cx - r * 0.866}" y2="${
        cy + r * 0.5
      }" stroke="#e3f2fd" stroke-width="1.2" stroke-linecap="round"/></g>`;
    const BT = `<polygon fill="#ffeb3b" style="animation:flashBolt 2.2s infinite" points="11,17 9.5,21 13,20 11.5,24 15,19 12,20"/>`;
    const FG = (x1, y1, x2, d = 0) =>
      `<line stroke="#cfd8dc" stroke-width="1.8" stroke-linecap="round" style="animation:fogMove 3s ${d}s ease-in-out infinite" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y1}"/>`;
    if (code === 0 && isDay) return `<svg viewBox="0 0 24 24">${SUN}</svg>`;
    if (code === 0) return `<svg viewBox="0 0 24 24">${MOON}</svg>`;
    if (code === 1 && isDay)
      return `<svg viewBox="0 0 24 24"><g transform="translate(-2,-3) scale(0.75)">${SUN}</g>${CL}</svg>`;
    if (code === 1)
      return `<svg viewBox="0 0 24 24"><g transform="translate(-2,-4) scale(0.7)">${MOON}</g>${CL}</svg>`;
    if (code === 2 && isDay)
      return `<svg viewBox="0 0 24 24"><g transform="translate(-3,-4) scale(0.7)">${SUN}</g>${CL}${CL2}</svg>`;
    if (code === 2)
      return `<svg viewBox="0 0 24 24"><g transform="translate(-2,-5) scale(0.65)">${MOON}</g>${CL}${CL2}</svg>`;
    if (code === 3) return `<svg viewBox="0 0 24 24">${CD}${CL2}</svg>`;
    if (code === 45 || code === 48)
      return `<svg viewBox="0 0 24 24">${CL}${FG(4, 17, 10, 0)}${FG(
        8,
        19,
        16,
        0.3
      )}${FG(5, 21, 13, 0.6)}</svg>`;
    if (code === 51 || code === 53)
      return `<svg viewBox="0 0 24 24"><g transform="translate(-3,-4) scale(0.68)">${SUN}</g>${CL}${DR(
        9,
        18,
        0
      )}${DR(13, 18, 0.3)}</svg>`;
    if (code === 55 || code === 61)
      return `<svg viewBox="0 0 24 24">${CL}${DR(8, 18, 0)}${DR(
        12,
        18,
        0.25
      )}${DR(16, 18, 0.5)}</svg>`;
    if (code === 63 || code === 80 || code === 81)
      return `<svg viewBox="0 0 24 24">${CD}${CL2}${DR(7, 19, 0)}${DR(
        11,
        19,
        0.2
      )}${DR(15, 19, 0.4)}${DR(19, 19, 0.6)}</svg>`;
    if (code === 65 || code === 82)
      return `<svg viewBox="0 0 24 24">${CD}${CL2}${DR(6, 19, 0)}${DR(
        10,
        19,
        0.15
      )}${DR(14, 19, 0.3)}${DR(18, 19, 0.45)}${DR(8, 21.5, 0.6)}${DR(
        16,
        21.5,
        0.75
      )}</svg>`;
    if (code === 66 || code === 67)
      return `<svg viewBox="0 0 24 24">${CL}${DR(8, 18, 0)}${DR(
        13,
        18,
        0.3
      )}${FL(17, 21, 1.5, 0.5)}</svg>`;
    if (code === 71)
      return `<svg viewBox="0 0 24 24"><g transform="translate(-3,-4) scale(0.68)">${SUN}</g>${CL}${FL(
        9,
        20,
        1.5,
        0
      )}${FL(14, 20, 1.5, 0.4)}</svg>`;
    if (code === 73)
      return `<svg viewBox="0 0 24 24">${CL}${FL(7, 20, 1.8, 0)}${FL(
        12,
        20,
        1.8,
        0.3
      )}${FL(17, 20, 1.8, 0.6)}</svg>`;
    if (code === 75 || code === 77)
      return `<svg viewBox="0 0 24 24">${CD}${CL2}${FL(6, 20, 2, 0)}${FL(
        11,
        20,
        2,
        0.25
      )}${FL(16, 20, 2, 0.5)}${FL(9, 22.5, 1.5, 0.75)}${FL(
        14,
        22.5,
        1.5,
        1
      )}</svg>`;
    if (code === 85 || code === 86)
      return `<svg viewBox="0 0 24 24">${CD}${CL2}<circle fill="#b3e5fc" cx="7" cy="20" r="2"/><circle fill="#b3e5fc" cx="12" cy="20" r="2"/><circle fill="#b3e5fc" cx="17" cy="20" r="2"/></svg>`;
    if (code === 95)
      return `<svg viewBox="0 0 24 24">${CD}${DR(8, 18, 0)}${DR(
        12,
        18,
        0.2
      )}${DR(16, 18, 0.4)}${BT}</svg>`;
    if (code === 96 || code === 99)
      return `<svg viewBox="0 0 24 24">${CD}${CL2}${DR(8, 19, 0)}${DR(
        12,
        19,
        0.2
      )}${DR(16, 19, 0.4)}${BT}</svg>`;
    return `<svg viewBox="0 0 24 24">${CL}</svg>`;
  }

  // ================================================================
  // 11. RENDER DASHBOARD
  // ================================================================
  function renderDashboard(forecast, owm, fullLoc) {
    const tz = state.timezone || "UTC";
    const hIdx = getCurrentHourIndex(forecast.hourly.time, tz);
    const isDay =
      forecast.hourly.is_day?.[hIdx] ?? forecast.current_weather.is_day;
    const liveTemp = owm?.main?.temp ?? forecast.current_weather.temperature;
    const liveFeels =
      owm?.main?.feels_like ??
      forecast.hourly.apparent_temperature?.[hIdx] ??
      liveTemp;
    const liveHum =
      owm?.main?.humidity ?? forecast.hourly.relative_humidity_2m?.[hIdx] ?? 0;
    const liveWind =
      owm?.wind?.speed != null
        ? owm.wind.speed * 3.6
        : forecast.current_weather.windspeed;
    const liveWindDir =
      owm?.wind?.deg ?? forecast.current_weather.winddirection ?? 0;
    const livePressure =
      owm?.main?.pressure ?? forecast.hourly.surface_pressure?.[hIdx] ?? 1013;
    const liveCode = forecast.current_weather.weathercode;
    const liveDesc = td(liveCode, isDay);
    const uvNow =
      forecast.hourly.uv_index?.[hIdx] ?? forecast.daily.uv_index_max?.[0] ?? 0;
    const uvMax = forecast.daily.uv_index_max?.[0] ?? 0;
    const pop = forecast.hourly.precipitation_probability?.[hIdx] ?? 0;
    const sunRise = forecast.daily.sunrise[0].split("T")[1].substring(0, 5);
    const sunSet = forecast.daily.sunset[0].split("T")[1].substring(0, 5);
    const dewPoint = calcDewPoint(liveTemp, liveHum);
    const maxT = forecast.daily.temperature_2m_max[0];
    const wBf = getBeaufort(liveWind);
    const wDir = windDir(liveWindDir);
    const isGR = state.lang === "GR";
    applyBackground(liveCode, isDay);
    const alerts = buildAllAlerts(forecast, owm, hIdx);
    renderAlertsBanner(alerts);
    setEl("uniCity", fullLoc);
    setHTML("uniIcon", getInlineSVG(liveCode, isDay));
    setEl("uniTemp", formatTemp(liveTemp));
    setEl("uniDesc", liveDesc);
    const sevEl = document.getElementById("uniSevereIndicator");
    if (sevEl) sevEl.classList.toggle("hidden", !isSevereCode(liveCode));
    setEl("nowCity", fullLoc);
    setHTML("nowIcon", getInlineSVG(liveCode, isDay));
    setEl("nowTempTopLeft", formatTemp(liveTemp));
    setEl("nowShortDesc", liveDesc);
    setEl(
      "nowFeelsMini",
      isGR
        ? `Αίσθηση ${formatTemp(liveFeels)}`
        : `Feels like ${formatTemp(liveFeels)}`
    );
    setEl("dataSourceBadge", owm?.main ? "OWM Live" : "Open-Meteo");
    setHTML(
      "nowAnalysisText",
      `<i class="bi bi-info-circle-fill" style="color:var(--accent);margin-right:6px;"></i>` +
        (isGR
          ? `<b>${liveDesc}</b>. Μέγιστη <b>${formatTemp(
              maxT
            )}</b>. Άνεμοι <b>${wDir}</b> ${wBf} Μποφόρ (${formatWind(
              liveWind
            )}). Πιθανότητα βροχής <b>${pop}%</b>.`
          : `<b>${liveDesc}</b>. Max <b>${formatTemp(
              maxT
            )}</b>. Wind <b>${wDir}</b> ${wBf} Bft (${formatWind(
              liveWind
            )}). Rain prob. <b>${pop}%</b>.`)
    );
    const warnEl = document.getElementById("nowWarningBar");
    if (warnEl) {
      if (alerts.length > 0) {
        warnEl.classList.remove("hidden");
        warnEl.innerHTML = alerts
          .slice(0, 2)
          .map((a) => `<span>${a.icon} ${a.msg}</span>`)
          .join("<br/>");
      } else warnEl.classList.add("hidden");
    }
    const uvInfo = getUVLabel(uvNow);
    const uvPct = Math.min((uvNow / 11) * 100, 100);
    setHTML(
      "nowEightBoxes",
      `
      <div class="grid-box"><i class="bi bi-thermometer-half"></i><div class="box-title">${t(
        "feels"
      )}</div><div class="box-value">${formatTemp(liveFeels)}</div></div>
      <div class="grid-box"><i class="bi bi-droplet-fill"></i><div class="box-title">${t(
        "humidity"
      )}</div><div class="box-value">${liveHum}%</div><div class="hum-bar-wrap"><div class="hum-bar-track"><div class="hum-bar-fill" style="width:${liveHum}%"></div></div></div></div>
      <div class="grid-box"><i class="bi bi-wind"></i><div class="box-title">${t(
        "wind"
      )}</div><div class="box-value">${wBf} Bft</div><div class="box-sub">${formatWind(
        liveWind
      )} ${wDir}</div></div>
      <div class="grid-box"><i class="bi bi-sun-fill" style="color:${
        uvInfo.color
      }"></i><div class="box-title">${t(
        "uv"
      )}</div><div class="box-value" style="color:${uvInfo.color}">${
        uvNow > 0 ? uvNow.toFixed(1) : "—"
      }</div><div class="box-sub">${
        uvInfo.label
      }</div><div class="uv-bar-wrap"><div class="uv-bar-track"><div class="uv-bar-dot" style="left:${uvPct}%"></div></div></div></div>
      <div class="grid-box"><i class="bi bi-sunrise-fill"></i><div class="box-title">${t(
        "sunrise"
      )} / ${t(
        "sunset"
      )}</div><div class="box-value" style="font-size:13px;">🌅 ${sunRise}</div><div class="box-sub">🌇 ${sunSet}</div></div>
      <div class="grid-box"><i class="bi bi-thermometer-snow"></i><div class="box-title">${t(
        "dew"
      )}</div><div class="box-value">${formatTemp(dewPoint)}</div></div>
      <div class="grid-box"><i class="bi bi-speedometer2"></i><div class="box-title">${t(
        "pressure"
      )}</div><div class="box-value">${Math.round(
        livePressure
      )}</div><div class="box-sub">hPa</div></div>
      <div class="grid-box"><i class="bi bi-cloud-rain-fill"></i><div class="box-title">${t(
        "rain_prob"
      )}</div><div class="box-value">${pop}%</div></div>
    `
    );
    renderHourlyTab(forecast, hIdx, isDay);
    renderDailyTab(forecast);
    const mapsTab = document.getElementById("mapsSection");
    if (mapsTab && !mapsTab.classList.contains("hidden")) updateWindyMap();
  }

  // ================================================================
  // 12. HOURLY TAB
  // ================================================================
  function renderHourlyTab(data, hIdx, currentIsDay) {
    const chartContainer = document.getElementById("precipitationChart");
    if (chartContainer) {
      chartContainer.innerHTML = "";
      for (let i = hIdx; i < hIdx + 10; i++) {
        if (!data.hourly.time[i]) break;
        const hourText = data.hourly.time[i].split("T")[1].substring(0, 5);
        const pv = data.hourly.precipitation[i] ?? 0;
        const bh = Math.min(Math.max(pv * 15, 2), 100);
        chartContainer.innerHTML += `<div class="chart-bar-wrapper"><div class="chart-bar-val">${pv.toFixed(
          1
        )}</div><div class="chart-bar" style="height:${bh}px;"></div><div class="chart-bar-label">${hourText}</div></div>`;
      }
    }
    const labels24 = [],
      temps24 = [];
    for (let i = hIdx; i < hIdx + 24; i++) {
      if (!data.hourly.time[i]) break;
      labels24.push(data.hourly.time[i].split("T")[1].substring(0, 5));
      temps24.push(
        state.unit === "F"
          ? Math.round((data.hourly.temperature_2m[i] * 9) / 5 + 32)
          : Math.round(data.hourly.temperature_2m[i])
      );
    }
    buildChartJS(
      "hourlyTempChart",
      labels24,
      temps24,
      "#00d2ff",
      state.unit === "F" ? "°F" : "°C"
    );
    const hRes = document.getElementById("hourlyResults");
    if (!hRes) return;
    hRes.innerHTML = "";
    for (let i = hIdx; i < hIdx + 24; i++) {
      if (!data.hourly.time[i]) break;
      const tStr = data.hourly.time[i].split("T")[1].substring(0, 5);
      const isNow = i === hIdx;
      const pop = data.hourly.precipitation_probability[i] ?? 0;
      const hCode = data.hourly.weathercode[i];
      const hr = parseInt(tStr.split(":")[0]);
      const hIsDay = data.hourly.is_day?.[i] ?? (hr >= 6 && hr <= 20 ? 1 : 0);
      const feels =
        data.hourly.apparent_temperature?.[i] ?? data.hourly.temperature_2m[i];
      const hum = data.hourly.relative_humidity_2m?.[i] ?? 0;
      const wSpd = data.hourly.windspeed_10m?.[i] ?? 0;
      const wDr = windDir(data.hourly.winddirection_10m?.[i] || 0);
      const rain = data.hourly.precipitation?.[i] ?? 0;
      const row = document.createElement("div");
      row.className = `hourly-row-item${isNow ? " current-hour" : ""}`;
      row.innerHTML = `
        <div class="hourly-main-row">
          <div class="hourly-time">${isNow ? t("now_label") : tStr}</div>
          <div class="anim-icon-small">${getInlineSVG(hCode, hIsDay)}</div>
          <div class="hourly-desc">${td(hCode, hIsDay)}</div>
          <div class="hourly-temp">${formatTemp(
            data.hourly.temperature_2m[i]
          )}</div>
          <div class="hourly-pop"><i class="bi bi-drop-fill"></i> ${pop}%</div>
        </div>
        <div class="hourly-expanded-details" style="display:none;">
          <div class="hourly-detail-item"><div class="hd-label">${t(
            "feels"
          )}</div><div class="hd-val">${formatTemp(feels)}</div></div>
          <div class="hourly-detail-item"><div class="hd-label">${t(
            "wind"
          )}</div><div class="hd-val">${formatWind(wSpd)} ${wDr}</div></div>
          <div class="hourly-detail-item"><div class="hd-label">${t(
            "humidity"
          )}</div><div class="hd-val">${hum}%</div></div>
          <div class="hourly-detail-item"><div class="hd-label">${t(
            "precip"
          )}</div><div class="hd-val">${rain.toFixed(1)} mm</div></div>
        </div>`;
      row.addEventListener("click", () => {
        const details = row.querySelector(".hourly-expanded-details");
        const isOpen =
          details.style.display !== "none" && details.style.display !== "";
        hRes.querySelectorAll(".hourly-expanded-details").forEach((d) => {
          d.style.display = "none";
        });
        hRes
          .querySelectorAll(".hourly-row-item")
          .forEach((r) => r.classList.remove("expanded"));
        if (!isOpen) {
          details.style.display = "grid";
          row.classList.add("expanded");
        }
      });
      hRes.appendChild(row);
    }
  }

  // ================================================================
  // 13. DAILY TAB (always shows all 14 days)
  // ================================================================
  function renderDailyTab(data) {
    const dRes = document.getElementById("dailyResults");
    if (!dRes) return;
    dRes.innerHTML = "";
    const isGR = state.lang === "GR";
    const allMax = Math.max(...data.daily.temperature_2m_max);
    const allMin = Math.min(...data.daily.temperature_2m_min);
    const tempRange = allMax - allMin || 1;
    // Always render all available days (up to 14)
    const daysToRender = Math.min(data.daily.time.length, 14);
    for (let i = 0; i < daysToRender; i++) {
      const dateStr = data.daily.time[i];
      const dateObj = new Date(dateStr + "T12:00:00");
      const displayDate = dateObj.toLocaleDateString(
        state.lang === "GR" ? "el-GR" : "en-US",
        { weekday: "long", day: "numeric", month: "short" }
      );
      const dCode = data.daily.weathercode[i];
      const maxT = data.daily.temperature_2m_max[i];
      const minT = data.daily.temperature_2m_min[i];
      const windMax = Math.round(data.daily.windspeed_10m_max[i]);
      const wDir = windDir(data.daily.winddirection_10m_dominant?.[i] || 0);
      const pop = data.daily.precipitation_probability_max[i] ?? 0;
      const rainSum = data.daily.precipitation_sum?.[i] ?? 0;
      const uvDay = data.daily.uv_index_max?.[i] ?? 0;
      const sunRise = data.daily.sunrise[i].split("T")[1].substring(0, 5);
      const sunSet = data.daily.sunset[i].split("T")[1].substring(0, 5);
      const uvInfo = getUVLabel(uvDay);
      const weatherClass =
        dCode >= 95
          ? "weather-storm"
          : dCode >= 80
          ? "weather-rain"
          : dCode >= 71
          ? "weather-snow"
          : dCode >= 3
          ? "weather-cloud"
          : "weather-sun";
      const barLeft = (((minT - allMin) / tempRange) * 100).toFixed(1);
      const barWidth = (((maxT - minT) / tempRange) * 100).toFixed(1);
      const dayBase = i * 24;
      function worstInRange(from, to) {
        let idx = dayBase + from,
          worst = -1;
        for (let h = dayBase + from; h < dayBase + to; h++) {
          if (data.hourly.weathercode[h] === undefined) continue;
          const c = data.hourly.weathercode[h];
          const sev =
            c >= 95
              ? 1000
              : c >= 80
              ? 800
              : c >= 71
              ? 700
              : c >= 61
              ? 600
              : c >= 51
              ? 500
              : c >= 3
              ? 300
              : 100;
          if (sev > worst) {
            worst = sev;
            idx = h;
          }
        }
        return idx;
      }
      const P1i = worstInRange(6, 9),
        P2i = worstInRange(9, 14),
        P3i = worstInRange(14, 18),
        P4i = worstInRange(18, 27);
      function pd(idx, fbCode, fbTemp) {
        return {
          code: data.hourly.weathercode[idx] ?? fbCode,
          temp: data.hourly.temperature_2m[idx] ?? fbTemp,
          pop: data.hourly.precipitation_probability[idx] ?? pop,
          wind: data.hourly.windspeed_10m[idx] ?? windMax,
          wdir: windDir(data.hourly.winddirection_10m[idx] || 0),
        };
      }
      const P1 = pd(P1i, dCode, maxT),
        P2 = pd(P2i, dCode, maxT),
        P3 = pd(P3i, dCode, maxT),
        P4 = pd(P4i, dCode, minT);
      const miniDayCode = [P1i, P2i].reduce((a, b) => {
        const ca = data.hourly.weathercode[a] ?? 0,
          cb = data.hourly.weathercode[b] ?? 0;
        return ca >= cb ? a : b;
      });
      const miniNightCode = [P3i, P4i].reduce((a, b) => {
        const ca = data.hourly.weathercode[a] ?? 0,
          cb = data.hourly.weathercode[b] ?? 0;
        return ca >= cb ? a : b;
      });
      const item = document.createElement("div");
      item.className = `daily-item ${weatherClass}`;
      item.innerHTML = `
        <div class="daily-header">
          <div class="daily-date">${i === 0 ? t("today") : displayDate}</div>
          <div class="daily-center">
            <div class="daily-icons-mini">
              <div class="daily-icon-wrap">${getInlineSVG(
                data.hourly.weathercode[miniDayCode] ?? dCode,
                1
              )}<div class="daily-period-label">${
        isGR ? "Ημέρα" : "Day"
      }</div></div>
              <div class="daily-icon-wrap">${getInlineSVG(
                data.hourly.weathercode[miniNightCode] ?? dCode,
                0
              )}<div class="daily-period-label">${
        isGR ? "Νύχτα" : "Night"
      }</div></div>
            </div>
            <div class="daily-temp-bar-wrap">
              <span class="daily-temp-min-lbl">${formatTemp(minT)}</span>
              <div class="daily-temp-bar-track"><div class="daily-temp-bar-fill" style="left:${barLeft}%;width:${barWidth}%"></div></div>
              <span class="daily-temp-max-lbl">${formatTemp(maxT)}</span>
            </div>
          </div>
          <div class="daily-temps">${formatTemp(maxT)} <span>/ ${formatTemp(
        minT
      )}</span></div>
        </div>
        <div class="daily-details">
          <div class="daily-4-grid">
            <div class="detail-quarter"><div class="detail-title day">🌅 ${
              isGR ? "Πρωί" : "Morning"
            } 06–09</div><div style="display:flex;justify-content:center;margin:6px 0;">${getInlineSVG(
        P1.code,
        1
      )}</div><div class="daily-analysis-block"><b>${td(
        P1.code,
        1
      )}</b><br>🌡️ ${formatTemp(P1.temp)} 💧 ${P1.pop}%<br>💨 ${
        P1.wdir
      } ${getBeaufort(P1.wind)}Bft</div></div>
            <div class="detail-quarter"><div class="detail-title day" style="color:#ffd54f;">☀️ ${
              isGR ? "Μεσημέρι" : "Noon"
            } 09–14</div><div style="display:flex;justify-content:center;margin:6px 0;">${getInlineSVG(
        P2.code,
        1
      )}</div><div class="daily-analysis-block"><b>${td(
        P2.code,
        1
      )}</b><br>🌡️ ${formatTemp(P2.temp)} 💧 ${P2.pop}%<br>💨 ${
        P2.wdir
      } ${getBeaufort(P2.wind)}Bft</div></div>
            <div class="detail-quarter"><div class="detail-title day" style="color:#ff8a65;">🌤️ ${
              isGR ? "Απόγευμα" : "Afternoon"
            } 14–18</div><div style="display:flex;justify-content:center;margin:6px 0;">${getInlineSVG(
        P3.code,
        1
      )}</div><div class="daily-analysis-block"><b>${td(
        P3.code,
        1
      )}</b><br>🌡️ ${formatTemp(P3.temp)} 💧 ${P3.pop}%<br>💨 ${
        P3.wdir
      } ${getBeaufort(P3.wind)}Bft</div></div>
            <div class="detail-quarter"><div class="detail-title night">🌙 ${
              isGR ? "Βράδυ" : "Evening"
            } 18–03</div><div style="display:flex;justify-content:center;margin:6px 0;">${getInlineSVG(
        P4.code,
        0
      )}</div><div class="daily-analysis-block"><b>${td(
        P4.code,
        0
      )}</b><br>🌡️ ${formatTemp(P4.temp)} 💧 ${P4.pop}%<br>💨 ${
        P4.wdir
      } ${getBeaufort(P4.wind)}Bft</div></div>
          </div>
          <div class="daily-analysis-block" style="margin-top:8px;font-size:12px;">
            🌅 ${sunRise} — 🌇 ${sunSet} &nbsp;|&nbsp; 💨 ${getBeaufort(
        windMax
      )}Bft (${formatWind(windMax)}) ${wDir} &nbsp;|&nbsp; 🌧️ ${rainSum.toFixed(
        1
      )}mm &nbsp;|&nbsp; ☀️ UV <span style="color:${
        uvInfo.color
      }">${uvDay.toFixed(1)} (${uvInfo.label})</span>
          </div>
        </div>`;
      item.onclick = () => {
        document.querySelectorAll(".daily-item").forEach((el) => {
          if (el !== item) el.classList.remove("open");
        });
        item.classList.toggle("open");
      };
      dRes.appendChild(item);
    }
  }

  // ================================================================
  // 14. STATS TAB
  // ================================================================
  function renderStatsTab(data) {
    if (!data?.daily) return;
    const tz = state.timezone || "UTC";
    const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
    const s = Math.max(
      0,
      data.hourly.time.findIndex((t) => t && t.startsWith(today))
    );
    const labels = [],
      temps = [],
      humidity = [],
      rain = [],
      wind = [];
    for (let i = s; i < s + 24; i++) {
      if (!data.hourly.time[i]) break;
      labels.push(data.hourly.time[i].split("T")[1].substring(0, 5));
      temps.push(
        state.unit === "F"
          ? Math.round((data.hourly.temperature_2m[i] * 9) / 5 + 32)
          : data.hourly.temperature_2m[i] ?? null
      );
      humidity.push(data.hourly.relative_humidity_2m[i] ?? null);
      rain.push(data.hourly.precipitation[i] ?? 0);
      wind.push(data.hourly.windspeed_10m[i] ?? null);
    }
    buildChartJS(
      "tempDayChart",
      labels,
      temps,
      "#00d2ff",
      state.unit === "F" ? "°F" : "°C"
    );
    buildChartJS("humidityDayChart", labels, humidity, "#4fc3f7", "%");
    buildChartJS("rainDayChart", labels, rain, "#0288d1", "mm", true);
    buildChartJS("windDayChart", labels, wind, "#ffb300", "km/h");
    const len = data.daily.time.length;
    let tMax = 0,
      tMin = 0,
      tRain = 0,
      rainDays = 0,
      maxUV = 0,
      maxRainDay = 0,
      humSum = 0,
      humCount = 0;
    for (let i = 0; i < len; i++) {
      tMax += data.daily.temperature_2m_max[i];
      tMin += data.daily.temperature_2m_min[i];
      const dr = data.daily.precipitation_sum?.[i] ?? 0;
      tRain += dr;
      if (dr > 0.3) rainDays++;
      if (dr > maxRainDay) maxRainDay = dr;
      const uv = data.daily.uv_index_max?.[i] ?? 0;
      if (uv > maxUV) maxUV = uv;
    }
    data.hourly.relative_humidity_2m.forEach((v) => {
      if (v != null) {
        humSum += v;
        humCount++;
      }
    });
    setEl("statMonthMax", formatTemp(tMax / len));
    setEl("statMonthMin", formatTemp(tMin / len));
    setEl("statMonthRain", Math.round(tRain * 2.1) + " mm");
    setEl("statMonthRainDays", Math.round(rainDays * 2));
    setEl(
      "statMonthHumidity",
      Math.round(humCount ? humSum / humCount : 0) + "%"
    );
    setEl("statMonthMaxRain", maxRainDay.toFixed(1) + " mm");
    setEl("statMonthAvgRain", (tRain / len).toFixed(1) + " mm");
    setEl("statTotalRain", tRain.toFixed(1) + " mm");
    setEl("statMaxUV", maxUV > 0 ? maxUV.toFixed(1) : "—");
    setEl("statTodayMax", formatTemp(data.daily.temperature_2m_max[0]));
    setEl("statTodayMin", formatTemp(data.daily.temperature_2m_min[0]));
    setEl("yearHigh", "...");
    setEl("yearLow", "...");
    const bc = document.getElementById("statsBarsContainer");
    if (bc) {
      bc.innerHTML = "";
      const aMax = Math.max(...data.daily.temperature_2m_max),
        aMin = Math.min(...data.daily.temperature_2m_min),
        rng = aMax - aMin || 1;
      data.daily.time.forEach((ds, i) => {
        const dObj = new Date(ds + "T12:00:00");
        const lbl = dObj.toLocaleDateString(
          state.lang === "GR" ? "el-GR" : "en-US",
          { day: "numeric", month: "short" }
        );
        const mx = data.daily.temperature_2m_max[i],
          mn = data.daily.temperature_2m_min[i];
        const mxH = Math.round(20 + ((mx - aMin) / rng) * 90),
          mnH = Math.round(8 + ((mn - aMin) / rng) * 60);
        bc.innerHTML += `<div class="stat-double-bar-wrapper"><div class="bar-temp-label bar-max-lbl">${Math.round(
          mx
        )}°</div><div class="stat-bar-box stat-bar-max" style="height:${mxH}px;"></div><div class="stat-bar-box stat-bar-min" style="height:${mnH}px;"></div><div class="bar-temp-label bar-min-lbl">${Math.round(
          mn
        )}°</div><div class="stat-bar-lbl">${lbl}</div></div>`;
      });
    }
    renderLiveStats();
    setEl(
      "statsLastUpdate",
      (state.lang === "GR" ? "Τελευταία ανανέωση: " : "Last update: ") +
        new Date().toLocaleTimeString(state.lang === "GR" ? "el-GR" : "en-US")
    );
  }

  // ================================================================
  // 15. LIVE STATS
  // ================================================================
  function initLiveStats() {
    if (liveStatsTimer) clearInterval(liveStatsTimer);
    try {
      const saved = JSON.parse(
        localStorage.getItem("thavmaV9LiveStats") || "{}"
      );
      const today = new Date().toLocaleDateString("en-CA", {
        timeZone: state.timezone || "UTC",
      });
      liveStatsLog = saved.date === today ? saved.log || [] : [];
    } catch (e) {
      liveStatsLog = [];
    }
    function record() {
      if (!lastForecastData) return;
      const tz = state.timezone || "UTC";
      const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const hIdx = getCurrentHourIndex(lastForecastData.hourly.time, tz);
      const entry = {
        time: getLocalTime(tz).substring(0, 5),
        temp:
          lastOWMData?.main?.temp ??
          lastForecastData?.hourly?.temperature_2m?.[hIdx] ??
          null,
        humidity:
          lastOWMData?.main?.humidity ??
          lastForecastData?.hourly?.relative_humidity_2m?.[hIdx] ??
          null,
        wind:
          lastOWMData?.wind?.speed != null
            ? lastOWMData.wind.speed * 3.6
            : lastForecastData?.current_weather?.windspeed ?? null,
        rain: lastForecastData?.hourly?.precipitation?.[hIdx] ?? 0,
      };
      liveStatsLog = liveStatsLog.filter((e) => e.time !== entry.time);
      liveStatsLog.push(entry);
      liveStatsLog.sort((a, b) => a.time.localeCompare(b.time));
      try {
        localStorage.setItem(
          "thavmaV9LiveStats",
          JSON.stringify({ date: today, log: liveStatsLog })
        );
      } catch (e) {}
      renderLiveStats();
    }
    record();
    liveStatsTimer = setInterval(() => {
      const tz = state.timezone || "UTC";
      const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      try {
        const s = JSON.parse(localStorage.getItem("thavmaV9LiveStats") || "{}");
        if (s.date !== today) liveStatsLog = [];
      } catch (e) {}
      record();
    }, 10 * 60 * 1000);
  }
  function renderLiveStats() {
    const el = document.getElementById("liveStatsSummary");
    if (!el) return;
    if (!liveStatsLog.length) {
      el.innerHTML = `<li style="color:#444;font-size:12px;">Δεν υπάρχουν καταγραφές ακόμα</li>`;
      return;
    }
    el.innerHTML = liveStatsLog
      .slice(-5)
      .reverse()
      .map(
        (e) =>
          `<li style="font-size:12px;border-bottom:1px solid rgba(255,255,255,0.04);padding:4px 0;"><span style="color:#00d2ff;font-weight:700;">${
            e.time
          }</span><span style="color:#aaa;margin-left:8px;">${
            e.temp != null ? formatTemp(e.temp) : "--"
          }</span><span style="color:#4fc3f7;margin-left:8px;">${
            e.humidity != null ? e.humidity + "%" : "--"
          }</span><span style="color:#ffb300;margin-left:8px;">${
            e.wind != null ? formatWind(e.wind) : "--"
          }</span></li>`
      )
      .join("");
  }

  // ================================================================
  // 16. HISTORICAL STATS (ERA5)
  // ================================================================
  async function fetchHistoricalStats(lat, lon) {
    const key = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    if (historicalFetchCache[key]) {
      applyHistoricalStats(historicalFetchCache[key]);
      return;
    }
    try {
      const tz = state.timezone || "UTC";
      const end = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const s30 = new Date();
      s30.setDate(s30.getDate() - 30);
      const start30 = s30.toLocaleDateString("en-CA", { timeZone: tz });
      const s10y = new Date();
      s10y.setFullYear(s10y.getFullYear() - 10);
      const start10y = s10y.toLocaleDateString("en-CA", { timeZone: tz });
      const [mData, yData] = await Promise.all([
        fetchJSONRetry(
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start30}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,relative_humidity_2m_mean&timezone=auto`,
          1,
          1000
        ),
        fetchJSONRetry(
          `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${start10y}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min&timezone=auto`,
          1,
          1000
        ),
      ]);
      const r = {};
      if (mData.daily) {
        const mx = mData.daily.temperature_2m_max.filter((v) => v != null);
        const mn = mData.daily.temperature_2m_min.filter((v) => v != null);
        const rn = mData.daily.precipitation_sum.filter((v) => v != null);
        const hm = (mData.daily.relative_humidity_2m_mean || []).filter(
          (v) => v != null
        );
        r.monthAvgMax = mx.length
          ? mx.reduce((a, b) => a + b, 0) / mx.length
          : null;
        r.monthAvgMin = mn.length
          ? mn.reduce((a, b) => a + b, 0) / mn.length
          : null;
        r.monthTotalRain = rn.length ? rn.reduce((a, b) => a + b, 0) : null;
        r.monthRainDays = rn.filter((v) => v > 0.3).length;
        r.monthAvgHum = hm.length
          ? hm.reduce((a, b) => a + b, 0) / hm.length
          : null;
        r.monthMaxRain = rn.length ? Math.max(...rn) : null;
        r.monthAvgRainDay =
          rn.length && r.monthTotalRain != null
            ? r.monthTotalRain / rn.length
            : null;
      }
      if (yData.daily) {
        const mx = yData.daily.temperature_2m_max.filter((v) => v != null);
        const mn = yData.daily.temperature_2m_min.filter((v) => v != null);
        r.yearAbsMax = mx.length ? Math.max(...mx) : null;
        r.yearAbsMin = mn.length ? Math.min(...mn) : null;
      }
      historicalFetchCache[key] = r;
      applyHistoricalStats(r);
    } catch (e) {
      setEl("yearHigh", "—");
      setEl("yearLow", "—");
    }
  }
  function applyHistoricalStats(r) {
    if (r.monthAvgMax != null) setEl("statMonthMax", formatTemp(r.monthAvgMax));
    if (r.monthAvgMin != null) setEl("statMonthMin", formatTemp(r.monthAvgMin));
    if (r.monthTotalRain != null)
      setEl("statMonthRain", r.monthTotalRain.toFixed(1) + " mm");
    if (r.monthRainDays != null) setEl("statMonthRainDays", r.monthRainDays);
    if (r.monthAvgHum != null)
      setEl("statMonthHumidity", Math.round(r.monthAvgHum) + "%");
    if (r.monthMaxRain != null)
      setEl("statMonthMaxRain", r.monthMaxRain.toFixed(1) + " mm");
    if (r.monthAvgRainDay != null)
      setEl("statMonthAvgRain", r.monthAvgRainDay.toFixed(1) + " mm");
    if (r.yearAbsMax != null)
      setEl("yearHigh", formatTemp(r.yearAbsMax) + " ★");
    if (r.yearAbsMin != null) setEl("yearLow", formatTemp(r.yearAbsMin) + " ★");
  }

  // ================================================================
  // 17. CHART.JS
  // ================================================================
  function buildChartJS(canvasId, labels, values, color, unit, isBar = false) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    if (chartInstances[canvasId]) {
      chartInstances[canvasId].destroy();
      delete chartInstances[canvasId];
    }
    const ctx = canvas.getContext("2d");
    const grad = ctx.createLinearGradient(0, 0, 0, 160);
    grad.addColorStop(0, color + "88");
    grad.addColorStop(1, color + "11");
    chartInstances[canvasId] = new Chart(ctx, {
      type: isBar ? "bar" : "line",
      data: {
        labels,
        datasets: [
          {
            data: values,
            borderColor: color,
            backgroundColor: isBar ? color + "99" : grad,
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            fill: !isBar,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.parsed.y}${unit}` } },
        },
        scales: {
          x: {
            ticks: { color: "#888", font: { size: 10 }, maxTicksLimit: 8 },
            grid: { color: "rgba(255,255,255,0.04)" },
          },
          y: {
            ticks: {
              color: "#888",
              font: { size: 10 },
              callback: (v) => `${v}${unit}`,
            },
            grid: { color: "rgba(255,255,255,0.06)" },
          },
        },
      },
    });
  }

  // ================================================================
  // 18. MAPS
  // ================================================================
  const WINDY_LEGENDS = {
    rain: [
      { color: "#c8f0ff", label: "0.1mm" },
      { color: "#6ec6ff", label: "1mm" },
      { color: "#1a7bff", label: "5mm" },
      { color: "#0040cc", label: "10mm" },
      { color: "#8800cc", label: "25mm+" },
      { color: "#ff00ff", label: "50mm+" },
    ],
    temp: [
      { color: "#8000ff", label: "<-20°" },
      { color: "#0066ff", label: "0°" },
      { color: "#00cc66", label: "10°" },
      { color: "#ffff00", label: "20°" },
      { color: "#ff6600", label: "30°" },
      { color: "#cc0000", label: ">40°" },
    ],
    wind: [
      { color: "#e0f7fa", label: "0-5" },
      { color: "#80deea", label: "5-15" },
      { color: "#26c6da", label: "15-30" },
      { color: "#00838f", label: "30-50" },
      { color: "#006064", label: "50+km/h" },
    ],
    pressure: [
      { color: "#5500aa", label: "950hPa" },
      { color: "#0055ff", label: "980hPa" },
      { color: "#00ccff", label: "1000hPa" },
      { color: "#ffcc00", label: "1020hPa" },
      { color: "#ff4400", label: "1040+" },
    ],
    snowcover: [
      { color: "#e3f0ff", label: "Λίγο" },
      { color: "#b3d4ff", label: "Μέτριο" },
      { color: "#6699ff", label: "Πολύ" },
      { color: "#ffffff", label: "Πυκνό" },
    ],
    clouds: [
      { color: "rgba(255,255,255,0.15)", label: "Λίγα" },
      { color: "rgba(255,255,255,0.4)", label: "Μέτρια" },
      { color: "rgba(255,255,255,0.7)", label: "Πολλά" },
      { color: "rgba(180,180,180,0.9)", label: "Πλήρης" },
    ],
    waves: [
      { color: "#e0f7fa", label: "0-0.5m" },
      { color: "#4dd0e1", label: "1m" },
      { color: "#0097a7", label: "2m" },
      { color: "#006064", label: "4m+" },
      { color: "#1a237e", label: "6m+" },
    ],
    radar: [
      { color: "#00ff99", label: "Ελαφρά" },
      { color: "#ffff00", label: "Μέτρια" },
      { color: "#ff9900", label: "Έντονη" },
      { color: "#ff2200", label: "Ισχυρή" },
      { color: "#cc00ff", label: "Ακραία" },
    ],
  };

  function renderWindyLegend(k) {
    const box = document.getElementById("mapLegend");
    if (!box) return;
    const items = WINDY_LEGENDS[k] || [];
    if (!items.length) {
      box.innerHTML = "";
      return;
    }
    box.innerHTML =
      `<span style="font-size:11px;color:#555;margin-right:8px;">${k.toUpperCase()}:</span>` +
      items
        .map(
          (it) =>
            `<div class="legend-item"><div class="legend-swatch" style="background:${it.color};border:1px solid rgba(255,255,255,0.1)"></div>${it.label}</div>`
        )
        .join("");
  }
  function updateWindyMap(layer, model) {
    if (layer) currentWindyLayer = layer;
    if (model) currentWindyModel = model;
    const frame = document.getElementById("windyFrame");
    if (!frame) return;
    const lat = state.lat || 37.98,
      lon = state.lon || 23.73;
    frame.src = `https://embed.windy.com/embed2.html?lat=${lat}&lon=${lon}&detailLat=${lat}&detailLon=${lon}&width=650&height=450&zoom=6&level=surface&overlay=${currentWindyLayer}&product=${currentWindyModel}&menu=&message=true&marker=true&calendar=now&pressure=true&type=map&location=coordinates&detail=&metricWind=km%2Fh&metricTemp=%C2%B0C&radarRange=-1`;
    renderWindyLegend(currentWindyLayer);
  }
  function updateHerculesMap(slug) {
    currentHercSlug = slug;
    const url = `https://www.xalazi.gr/tools/maps/hercules?slug=${slug}`;
    const wrap = document.getElementById("herculesFrameWrap");
    if (wrap) {
      wrap.innerHTML = `
        <iframe src="${url}" style="width:100%;height:560px;border:0;border-radius:14px;background:#0a0a18;" allow="fullscreen" referrerpolicy="no-referrer-when-downgrade"></iframe>
        <div style="text-align:center;margin-top:8px;font-size:12px;color:#555;">Αν δεν φορτώσει: <a href="${url}" target="_blank" rel="noopener" style="color:#00d2ff;">Άνοιγμα στο xalazi.gr ↗</a></div>`;
    }
  }

  // ================================================================
  // 19. HOME TAB (extremes only — no 5 cities)
  // ================================================================
  const GREECE_CITIES = [
    { name: "Αθήνα", lat: 37.98, lon: 23.73 },
    { name: "Θεσσαλονίκη", lat: 40.64, lon: 22.94 },
    { name: "Πάτρα", lat: 38.25, lon: 21.73 },
    { name: "Ηράκλειο", lat: 35.34, lon: 25.13 },
    { name: "Λάρισα", lat: 39.64, lon: 22.42 },
    { name: "Ιωάννινα", lat: 39.67, lon: 20.85 },
    { name: "Καβάλα", lat: 40.94, lon: 24.4 },
    { name: "Ρόδος", lat: 36.43, lon: 28.22 },
    { name: "Κέρκυρα", lat: 39.62, lon: 19.92 },
    { name: "Τρίπολη", lat: 37.51, lon: 22.37 },
    { name: "Φλώρινα", lat: 40.78, lon: 21.4 },
    { name: "Αλεξανδρούπολη", lat: 40.85, lon: 25.87 },
  ];
  let __homeCache = null,
    __homeCacheTime = 0,
    __homeInFlight = null;

  async function renderHomeTab() {
    const grid = document.getElementById("homeGreeceCities");
    if (!grid) return;
    if (__homeCache && Date.now() - __homeCacheTime < 5 * 60 * 1000) {
      grid.innerHTML = __homeCache;
      return;
    }
    if (__homeInFlight) return __homeInFlight;
    grid.innerHTML = `<div style="color:#555;font-size:13px;padding:20px;text-align:center;"><div class="loading-spinner" style="margin:0 auto 10px;"></div>Φόρτωση... παρακαλώ περιμένετε.</div>`;
    __homeInFlight = (async () => {
      const isGR = state.lang === "GR";
      const now = new Date();
      const hour = now.getHours();
      const isDay = hour >= 6 && hour <= 20 ? 1 : 0;
      // Determine which day to show based on current time:
      // 00:00-11:59 → Σήμερα, 12:00-23:59 → Αύριο (αλλάζει μεσημέρι)
      const showTomorrow = hour >= 12;
      const dayLabel = showTomorrow
        ? isGR
          ? "Αύριο"
          : "Tomorrow"
        : isGR
        ? "Σήμερα"
        : "Today";

      // Athens left panel — always show current live + today stats
      try {
        const athFc = await fetchJSONRetry(
          `https://api.open-meteo.com/v1/forecast?latitude=37.98&longitude=23.73&current_weather=true&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode&forecast_days=2&timezone=auto`,
          1,
          800
        );
        if (athFc) {
          const code = athFc.current_weather?.weathercode ?? 0;
          setHTML("homeAthensIcon", getInlineSVG(code, isDay));
          setEl(
            "homeAthensTemp",
            formatTemp(athFc.current_weather?.temperature ?? 0)
          );
          setEl("homeAthensDesc", td(code, isDay));
          // Always show TODAY's max/min for Athens card
          setEl(
            "homeAthensMax",
            formatTemp(athFc.daily?.temperature_2m_max?.[0] ?? 0)
          );
          setEl(
            "homeAthensMin",
            formatTemp(athFc.daily?.temperature_2m_min?.[0] ?? 0)
          );
          setEl(
            "homeAthensRain",
            (athFc.daily?.precipitation_sum?.[0] ?? 0).toFixed(1) + " mm"
          );
        }
      } catch (e) {}

      // Batch fetch all cities
      let allData = [];
      try {
        const lats = GREECE_CITIES.map((c) => c.lat).join(",");
        const lons = GREECE_CITIES.map((c) => c.lon).join(",");
        const batch = await fetchJSONRetry(
          `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&daily=temperature_2m_max,temperature_2m_min,weathercode&forecast_days=2&timezone=auto`,
          1,
          800
        );
        const arr = Array.isArray(batch) ? batch : [batch];
        arr.forEach((fc, i) => {
          if (!fc?.daily?.temperature_2m_max) return;
          const city = GREECE_CITIES[i];
          allData.push({
            name: city.name,
            lat: city.lat,
            lon: city.lon,
            todayMax: fc.daily.temperature_2m_max[0] ?? null,
            todayMin: fc.daily.temperature_2m_min[0] ?? null,
            tomorrowMax: fc.daily.temperature_2m_max[1] ?? null,
            tomorrowMin: fc.daily.temperature_2m_min[1] ?? null,
            todayCode: fc.daily.weathercode[0] ?? 0,
            tomorrowCode: fc.daily.weathercode[1] ?? 0,
          });
        });
      } catch (e) {}

      // Fallback seasonal data
      if (!allData.length) {
        const seasonal = {
          Αθήνα: [29, 19, 1],
          Θεσσαλονίκη: [27, 17, 2],
          Πάτρα: [28, 18, 2],
          Ηράκλειο: [26, 19, 1],
          Λάρισα: [30, 16, 1],
          Ιωάννινα: [24, 13, 2],
          Καβάλα: [25, 17, 2],
          Ρόδος: [27, 20, 1],
          Κέρκυρα: [25, 17, 2],
          Τρίπολη: [25, 12, 1],
          Φλώρινα: [22, 9, 2],
          Αλεξανδρούπολη: [25, 16, 2],
        };
        allData = GREECE_CITIES.map((c) => {
          const v = seasonal[c.name] || [26, 16, 2];
          return {
            name: c.name,
            lat: c.lat,
            lon: c.lon,
            todayMax: v[0],
            todayMin: v[1],
            tomorrowMax: v[0] + 1,
            tomorrowMin: v[1],
            todayCode: v[2],
            tomorrowCode: v[2],
          };
        });
      }

      // Use today or tomorrow data based on hour
      const maxKey = showTomorrow ? "tomorrowMax" : "todayMax";
      const minKey = showTomorrow ? "tomorrowMin" : "todayMin";
      const codeKey = showTomorrow ? "tomorrowCode" : "todayCode";

      // Sort: top 5 highest max (descending) + top 5 lowest max (ascending)
      const validData = allData.filter((c) => c[maxKey] != null);
      const top5Hot = [...validData]
        .sort((a, b) => b[maxKey] - a[maxKey])
        .slice(0, 5);
      const top5Cold = [...validData]
        .sort((a, b) => a[maxKey] - b[maxKey])
        .slice(0, 5);

      function cityRow(c, rank, type) {
        const isHot = type === "hot";
        const temp = isHot ? c[maxKey] : c[maxKey]; // both show max for comparison
        const minTemp = c[minKey];
        const code = c[codeKey];
        const color = isHot ? "#ff7043" : "#4fc3f7";
        return `<div class="home-rank-row" onclick="document.getElementById('cityInput').value='${
          c.name
        }';fetchWeather('${
          c.name
        }');document.getElementById('tabNow')?.click();">
          <div class="home-rank-num" style="color:${color};">${rank}</div>
          <div class="home-rank-icon">${getInlineSVG(code, isDay)}</div>
          <div class="home-rank-name">${c.name}</div>
          <div class="home-rank-temps">
            <span class="rank-max" style="color:#ff7043;">${formatTemp(
              c[maxKey]
            )}</span>
            <span class="rank-sep">/</span>
            <span class="rank-min" style="color:#4fc3f7;">${formatTemp(
              minTemp
            )}</span>
          </div>
          <div class="home-rank-arrow">›</div>
        </div>`;
      }

      const html = `
        <div class="home-section-title">
          <i class="bi bi-thermometer-high" style="color:#ff7043;"></i>
          ${
            isGR ? "Θερμοκρασίες Ελλάδας" : "Greece Temperatures"
          } — <span style="color:var(--accent)">${dayLabel}</span>
        </div>
        <div class="home-ranks-container">
          <div class="home-ranks-col">
            <div class="home-ranks-header hot-header">
              <i class="bi bi-thermometer-high"></i> ${
                isGR ? "Υψηλότερες Μέγιστες" : "Highest Max"
              }
            </div>
            ${top5Hot.map((c, i) => cityRow(c, i + 1, "hot")).join("")}
          </div>
          <div class="home-ranks-col">
            <div class="home-ranks-header cold-header">
              <i class="bi bi-thermometer-low"></i> ${
                isGR ? "Χαμηλότερες Μέγιστες" : "Lowest Max"
              }
            </div>
            ${top5Cold.map((c, i) => cityRow(c, i + 1, "cold")).join("")}
          </div>
        </div>`;

      grid.innerHTML = html;
      __homeCache = html;
      __homeCacheTime = Date.now();
    })().finally(() => {
      __homeInFlight = null;
    });
    return __homeInFlight;
  }

  // ================================================================
  // 20. BACKGROUND
  // ================================================================
  let rbParticles = [];
  function applyBackground(code, isDay) {
    document.body.className = "";
    stopRealisticBg();
    if (state.theme === "realistic") {
      document.body.classList.add("theme-realistic");
      document.getElementById("realisticBg")?.classList.remove("hidden");
      startRealisticBg(code, isDay);
      return;
    }
    document.getElementById("realisticBg")?.classList.add("hidden");
    if (state.theme !== "dynamic") {
      document.body.classList.add("theme-" + state.theme);
      return;
    }
    let bg = "linear-gradient(160deg,#080818 0%,#0b1a2e 100%)";
    if (code >= 95) bg = "linear-gradient(160deg,#0a0014 0%,#04000a 100%)";
    else if (code >= 51 && code <= 82)
      bg = "linear-gradient(160deg,#0a1520 0%,#060d14 100%)";
    else if (code >= 1 && code <= 3)
      bg = "linear-gradient(160deg,#141828 0%,#0c1020 100%)";
    else if (!isDay) bg = "linear-gradient(160deg,#030611 0%,#050918 100%)";
    else bg = "linear-gradient(160deg,#0b2a4a 0%,#0d3d6b 100%)";
    document.body.style.background = bg;
  }
  function stopRealisticBg() {
    if (realisticAnimFrame) {
      cancelAnimationFrame(realisticAnimFrame);
      realisticAnimFrame = null;
    }
    rbParticles = [];
  }
  function startRealisticBg(code, isDay) {
    const canvas = document.getElementById("weatherCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);
    rbParticles = [];
    const isRain =
      (code >= 51 && code <= 55) ||
      (code >= 61 && code <= 65) ||
      (code >= 80 && code <= 82);
    const isSnow = code >= 71 && code <= 77,
      isStorm = code >= 95,
      isCloudy = code === 3;
    const isFog = code === 45 || code === 48,
      isSunny = code <= 2 && isDay,
      isNight = !isDay && code <= 3;
    function skyGrad() {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height * 0.75);
      if (isStorm) {
        g.addColorStop(0, "#08000f");
        g.addColorStop(1, "#1a0025");
      } else if (isNight) {
        g.addColorStop(0, "#010308");
        g.addColorStop(1, "#040a1e");
      } else if (isRain) {
        g.addColorStop(0, "#0a1018");
        g.addColorStop(1, "#141e2a");
      } else if (isCloudy) {
        g.addColorStop(0, "#141c28");
        g.addColorStop(1, "#1e2838");
      } else if (isSunny) {
        g.addColorStop(0, "#0a2a5a");
        g.addColorStop(0.5, "#1255a0");
        g.addColorStop(1, "#1e7ac8");
      } else {
        g.addColorStop(0, "#0c2040");
        g.addColorStop(1, "#0e3060");
      }
      return g;
    }
    if (isNight || isStorm)
      for (let i = 0; i < 250; i++)
        rbParticles.push({
          type: "star",
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height * 0.7,
          r: Math.random() * 1.6 + 0.2,
          a: Math.random(),
          da: 0.003 + Math.random() * 0.01,
        });
    if (isRain || isStorm) {
      const cnt = isStorm ? 320 : 180;
      for (let i = 0; i < cnt; i++)
        rbParticles.push({
          type: "rain",
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vy: 15 + Math.random() * 12,
          vx: -2.5 - Math.random() * 2,
          len: 14 + Math.random() * 20,
          a: 0.35 + Math.random() * 0.5,
        });
    }
    if (isSnow)
      for (let i = 0; i < 200; i++)
        rbParticles.push({
          type: "snow",
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vy: 0.6 + Math.random() * 2,
          vx: (Math.random() - 0.5) * 1,
          r: 1.5 + Math.random() * 4,
          a: 0.7 + Math.random() * 0.3,
          drift: Math.random() * Math.PI * 2,
        });
    if (isCloudy || isRain || isStorm || isFog) {
      const cnt = isFog ? 12 : 7;
      for (let i = 0; i < cnt; i++)
        rbParticles.push({
          type: "cloud",
          x: Math.random() * canvas.width,
          y: 30 + Math.random() * 160,
          vx: 0.1 + Math.random() * 0.3,
          w: 220 + Math.random() * 280,
          h: 80 + Math.random() * 60,
          a: isFog ? 0.35 : isStorm ? 0.25 : 0.15,
        });
    }
    if (isSunny)
      for (let i = 0; i < 14; i++)
        rbParticles.push({
          type: "sunray",
          angle: i * ((Math.PI * 2) / 14),
          len: 90 + Math.random() * 70,
          a: 0.06 + Math.random() * 0.05,
        });
    if (isSunny || code === 1 || code === 2)
      for (let i = 0; i < 4; i++)
        rbParticles.push({
          type: "bird",
          x: Math.random() * canvas.width,
          y: 50 + Math.random() * 100,
          vx: 0.3 + Math.random() * 0.5,
          vy: (Math.random() - 0.5) * 0.15,
          wing: 0,
          wingDir: 1,
          size: 2.5 + Math.random() * 2.5,
        });
    let ltimer = 0;
    function draw() {
      realisticAnimFrame = requestAnimationFrame(draw);
      ctx.fillStyle = skyGrad();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (isSunny) {
        const sx = canvas.width * 0.78,
          sy = 70;
        const sg = ctx.createRadialGradient(sx, sy, 6, sx, sy, 150);
        sg.addColorStop(0, "rgba(255,235,100,0.65)");
        sg.addColorStop(1, "transparent");
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(sx, sy, 150, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,225,60,0.98)";
        ctx.beginPath();
        ctx.arc(sx, sy, 32, 0, Math.PI * 2);
        ctx.fill();
      }
      if (isNight) {
        const mx = canvas.width * 0.82,
          my = 72;
        const mg = ctx.createRadialGradient(mx, my, 0, mx, my, 55);
        mg.addColorStop(0, "rgba(200,215,255,0.18)");
        mg.addColorStop(1, "transparent");
        ctx.fillStyle = mg;
        ctx.beginPath();
        ctx.arc(mx, my, 55, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(228,238,255,0.92)";
        ctx.beginPath();
        ctx.arc(mx, my, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(2,4,18,0.88)";
        ctx.beginPath();
        ctx.arc(mx + 8, my - 4, 18, 0, Math.PI * 2);
        ctx.fill();
      }
      rbParticles.forEach((p) => {
        if (p.type === "star") {
          p.a += p.da;
          if (p.a > 1 || p.a < 0.05) p.da *= -1;
          ctx.fillStyle = `rgba(255,255,255,${p.a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "rain") {
          p.y += p.vy;
          p.x += p.vx;
          if (p.y > canvas.height) {
            p.y = -10;
            p.x = Math.random() * canvas.width;
          }
          ctx.strokeStyle = `rgba(150,205,255,${p.a})`;
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + p.vx * 1.5, p.y + p.len);
          ctx.stroke();
        } else if (p.type === "snow") {
          p.drift += 0.018;
          p.y += p.vy;
          p.x += p.vx + Math.sin(p.drift) * 0.6;
          if (p.y > canvas.height) {
            p.y = -5;
            p.x = Math.random() * canvas.width;
          }
          ctx.fillStyle = `rgba(220,232,255,${p.a})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === "cloud") {
          p.x += p.vx;
          if (p.x > canvas.width + 380) p.x = -380;
          ctx.save();
          ctx.globalAlpha = p.a;
          const cg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.w / 2);
          cg.addColorStop(
            0,
            isStorm ? "rgba(80,70,100,0.95)" : "rgba(205,215,235,0.95)"
          );
          cg.addColorStop(1, "transparent");
          ctx.fillStyle = cg;
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.w / 2, p.h / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (p.type === "sunray") {
          const sx = canvas.width * 0.78,
            sy = 70;
          ctx.save();
          ctx.globalAlpha = p.a;
          ctx.strokeStyle = "rgba(255,215,70,0.3)";
          ctx.lineWidth = 12;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(
            sx + Math.cos(p.angle) * p.len,
            sy + Math.sin(p.angle) * p.len
          );
          ctx.stroke();
          p.angle += 0.0015;
          ctx.restore();
        } else if (p.type === "bird") {
          p.x += p.vx;
          p.y += p.vy;
          p.wing += 0.12 * p.wingDir;
          if (p.wing > 0.55 || p.wing < -0.15) p.wingDir *= -1;
          if (p.x > canvas.width + 60) p.x = -60;
          ctx.strokeStyle = "rgba(0,0,0,0.45)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, p.y + Math.sin(p.wing) * p.size);
          ctx.lineTo(p.x, p.y);
          ctx.lineTo(p.x + p.size, p.y + Math.sin(p.wing) * p.size);
          ctx.stroke();
        }
      });
      if (isStorm) {
        ltimer++;
        if (ltimer % (45 + Math.floor(Math.random() * 65)) === 0) {
          ctx.save();
          ctx.strokeStyle = "rgba(255,248,130,0.98)";
          ctx.lineWidth = 2.5;
          ctx.shadowColor = "#fff8ff";
          ctx.shadowBlur = 30;
          ctx.beginPath();
          const lx = 80 + Math.random() * (canvas.width - 160);
          let cy = 0;
          ctx.moveTo(lx, cy);
          while (cy < canvas.height * 0.62) {
            cy += 12 + Math.random() * 22;
            ctx.lineTo(lx + (Math.random() - 0.5) * 32, cy);
          }
          ctx.stroke();
          ctx.restore();
          ctx.fillStyle = "rgba(255,255,255,0.05)";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      if (isFog) {
        const fg = ctx.createLinearGradient(
          0,
          canvas.height * 0.15,
          0,
          canvas.height
        );
        fg.addColorStop(0, "transparent");
        fg.addColorStop(1, "rgba(165,180,195,0.45)");
        ctx.fillStyle = fg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
    draw();
  }

  // ================================================================
  // 21. AUTOCOMPLETE (fixed z-index + click works)
  // ================================================================
  function setupAutocomplete(inputId, suggestionsId) {
    const input = document.getElementById(inputId);
    const box = document.getElementById(suggestionsId);
    if (!input || !box) return;
    input.addEventListener("input", async (e) => {
      const txt = e.target.value.trim();
      if (txt.length < 2) {
        box.classList.add("hidden");
        return;
      }
      try {
        const langCode = state.lang === "GR" ? "el" : "en";
        const res = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
            txt
          )}&count=6&language=${langCode}`
        );
        const geo = await res.json();
        if (geo.results?.length > 0) {
          box.innerHTML = "";
          box.classList.remove("hidden");
          geo.results.forEach((loc) => {
            let parts = [loc.name];
            if (loc.admin1 && loc.admin1 !== loc.name) parts.push(loc.admin1);
            if (loc.country) parts.push(loc.country);
            const item = document.createElement("div");
            item.className = "suggestion-item";
            item.innerText = parts.join(", ");
            // Use mousedown instead of click to fire before blur
            item.addEventListener("mousedown", (ev) => {
              ev.preventDefault();
              input.value = loc.name;
              box.classList.add("hidden");
              document
                .getElementById("mobileSearchOverlay")
                ?.classList.add("hidden");
              fetchWeather(loc.name);
              document.getElementById("tabNow")?.click();
            });
            box.appendChild(item);
          });
        } else box.classList.add("hidden");
      } catch (err) {}
    });
    // Close on outside click
    document.addEventListener("click", (e) => {
      if (e.target !== input && !box.contains(e.target))
        box.classList.add("hidden");
    });
  }
  setupAutocomplete("cityInput", "suggestionsBox");
  setupAutocomplete("mobileSearchInput", "mobileSuggestionsBox");

  // ================================================================
  // 22. FAVORITES (fixed click)
  // ================================================================
  function renderFavorites() {
    const bar = document.getElementById("favoritesBar");
    if (!bar) return;
    bar.innerHTML = "";
    state.favorites.forEach((favCity) => {
      const chip = document.createElement("div");
      chip.className = "fav-chip";
      chip.innerHTML = `<span>${favCity}</span><i class="bi bi-x-circle-fill"></i>`;
      // mousedown fires before blur, ensures click registers
      chip.querySelector("span").addEventListener("mousedown", (e) => {
        e.preventDefault();
        document.getElementById("cityInput").value = favCity;
        fetchWeather(favCity);
      });
      chip.querySelector("i").addEventListener("mousedown", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.favorites = state.favorites.filter((c) => c !== favCity);
        saveState();
      });
      bar.appendChild(chip);
    });
  }
  function updateHeartStatus() {
    const heart = document.getElementById("heartBtn");
    if (heart)
      heart.classList.toggle("active", state.favorites.includes(state.city));
    const mHeart = document.getElementById("mobileHeartBtn");
    if (mHeart)
      mHeart.classList.toggle("active", state.favorites.includes(state.city));
  }
  function toggleFavorite() {
    if (state.favorites.includes(state.city))
      state.favorites = state.favorites.filter((c) => c !== state.city);
    else {
      if (state.favorites.length >= 8) return;
      state.favorites.push(state.city);
    }
    saveState();
  }
  document
    .getElementById("heartBtn")
    ?.addEventListener("click", toggleFavorite);
  document
    .getElementById("mobileHeartBtn")
    ?.addEventListener("click", toggleFavorite);

  // ================================================================
  // 23. REFRESH + TAB NAVIGATION + SETTINGS + EVENTS
  // ================================================================
  function setupLiveRefresh() {
    if (liveRefreshInterval) clearInterval(liveRefreshInterval);
    if (state.refresh === "manual") return;
    liveRefreshInterval = setInterval(
      () => fetchWeather(state.city),
      parseInt(state.refresh) * 60 * 1000
    );
  }

  document.querySelectorAll(".nav-tab[data-tab]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      document
        .querySelectorAll(".nav-tab")
        .forEach((b) => b.classList.remove("active"));
      const target = e.target.closest(".nav-tab");
      target.classList.add("active");
      document
        .querySelectorAll(".weather-section")
        .forEach((s) => s.classList.add("hidden"));
      const tab = target.getAttribute("data-tab");
      const section = document.getElementById(tab + "Section");
      if (section) section.classList.remove("hidden");
      if (tab === "maps") updateWindyMap();
      if (tab === "stats" && lastForecastData)
        setTimeout(() => renderStatsTab(lastForecastData), 50);
      if (tab === "home") renderHomeTab();
    });
  });

  document.getElementById("brandLogo")?.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-tab")
      .forEach((b) => b.classList.remove("active"));
    document.getElementById("tabHome")?.classList.add("active");
    document
      .querySelectorAll(".weather-section")
      .forEach((s) => s.classList.add("hidden"));
    document.getElementById("homeSection")?.classList.remove("hidden");
    renderHomeTab();
  });

  // Map buttons
  document.querySelectorAll(".map-btn[data-windy]").forEach((btn) => {
    btn.onclick = (e) => {
      const t = e.target.closest(".map-btn");
      document
        .querySelectorAll(".map-btn[data-windy]")
        .forEach((b) => b.classList.remove("active"));
      t.classList.add("active");
      updateWindyMap(t.getAttribute("data-windy"), null);
    };
  });
  document.querySelectorAll(".map-model-btn").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".map-model-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      updateWindyMap(null, btn.getAttribute("data-model"));
    };
  });
  document.querySelectorAll(".maps-tab-btn").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".maps-tab-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const tab = btn.getAttribute("data-maps-tab");
      document
        .getElementById("windySection")
        ?.classList.toggle("hidden", tab !== "windy");
      document
        .getElementById("herculesSection")
        ?.classList.toggle("hidden", tab !== "hercules");
      if (tab === "hercules") updateHerculesMap(currentHercSlug);
      if (tab === "windy") updateWindyMap();
    };
  });
  document.querySelectorAll(".herc-btn").forEach((btn) => {
    btn.onclick = () => {
      document
        .querySelectorAll(".herc-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      updateHerculesMap(btn.getAttribute("data-slug"));
    };
  });

  // Settings
  document.getElementById("unitSelect")?.addEventListener("change", (e) => {
    state.unit = e.target.value;
    saveState();
    if (lastForecastData) {
      renderDashboard(lastForecastData, lastOWMData, state.fullLocation);
      renderStatsTab(lastForecastData);
    }
  });
  document.getElementById("themeSelect")?.addEventListener("change", (e) => {
    state.theme = e.target.value;
    saveState();
    if (lastForecastData)
      applyBackground(
        lastForecastData.current_weather.weathercode,
        lastForecastData.current_weather.is_day
      );
  });
  document.getElementById("langSelect")?.addEventListener("change", (e) => {
    state.lang = e.target.value;
    saveState();
    const d = dict[state.lang] || dict.GR;
    const tabMap = {
      tabNow: "now",
      tabHourly: "hourly",
      tabDaily: "daily",
      tabStats: "stats",
      tabMaps: "map",
    };
    Object.entries(tabMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el && d[key]) el.innerText = d[key];
    });
    const ci = document.getElementById("cityInput");
    if (ci) ci.placeholder = d.search || "Search...";
    if (lastForecastData)
      renderDashboard(lastForecastData, lastOWMData, state.fullLocation);
    else fetchWeather();
  });
  document.getElementById("modelSelect")?.addEventListener("change", (e) => {
    state.model = e.target.value;
    saveState();
    fetchWeather(state.city);
  });
  document.getElementById("refreshSelect")?.addEventListener("change", (e) => {
    state.refresh = e.target.value;
    saveState();
    setupLiveRefresh();
  });
  document.getElementById("windUnitSelect")?.addEventListener("change", (e) => {
    state.windUnit = e.target.value;
    saveState();
    if (lastForecastData)
      renderDashboard(lastForecastData, lastOWMData, state.fullLocation);
  });

  // Search
  document
    .getElementById("searchBtn")
    ?.addEventListener("click", () => fetchWeather());
  document.getElementById("cityInput")?.addEventListener("keypress", (e) => {
    if (e.key === "Enter") fetchWeather();
  });

  // Mobile search
  document.getElementById("mobileSearchBtn")?.addEventListener("click", () => {
    document.getElementById("mobileSearchOverlay")?.classList.remove("hidden");
    setTimeout(
      () => document.getElementById("mobileSearchInput")?.focus(),
      100
    );
  });
  document
    .getElementById("mobileSearchClose")
    ?.addEventListener("click", () => {
      document.getElementById("mobileSearchOverlay")?.classList.add("hidden");
    });
  document
    .getElementById("mobileSearchInput")
    ?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const val = document.getElementById("mobileSearchInput").value.trim();
        if (val) {
          document
            .getElementById("mobileSearchOverlay")
            ?.classList.add("hidden");
          fetchWeather(val);
          document.getElementById("tabNow")?.click();
        }
      }
    });

  // Resize
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (lastForecastData) renderStatsTab(lastForecastData);
    }, 200);
  });

  // ================================================================
  // 24. INIT
  // ================================================================
  renderFavorites();
  startLocalClock();
  fetchWeather();
  setupLiveRefresh();
}); // end DOMContentLoaded
