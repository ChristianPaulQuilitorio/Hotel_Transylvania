import { Injectable } from '@angular/core';

export type WeatherInfo = {
  temperatureC?: number;
  weatherCode?: number;
  description?: string;
};

// Minimal mapping from WMO weather codes to text
const WMO: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with hail',
  99: 'Severe thunderstorm with hail',
};

@Injectable({ providedIn: 'root' })
export class WeatherService {
  async getCurrent(): Promise<WeatherInfo | null> {
    try {
      const coords = await this.getCoords();
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,weather_code`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('weather http error');
      const json = await res.json();
      const temp = json?.current?.temperature_2m;
      const code = json?.current?.weather_code;
      const description = typeof code === 'number' ? (WMO[code] ?? 'Weather') : undefined;
      return { temperatureC: typeof temp === 'number' ? temp : undefined, weatherCode: code, description };
    } catch {
      return null;
    }
  }

  private getCoords(): Promise<{ lat: number; lon: number }> {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
          () => resolve({ lat: 14.5995, lon: 120.9842 }) // Fallback: Manila
        );
      } else {
        resolve({ lat: 14.5995, lon: 120.9842 });
      }
    });
  }
}
