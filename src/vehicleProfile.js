const normalize = (value) => String(value ?? '').trim().toLowerCase();

const firstNumber = (...values) => {
  for (const value of values) {
    if (value == null || value === '') continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
};

// Hyundai responses are not identical across connected-car products. Keep the
// classification conservative: only show an energy-specific label when the
// response gives us a clear signal or a known powertrain term.
export function vehiclePowertrain(vehicle) {
  const raw = [vehicle?.powertrain, vehicle?.fuelType, vehicle?.fuel, vehicle?.engineType, vehicle?.vehicleType, vehicle?.trim, vehicle?.name]
    .map(normalize)
    .join(' ');
  if (/hybrid|phev|하이브리드|플러그.?인/.test(raw)) return 'HYBRID';
  if (/electric|bev|ev|전기|일렉트릭|배터리/.test(raw) || vehicle?.batterySoc != null || vehicle?.chargingState) return 'EV';
  if (/gasoline|petrol|diesel|ice|내연|가솔린|휘발유|디젤|경유/.test(raw)) return 'ICE';
  return 'UNKNOWN';
}

export function vehicleEnergyProfile(vehicle) {
  const kind = vehiclePowertrain(vehicle);
  const fuelLevel = firstNumber(vehicle?.fuelLevel, vehicle?.fuelLevelPercent, vehicle?.fuelRemainingPercent);
  const batterySoc = firstNumber(vehicle?.batterySoc);
  const isFuel = kind === 'ICE' || kind === 'HYBRID';
  const value = isFuel ? fuelLevel : batterySoc;
  const label = isFuel ? '연료 잔량' : kind === 'UNKNOWN' ? '에너지 상태' : '배터리';
  const shortLabel = isFuel ? '연료' : kind === 'UNKNOWN' ? '에너지' : '배터리';
  const available = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
  return {
    kind,
    isElectric: kind === 'EV',
    isFuel,
    label,
    shortLabel,
    value: available,
    unit: '%',
    state: vehicle?.chargingState || (isFuel ? '연료 상태 확인' : '상태 확인 중'),
  };
}
