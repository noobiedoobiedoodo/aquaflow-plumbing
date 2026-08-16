export interface RouteResult {
  distanceMeters: number | null;
  durationSeconds: number | null;
  provider: string;
  calculatedAt: Date;
  trafficAware: boolean;
}

export interface IRoutingProvider {
  getRoute(originLat: number, originLng: number, destLat: number, destLng: number): Promise<RouteResult>;
}

const HAVERSINE_R = 6371e3; // meters

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return HAVERSINE_R * c;
}

export class HaversineRoutingProvider implements IRoutingProvider {
  async getRoute(originLat: number, originLng: number, destLat: number, destLng: number): Promise<RouteResult> {
    const distanceMeters = haversineDistanceMeters(originLat, originLng, destLat, destLng);
    
    return {
      distanceMeters,
      durationSeconds: null, // We do NOT fake travel times for Haversine
      provider: 'HAVERSINE',
      calculatedAt: new Date(),
      trafficAware: false
    };
  }
}

import { redis } from '../queue/redis';

export class MapboxRoutingProvider implements IRoutingProvider {
  private fallback = new HaversineRoutingProvider();

  async getRoute(originLat: number, originLng: number, destLat: number, destLng: number): Promise<RouteResult> {
    const cacheKey = `route:${originLat.toFixed(4)},${originLng.toFixed(4)}:${destLat.toFixed(4)},${destLng.toFixed(4)}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.calculatedAt = new Date(parsed.calculatedAt);
        return parsed;
      }
    } catch (e) {
      console.warn('Redis cache read failed for Mapbox route', e);
    }

    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      console.warn('MAPBOX_ACCESS_TOKEN not found, falling back to Haversine');
      return this.fallback.getRoute(originLat, originLng, destLat, destLng);
    }

    try {
      // Mapbox Directions API requires lng,lat
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${originLng},${originLat};${destLng},${destLat}?access_token=${token}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      
      if (!res.ok) {
        throw new Error(`Mapbox API error: ${res.statusText}`);
      }

      const data = await res.json();
      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found from Mapbox');
      }

      const route = data.routes[0];
      const result: RouteResult = {
        distanceMeters: route.distance,
        durationSeconds: route.duration,
        provider: 'MAPBOX',
        calculatedAt: new Date(),
        trafficAware: true
      };

      // Cache for 15 minutes to balance API cost vs traffic freshness
      try {
        await redis.setex(cacheKey, 900, JSON.stringify(result));
      } catch (e) {
        console.warn('Redis cache write failed for Mapbox route', e);
      }

      return result;

    } catch (error) {
      console.error('Mapbox routing failed, falling back to Haversine:', error);
      return this.fallback.getRoute(originLat, originLng, destLat, destLng);
    }
  }
}

// Factory export
export const routingProvider: IRoutingProvider = process.env.MAPBOX_ACCESS_TOKEN 
  ? new MapboxRoutingProvider() 
  : new HaversineRoutingProvider();
