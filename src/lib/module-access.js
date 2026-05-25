import { getFeatureDefinition, isFeatureEnabled } from './features';

function getModuleName(featureKey) {
  const definition = getFeatureDefinition(featureKey);
  const label = definition?.label || String(featureKey || 'Module').replaceAll('_', ' ').toLowerCase();

  return label
    .split(' ')
    .map((word) => (word.length <= 2 ? word.toUpperCase() : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(' ');
}

export function getModuleUnavailableMessage(featureKey) {
  return `${getModuleName(featureKey)} is not enabled`;
}

export class ModuleAccessError extends Error {
  constructor(featureKey) {
    super(getModuleUnavailableMessage(featureKey));
    this.status = 403;
    this.code = 'MODULE_DISABLED';
    this.featureKey = featureKey;
  }
}

export function requireFeatureEnabled(profile, featureKey) {
  if (!isFeatureEnabled(profile?.enabledFeatures, featureKey)) {
    throw new ModuleAccessError(featureKey);
  }

  return true;
}

export function getFeatureRouteAccess(profile, featureKey) {
  const definition = getFeatureDefinition(featureKey);
  const enabled = isFeatureEnabled(profile?.enabledFeatures, featureKey);

  return {
    enabled,
    featureKey,
    moduleName: getModuleName(featureKey),
    description: definition?.description || 'This admin module is currently disabled.',
    message: enabled ? null : getModuleUnavailableMessage(featureKey),
  };
}
