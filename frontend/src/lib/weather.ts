import type { FakeWeatherReading } from './weatherMock'
import { getFakeWeather } from './weatherMock'

export interface WeatherState {
  readings: FakeWeatherReading[]
  updatedAt: string
}

export function buildWeatherState(): WeatherState {
  const readings = getFakeWeather()
  return {
    readings,
    updatedAt: new Date().toISOString(),
  }
}
