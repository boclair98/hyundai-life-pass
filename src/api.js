import { demoVehicles } from './data';

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '');

export async function loadVehicles() {
  if (!API_BASE) return { vehicles: demoVehicles, source: 'demo' };

  try {
    const response = await fetch(`${API_BASE}/api/v1/vehicles`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) throw new Error(`Vehicle API returned ${response.status}`);
    const vehicles = await response.json();
    const normalized = vehicles.map((vehicle) => ({
      ...vehicle,
      id: vehicle.externalId,
      range: vehicle.rangeKm,
      odometer: vehicle.odometerKm,
    }));
    return { vehicles: normalized.length ? normalized : demoVehicles, source: 'api' };
  } catch {
    return { vehicles: demoVehicles, source: 'demo' };
  }
}
