/**
 * FloodWatch Data Sources Architecture Hook
 *
 * Prepared contracts and modular connectors for future AI tool calling & data grounding:
 * - Rainfall observations (ThaiWater / Supabase)
 * - Water level observations (ThaiWater / Supabase)
 * - Dam / discharge data (RID / ThaiWater)
 * - Flood events (GISTDA satellite extents)
 * - Weather forecasts (Open-Meteo)
 * - GloFAS hydrological predictions
 */

export interface RainfallObservationQuery {
  district?: string;
  stationId?: string;
}

export interface WaterLevelObservationQuery {
  stationId?: string;
  riverName?: string;
  district?: string;
}

export interface DamDischargeQuery {
  damName?: 'Chao Phraya' | 'Pasak Jolasid' | 'Rama VI' | string;
}

export interface FloodEventsQuery {
  district?: string;
  daysBack?: number;
}

export interface WeatherForecastQuery {
  latitude: number;
  longitude: number;
  forecastDays?: number;
}

export interface GlofasQuery {
  stationId?: string;
  returnPeriodThreshold?: number;
}

export interface DataSourceResult<T = unknown> {
  available: boolean;
  data?: T;
  message: string;
}

/**
 * Modular data source registry.
 * Future versions will wire these directly to database queries and external feeds.
 */
export const dataSources = {
  async getRainfallObservations(
    query?: RainfallObservationQuery
  ): Promise<DataSourceResult> {
    return {
      available: false,
      message: 'Live rainfall data feed is not yet connected to the chat assistant.',
    };
  },

  async getWaterLevelObservations(
    query?: WaterLevelObservationQuery
  ): Promise<DataSourceResult> {
    return {
      available: false,
      message: 'Live water level data feed is not yet connected to the chat assistant.',
    };
  },

  async getDamDischargeData(
    query?: DamDischargeQuery
  ): Promise<DataSourceResult> {
    return {
      available: false,
      message: 'Live dam discharge data feed is not yet connected to the chat assistant.',
    };
  },

  async getFloodEvents(
    query?: FloodEventsQuery
  ): Promise<DataSourceResult> {
    return {
      available: false,
      message: 'Live GISTDA satellite flood extent feed is not yet connected to the chat assistant.',
    };
  },

  async getWeatherForecast(
    query?: WeatherForecastQuery
  ): Promise<DataSourceResult> {
    return {
      available: false,
      message: 'Live weather forecast feed is not yet connected to the chat assistant.',
    };
  },

  async getGlofasData(
    query?: GlofasQuery
  ): Promise<DataSourceResult> {
    return {
      available: false,
      message: 'Live GloFAS river discharge prediction feed is not yet connected to the chat assistant.',
    };
  },
};
