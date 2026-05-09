/** Open-Meteo free API (no key). Assumptions documented in repo README. */
export type WeatherSnapshot = {
    adverse: boolean;
    windMps: number;
    gustMps: number;
    fetchedAt: number;
};
/** Assumption: adverse if sustained wind ≥ 12 m/s or gusts ≥ 18 m/s (adjust in README). */
export declare function classifyAdverse(windMps: number, gustMps: number): boolean;
export declare function fetchWeatherAt(lat: number, lng: number): Promise<WeatherSnapshot>;
/** Interpolate risk 0..1 from cached samples (simple nearest). */
export declare function weatherCostMultiplierAt(lat: number, lng: number): number;
export declare function primeWeatherCache(): void;
