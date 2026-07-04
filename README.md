# WeatherBuddy AI

WeatherBuddy AI is an India-focused weather forecasting prototype based on the `WeatherBuddy_AI.pptx` deck. It turns the pitch into a working browser app with live weather data, AQI signals, avatar advice, outdoor planning, and prototype AI/business sections.

## What is included

- City, district, or pincode-style location search using Open-Meteo geocoding
- Live current, hourly, and 14-day forecast panels
- AQI signal from Open-Meteo air quality data when available
- Sunny Sam, Rainy Ria, and Foggy Felix avatar messaging
- Commute, outdoor, farm, and road profile advice
- Hiking/cycling/commute/farm visit readiness score
- India-focused coordinate map mockup
- Prototype AI stack and monetization panels from the deck

## Run locally

Open `index.html` directly in a browser, or serve the folder locally:

```powershell
py -m http.server 5173
```

Then visit:

```text
http://localhost:5173
```

The app uses public Open-Meteo APIs and does not require an API key.
