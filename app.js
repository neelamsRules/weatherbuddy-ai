const state = {
  location: { name: "New Delhi", country: "India", latitude: 28.6139, longitude: 77.209 },
  activity: "commute",
  tripDay: 0,
  forecast: null,
  air: null
};

const weatherCodes = {
  0: ["Clear sky", "SUN"],
  1: ["Mainly clear", "SUN+"],
  2: ["Partly cloudy", "PART"],
  3: ["Overcast", "CLD"],
  45: ["Fog", "FOG"],
  48: ["Rime fog", "FOG"],
  51: ["Light drizzle", "DRZ"],
  53: ["Drizzle", "DRZ"],
  55: ["Dense drizzle", "DRZ"],
  61: ["Slight rain", "RAIN"],
  63: ["Rain", "RAIN"],
  65: ["Heavy rain", "RAIN"],
  80: ["Rain showers", "SHWR"],
  81: ["Rain showers", "RAIN"],
  82: ["Violent showers", "STORM"],
  95: ["Thunderstorm", "STORM"],
  96: ["Thunderstorm with hail", "STORM"],
  99: ["Thunderstorm with hail", "STORM"]
};

const activityCopy = {
  commute: "Commute",
  outdoor: "Outdoor",
  farming: "Farming",
  logistics: "Logistics"
};

const els = {
  searchForm: document.querySelector("#searchForm"),
  placeInput: document.querySelector("#placeInput"),
  geoButton: document.querySelector("#geoButton"),
  locationLabel: document.querySelector("#locationLabel"),
  updatedLabel: document.querySelector("#updatedLabel"),
  mapFrame: document.querySelector("#mapFrame"),
  currentTemp: document.querySelector("#currentTemp"),
  currentSummary: document.querySelector("#currentSummary"),
  weatherSymbol: document.querySelector("#weatherSymbol"),
  rainChance: document.querySelector("#rainChance"),
  rainAmount: document.querySelector("#rainAmount"),
  windSpeed: document.querySelector("#windSpeed"),
  windDirection: document.querySelector("#windDirection"),
  aqiValue: document.querySelector("#aqiValue"),
  aqiLabel: document.querySelector("#aqiLabel"),
  adviceTitle: document.querySelector("#adviceTitle"),
  adviceText: document.querySelector("#adviceText"),
  dailyList: document.querySelector("#dailyList"),
  hourlyChart: document.querySelector("#hourlyChart"),
  activityNote: document.querySelector("#activityNote"),
  activityName: document.querySelector("#activityName"),
  tripDay: document.querySelector("#tripDay"),
  tripDayLabel: document.querySelector("#tripDayLabel"),
  riskList: document.querySelector("#riskList"),
  routeInput: document.querySelector("#routeInput"),
  routeButton: document.querySelector("#routeButton"),
  routeResults: document.querySelector("#routeResults"),
  statusToast: document.querySelector("#statusToast")
};

const FETCH_TIMEOUT_MS = 9000;

function showStatus(message) {
  els.statusToast.textContent = message;
  els.statusToast.classList.add("show");
  window.clearTimeout(showStatus.timer);
  showStatus.timer = window.setTimeout(() => els.statusToast.classList.remove("show"), 3200);
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[char]);
}

function clamp(value, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, number));
}

async function fetchJSON(url, message) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(message);
    return await res.json();
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`${message} timed out`);
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function formatPlace(location = state.location) {
  return [location.name, location.admin1, location.country].filter(Boolean).join(", ");
}

function updateMap() {
  const { latitude, longitude } = state.location;
  const delta = 0.24;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(",");
  els.mapFrame.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;
  els.locationLabel.textContent = formatPlace();
}

function weatherInfo(code) {
  return weatherCodes[code] || ["Variable conditions", "CLD"];
}

