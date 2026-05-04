export type TrackingSample = {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  recordedAt: number;
};

type TrackingDecisionInput = {
  previous: TrackingSample | null;
  next: TrackingSample;
};

const MIN_UPDATE_INTERVAL_MS = 3_000;
const HEARTBEAT_INTERVAL_MS = 10_000;
const MIN_MOVEMENT_METERS = 2;
const ACCURACY_IMPROVEMENT_RATIO = 0.3;
const MIN_ACCURACY_IMPROVEMENT_METERS = 10;
const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

export const distanceMeters = (from: Pick<TrackingSample, 'latitude' | 'longitude'>, to: Pick<TrackingSample, 'latitude' | 'longitude'>) => {
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(fromLat) * Math.cos(toLat) *
      Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const toKmh = (metersPerSecond?: number | null) => {
  if (typeof metersPerSecond !== 'number' || !Number.isFinite(metersPerSecond)) return null;
  return metersPerSecond * 3.6;
};

const improvedAccuracy = (previous?: number | null, next?: number | null) => {
  if (typeof previous !== 'number' || typeof next !== 'number') return false;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return false;
  if (next >= previous) return false;

  const improvementMeters = previous - next;
  return improvementMeters >= MIN_ACCURACY_IMPROVEMENT_METERS || improvementMeters / previous >= ACCURACY_IMPROVEMENT_RATIO;
};

export const shouldSendTrackingPoint = ({ previous, next }: TrackingDecisionInput) => {
  if (!previous) return true;

  const elapsedMs = next.recordedAt - previous.recordedAt;
  if (elapsedMs >= HEARTBEAT_INTERVAL_MS) return true;
  if (improvedAccuracy(previous.accuracy, next.accuracy)) return true;
  if (elapsedMs < MIN_UPDATE_INTERVAL_MS) return false;

  return distanceMeters(previous, next) >= MIN_MOVEMENT_METERS;
};

export const TRACKING_DECISION_DEFAULTS = {
  minUpdateIntervalMs: MIN_UPDATE_INTERVAL_MS,
  heartbeatIntervalMs: HEARTBEAT_INTERVAL_MS,
  minMovementMeters: MIN_MOVEMENT_METERS,
};
