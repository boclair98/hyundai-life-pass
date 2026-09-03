const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? '';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (response.redirected && !response.url.includes('/api/')) {
    window.location.assign(response.url);
    throw new Error('로그인이 필요합니다.');
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error ?? `요청을 처리하지 못했습니다. (${response.status})`);
  }

  return response.status === 204 ? null : response.json();
}

function normalizeVehicle(vehicle) {
  return {
    ...vehicle,
    databaseId: vehicle.id,
    id: vehicle.externalId,
    range: vehicle.rangeKm,
    odometer: vehicle.odometerKm,
  };
}

export async function loadVehicles() {
  try {
    const vehicles = await request('/api/v1/vehicles');
    const normalized = vehicles.map(normalizeVehicle);
    return { vehicles: normalized, source: normalized.length ? 'platform' : 'empty' };
  } catch (error) {
    return { vehicles: [], source: 'error', error: error.message };
  }
}

export const loadPlatform = () => request('/api/v1/platform/snapshot');
export const loadReleases = () => request('/api/v1/releases');
export const loadAuditLogs = () => request('/api/v1/platform/audit-logs').catch(() => []);
export const loadPassport = (vehicleDatabaseId) => request(`/api/v1/vehicles/${vehicleDatabaseId}/passport`);
export const connectVehicle = (externalId) => request(`/api/v1/platform/vehicles/${externalId}/connect`, { method: 'POST' });
export const hyundaiAuthorizationPath = '/api/v1/integrations/hyundai/authorize';
export const loadServiceCenters = ({ latitude = 37.5446, longitude = 127.0559, radius = 15000 } = {}) => {
  const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), radius: String(radius) });
  return request(`/api/v1/service-centers?${query}`);
};
export const syncHyundaiVehicles = () => request('/api/v1/integrations/hyundai/sync', { method: 'POST' });
export const revokeHyundaiConnection = () => request('/api/v1/integrations/hyundai/revoke', { method: 'POST' });

export const reserveCharging = ({ vehicleExternalId, stationId, scheduledAt, targetSoc = 80 }) => request('/api/v1/platform/charging-reservations', {
  method: 'POST',
  body: JSON.stringify({ vehicleExternalId, stationId, scheduledAt, targetSoc }),
});

export const cancelCharging = (id) => request(`/api/v1/platform/charging-reservations/${id}/cancel`, { method: 'POST' });

export const bookService = ({ vehicleExternalId, centerName, serviceType, scheduledAt }) => request('/api/v1/platform/service-bookings', {
  method: 'POST',
  body: JSON.stringify({ vehicleExternalId, centerName, serviceType, scheduledAt }),
});

export const cancelService = (id) => request(`/api/v1/platform/service-bookings/${id}/cancel`, { method: 'POST' });

export const startHandover = ({ vehicleExternalId, buyerEmail }) => request('/api/v1/platform/handovers', {
  method: 'POST',
  body: JSON.stringify({ vehicleExternalId, buyerEmail }),
});

export const advanceHandover = (id) => request(`/api/v1/platform/handovers/${id}/advance`, { method: 'POST' });
export const readNotification = (id) => request(`/api/v1/platform/notifications/${id}/read`, { method: 'POST' });
export const startRelease = (id) => request(`/api/v1/releases/${id}/start`, { method: 'POST' });
export const advanceRelease = (id) => request(`/api/v1/releases/${id}/advance`, { method: 'POST' });
export const pauseRelease = (id) => request(`/api/v1/releases/${id}/pause`, { method: 'POST' });