function windCompass(deg) {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function aqiCategory(value) {
  if (value == null || Number.isNaN(value)) return ["Unknown", "watch"];
  if (value <= 50) return ["Good", "good"];
  if (value <= 100) return ["Moderate", "watch"];
  if (value <= 150) return ["Unhealthy for sensitive groups", "watch"];
  if (value <= 200) return ["Unhealthy", "alert"];
  if (value <= 300) return ["Very unhealthy", "alert"];
  return ["Hazardous", "alert"];
}

function selectedDayIndex() {
  const maxIndex = Math.max(0, (state.forecast?.daily?.time?.length || 14) - 1);
  return Math.max(0, Math.min(maxIndex, Number(state.tripDay) || 0));
}

function getDayForecast(dayIndex = selectedDayIndex()) {
  const daily = state.forecast?.daily;
  if (!daily) return null;
  return {
    date: daily.time[dayIndex],
    code: daily.weather_code[dayIndex],
    high: daily.temperature_2m_max[dayIndex],
    low: daily.temperature_2m_min[dayIndex],
    rainChance: daily.precipitation_probability_max[dayIndex],
    rain: daily.precipitation_sum[dayIndex],
    wind: daily.wind_speed_10m_max[dayIndex],
    uv: daily.uv_index_max[dayIndex]
  };
}

function currentAQI() {
  const values = state.air?.hourly?.us_aqi;
  if (!values?.length) return null;
  const times = state.air?.hourly?.time;
  if (!times?.length) return values.find(value => value != null) ?? null;

  const now = Date.now();
  const closest = values
    .map((value, index) => {
      const timestamp = new Date(times[index]).getTime();
      return {
        value,
        distance: value == null || !Number.isFinite(timestamp) ? Infinity : Math.abs(timestamp - now)
      };
    })
    .sort((a, b) => a.distance - b.distance)[0];

  return Number.isFinite(closest?.distance) ? closest.value : null;
}

function buildRisks(day = getDayForecast()) {
  const aqi = currentAQI();
  const [aqiLabel, aqiSeverity] = aqiCategory(aqi);
  const [summary] = weatherInfo(day?.code ?? state.forecast?.current?.weather_code);
  const risks = [];

  risks.push((day?.uv ?? 0) >= 6
    ? ["High UV", "Use sunscreen, sunglasses, and a cap during midday hours.", "watch"]
    : ["UV", "Sun exposure looks manageable, but sunscreen is still useful outdoors.", "good"]);

  risks.push((day?.rainChance ?? 0) >= 55 || (day?.rain ?? 0) >= 4 || /rain|thunder|drizzle/i.test(summary)
    ? ["Rain", "Carry an umbrella or raincoat; roads and trails may turn slippery.", "watch"]
    : ["Rain", "Rain risk is low for the selected day.", "good"]);

  risks.push((day?.wind ?? 0) >= 35
    ? ["Wind", "Strong gusts are possible; keep outdoor, farming, and delivery plans flexible.", "alert"]
    : ["Wind", "Winds look workable for ordinary outdoor plans.", "good"]);

  risks.push([
    "Air quality",
    `${aqiLabel}${aqi == null ? "" : `, AQI ${Math.round(aqi)}`}. ${aqiSeverity === "alert" ? "Limit outdoor exertion and keep an N95 handy." : "Outdoor exposure looks acceptable for most people."}`,
    aqiSeverity
  ]);

  if (/thunder/i.test(summary)) {
    risks.push(["Thunderstorm", "Stay indoors during lightning and wait before resuming outdoor activity.", "alert"]);
  }

  if (state.activity === "farming") {
    risks.push((day?.rainChance ?? 0) >= 50
      ? ["Crop planning", "Good chance of useful moisture. Avoid spraying windows close to expected rain.", "watch"]
      : ["Crop planning", "Dry window likely. Check irrigation and soil moisture before sowing decisions.", "good"]);
  }

  if (state.activity === "logistics") {
    risks.push((day?.rainChance ?? 0) >= 55 || (day?.wind ?? 0) >= 35
      ? ["Road safety", "Build buffer time for slick roads, gusts, and possible localized delays.", "watch"]
      : ["Road safety", "Route weather looks workable for standard delivery planning.", "good"]);
  }

  return risks;
}

function buildAdvice(day = getDayForecast()) {
  const risks = buildRisks(day);
  const alerts = risks.filter(([, , severity]) => severity === "alert");
  const watches = risks.filter(([, , severity]) => severity === "watch");
  const activity = activityCopy[state.activity];

  const persona = personaForWeather(day?.code);
  if (alerts.length) {
    return { title: `${persona} flags caution`, text: `${activity}: ${alerts[0][0]} is the main concern. ${alerts[0][1]}` };
  }
  if (watches.length) {
    return { title: `${persona} suggests prep`, text: `${activity}: ${watches[0][0]} needs attention. ${watches[0][1]}` };
  }
  return { title: `${persona} gives a green signal`, text: `${activity}: conditions look comfortable. Keep water with you and enjoy the plan.` };
}

function personaForWeather(code) {
  const [summary] = weatherInfo(code);
  if (/rain|drizzle|shower/i.test(summary)) return "Rainy Ria";
  if (/fog/i.test(summary)) return "Foggy Felix";
  if (/thunder/i.test(summary)) return "Stormy Sid";
  return "Sunny Sam";
}

function renderCurrent() {
  const current = state.forecast?.current;
  if (!current) return;
  const [summary, icon] = weatherInfo(current.weather_code);
  const aqi = currentAQI();
  const [aqiLabel] = aqiCategory(aqi);

  els.currentTemp.textContent = `${Math.round(current.temperature_2m)}\u00b0C`;
  els.currentSummary.textContent = `${summary}, feels like ${Math.round(current.apparent_temperature)}\u00b0C`;
  els.weatherSymbol.textContent = icon;
  els.rainChance.textContent = `${Math.round(state.forecast.daily.precipitation_probability_max[0] ?? 0)}%`;
  els.rainAmount.textContent = `${(state.forecast.daily.precipitation_sum[0] ?? 0).toFixed(1)} mm today`;
  els.windSpeed.textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  els.windDirection.textContent = `${windCompass(current.wind_direction_10m ?? 0)} wind`;
  els.aqiValue.textContent = aqi == null ? "--" : Math.round(aqi);
  els.aqiLabel.textContent = aqiLabel;
  els.updatedLabel.textContent = `Updated ${new Date(current.time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

function renderDaily() {
  const daily = state.forecast?.daily;
  if (!daily) return;
  els.dailyList.innerHTML = daily.time.map((date, index) => {
    const [summary, icon] = weatherInfo(daily.weather_code[index]);
    const chance = Math.round(clamp(daily.precipitation_probability_max[index] ?? 0));
    const dayName = new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "short" });
    return `
      <div class="daily-card">
        <strong>${index === 0 ? "Today" : dayName}</strong>
        <span class="mini-icon" title="${escapeHTML(summary)}">${escapeHTML(icon)}</span>
        <div class="rain-bar" aria-label="Rain chance ${chance}%"><span style="width:${chance}%"></span></div>
        <span class="temp-range">${Math.round(daily.temperature_2m_min[index])} / ${Math.round(daily.temperature_2m_max[index])}\u00b0C</span>
      </div>
    `;
  }).join("");
}

function activityScore({ rain, temp, wind }) {
  const rainValue = clamp(rain);
  const tempValue = Number.isFinite(Number(temp)) ? Number(temp) : 0;
  const windValue = Math.max(0, Number.isFinite(Number(wind)) ? Number(wind) : 0);
  const heatPenalty = state.activity === "outdoor" || state.activity === "farming"
    ? Math.max(0, tempValue - 30) * 4
    : Math.max(0, tempValue - 34) * 2;
  const windPenalty = state.activity === "outdoor" || state.activity === "logistics" ? windValue * 1.35 : windValue;
  const rainPenalty = state.activity === "farming" ? Math.abs(rainValue - 45) * 0.5 : rainValue;
  return Math.max(8, Math.min(100, 100 - heatPenalty - windPenalty - rainPenalty));
}

function scoreColor(score) {
  if (score >= 72) return "var(--mint)";
  if (score >= 45) return "var(--sun)";
  return "var(--rose)";
}

function renderHourly() {
  const hourly = state.forecast?.hourly;
  const day = getDayForecast();
  if (!hourly || !day) return;
  const hours = hourly.time
    .map((time, index) => ({ time, index }))
    .filter(item => item.time.startsWith(day.date))
    .filter((_, index) => index % 3 === 0)
    .slice(2, 10);

  els.activityName.textContent = activityCopy[state.activity];
  if (!hours.length) {
    els.hourlyChart.innerHTML = `<div class="empty-state">Hourly data is unavailable for this day.</div>`;
    els.activityNote.textContent = "Try another planning day or location.";
    return;
  }

  els.hourlyChart.innerHTML = hours.map(({ time, index }) => {
    const rain = hourly.precipitation_probability[index] ?? 0;
    const temp = hourly.temperature_2m[index] ?? 0;
    const wind = hourly.wind_speed_10m[index] ?? 0;
    const score = activityScore({ rain, temp, wind });
    const hour = new Date(time).toLocaleTimeString([], { hour: "numeric" });
    return `
      <div class="hour-card">
        <div class="hour-bar" style="height:${Math.max(18, Math.round(score * 1.55))}px; background:${scoreColor(score)}"></div>
        <strong>${hour}</strong>
        <small>${Math.round(temp)}\u00b0C ${Math.round(clamp(rain))}%</small>
      </div>
    `;
  }).join("");

  const best = hours
    .map(({ time, index }) => ({
      time,
      score: activityScore({
        rain: hourly.precipitation_probability[index] ?? 0,
        temp: hourly.temperature_2m[index] ?? 0,
        wind: hourly.wind_speed_10m[index] ?? 0
      })
    }))
    .sort((a, b) => b.score - a.score)[0];

  const bestTime = best ? new Date(best.time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "morning";
  els.activityNote.textContent = `Best ${activityCopy[state.activity].toLowerCase()} window: around ${bestTime}. Higher bars mean better comfort for rain, heat, and wind.`;
}

function renderAdvice() {
  const day = getDayForecast();
  const advice = buildAdvice(day);
  els.adviceTitle.textContent = advice.title;
  els.adviceText.textContent = advice.text;
  els.riskList.innerHTML = [
    ["Freemium subscriptions", "Free core forecasts; premium avatars, ad-free use, and long-range intelligence at Rs 99/mo.", "good"],
    ["B2B API and data insights", "Hyperlocal weather APIs and ML alerts for agri-tech, logistics, FMCG, and disaster management.", "watch"],
    ["Contextual advertising", "District-level weather-triggered ads for umbrellas, sunscreen, masks, travel, and crop inputs.", "alert"]
  ].map(([title, text, severity]) => `
    <div class="risk-item ${severity}">
      <strong>${title}</strong>
      <p>${text}</p>
    </div>
  `).join("");
}

function renderTripLabel() {
  const day = getDayForecast();
  if (!day) {
    els.tripDayLabel.textContent = "Today";
    return;
  }
  els.tripDayLabel.textContent = state.tripDay === 0
    ? "Today"
    : new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

function renderAll() {
  updateMap();
  renderCurrent();
  renderDaily();
  renderTripLabel();
  renderHourly();
  renderAdvice();
}

async function geocodePlace(query) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  const data = await fetchJSON(url, "Location search failed");
  const results = data.results || [];
  return results.find(item => item.country_code === "IN") || results[0];
}

async function fetchForecast() {
  const { latitude, longitude } = state.location;
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("current", "temperature_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m");
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,wind_speed_10m");
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,uv_index_max");
  url.searchParams.set("forecast_days", "14");
  url.searchParams.set("timezone", "auto");
  state.forecast = await fetchJSON(url, "Forecast request failed");
}

async function fetchAirQuality() {
  const { latitude, longitude } = state.location;
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", latitude);
  url.searchParams.set("longitude", longitude);
  url.searchParams.set("hourly", "us_aqi,pm10,pm2_5,ozone");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");
  try {
    state.air = await fetchJSON(url, "AQI request failed");
  } catch {
    state.air = null;
  }
}

async function loadLocation(location) {
  state.location = location;
  els.locationLabel.textContent = formatPlace();
  showStatus(`Loading ${formatPlace()}...`);
  try {
    await Promise.all([fetchForecast(), fetchAirQuality()]);
  } catch (error) {
    console.warn(error);
    state.forecast = createDemoForecast();
    state.air = createDemoAir();
    showStatus("Live API unavailable. Showing presentation demo data.");
  }
  const maxTripDay = Math.max(0, (state.forecast?.daily?.time?.length || 1) - 1);
  state.tripDay = Math.min(state.tripDay, maxTripDay);
  els.tripDay.max = String(maxTripDay);
  els.tripDay.value = String(state.tripDay);
  renderAll();
}

function createDemoForecast() {
  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const hours = Array.from({ length: 24 * 14 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setHours(index);
    return date.toISOString().slice(0, 16);
  });
  return {
    current: {
      time: new Date().toISOString(),
      temperature_2m: 31,
      apparent_temperature: 34,
      weather_code: 2,
      wind_speed_10m: 16,
      wind_direction_10m: 90
    },
    daily: {
      time: days,
      weather_code: days.map((_, index) => [2, 61, 3, 1, 80, 0, 95][index % 7]),
      temperature_2m_max: days.map((_, index) => 31 + (index % 4)),
      temperature_2m_min: days.map((_, index) => 23 + (index % 3)),
      precipitation_sum: days.map((_, index) => [0.2, 6.5, 1.1, 0, 9.2, 0, 14][index % 7]),
      precipitation_probability_max: days.map((_, index) => [18, 68, 35, 10, 76, 8, 84][index % 7]),
      wind_speed_10m_max: days.map((_, index) => [14, 22, 18, 12, 28, 10, 36][index % 7]),
      uv_index_max: days.map((_, index) => [7, 4, 5, 8, 3, 8, 2][index % 7])
    },
    hourly: {
      time: hours,
      temperature_2m: hours.map((_, index) => 24 + ((index + 6) % 12)),
      precipitation_probability: hours.map((_, index) => [12, 18, 25, 40, 65, 55, 30, 15][Math.floor(index / 3) % 8]),
      wind_speed_10m: hours.map((_, index) => 8 + (index % 9))
    }
  };
}

function createDemoAir() {
  return { hourly: { us_aqi: [118, 111, 104, 96] } };
}

async function searchAndLoad(query) {
  const location = await geocodePlace(query);
  if (!location) throw new Error("No matching location found");
  await loadLocation(location);
}

async function checkRoute() {
  const stops = els.routeInput.value.split(",").map(stop => stop.trim()).filter(Boolean).slice(0, 5);
  if (!stops.length) {
    showStatus("Add route stops separated by commas.");
    return;
  }
  els.routeResults.innerHTML = "";
  showStatus("Checking route stops...");

  const cards = [];
  for (const stop of stops) {
    try {
      const location = await geocodePlace(stop);
      if (!location) throw new Error("No match");
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", location.latitude);
      url.searchParams.set("longitude", location.longitude);
      url.searchParams.set("daily", "precipitation_probability_max,temperature_2m_max,wind_speed_10m_max");
      url.searchParams.set("forecast_days", "1");
      url.searchParams.set("timezone", "auto");
      const data = await fetchJSON(url, "Forecast unavailable");
      const rain = Math.round(data.daily.precipitation_probability_max[0] ?? 0);
      const temp = Math.round(data.daily.temperature_2m_max[0] ?? 0);
      const wind = Math.round(data.daily.wind_speed_10m_max[0] ?? 0);
      cards.push(`<div class="route-stop"><strong>${escapeHTML(formatPlace(location))}</strong><br>${temp}\u00b0C high, ${Math.round(clamp(rain))}% rain, ${wind} km/h wind</div>`);
    } catch {
      cards.push(`<div class="route-stop"><strong>${escapeHTML(stop)}</strong><br>Forecast unavailable</div>`);
    }
  }

  els.routeResults.innerHTML = cards.join("");
}

els.searchForm.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await searchAndLoad(els.placeInput.value.trim() || "New Delhi");
  } catch (error) {
    showStatus(error.message);
  }
});

els.geoButton.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showStatus("Geolocation is not available in this browser.");
    return;
  }
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const { latitude, longitude } = position.coords;
      await loadLocation({ name: "Current location", country: "India", latitude, longitude });
    } catch (error) {
      showStatus(error.message);
    }
  }, () => showStatus("Location permission was not granted."));
});

document.querySelectorAll("[data-city]").forEach(button => {
  button.addEventListener("click", async () => {
    els.placeInput.value = button.dataset.city;
    try {
      await searchAndLoad(button.dataset.city);
    } catch (error) {
      showStatus(error.message);
    }
  });
});

document.querySelectorAll("[data-activity]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-activity]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    state.activity = button.dataset.activity;
    renderHourly();
    renderAdvice();
  });
});

els.tripDay.addEventListener("input", event => {
  state.tripDay = Number(event.target.value);
  renderTripLabel();
  renderHourly();
  renderAdvice();
});

els.routeButton.addEventListener("click", checkRoute);

loadLocation(state.location).catch(error => showStatus(error.message));
