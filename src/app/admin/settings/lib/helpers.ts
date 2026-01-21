/**
 * Component: Admin Settings - Helper Functions
 * Documentation: documentation/settings-pages.md
 */

import { fetchWithAuth } from '@/lib/utils/api';
import type { Settings, SettingsTab, SavedIndexerConfig } from './types';
import type { IndexerFlagConfig } from '@/lib/utils/ranking-algorithm';

/**
 * Converts JSON array string to comma-separated string for display
 */
export const parseArrayToCommaSeparated = (jsonStr: string): string => {
  try {
    const arr = JSON.parse(jsonStr);
    return Array.isArray(arr) ? arr.join(', ') : '';
  } catch {
    return '';
  }
};

/**
 * Converts comma-separated string to JSON array string for storage
 */
export const parseCommaSeparatedToArray = (str: string): string => {
  if (!str || str.trim() === '') return '[]';
  const items = str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  return JSON.stringify(items);
};

/**
 * Saves settings for a specific tab
 */
export const saveTabSettings = async (
  activeTab: SettingsTab,
  settings: Settings,
  configuredIndexers: SavedIndexerConfig[],
  flagConfigs: IndexerFlagConfig[]
): Promise<void> => {
  switch (activeTab) {
    case 'library':
      // Save Audible region
      await fetchWithAuth('/api/admin/settings/audible', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: settings.audibleRegion }),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save Audible region settings');
      });

      // Save backend-specific settings
      if (settings.backendMode === 'plex') {
        await fetchWithAuth('/api/admin/settings/plex', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings.plex),
        }).then(res => {
          if (!res.ok) throw new Error('Failed to save Plex settings');
        });
      } else {
        await fetchWithAuth('/api/admin/settings/audiobookshelf', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings.audiobookshelf),
        }).then(res => {
          if (!res.ok) throw new Error('Failed to save Audiobookshelf settings');
        });
      }
      break;

    case 'auth':
      // Save OIDC settings if enabled
      if (settings.oidc.enabled) {
        const oidcPayload = {
          ...settings.oidc,
          allowedEmails: parseCommaSeparatedToArray(settings.oidc.allowedEmails),
          allowedUsernames: parseCommaSeparatedToArray(settings.oidc.allowedUsernames),
        };

        await fetchWithAuth('/api/admin/settings/oidc', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(oidcPayload),
        }).then(res => {
          if (!res.ok) throw new Error('Failed to save OIDC settings');
        });
      }

      // Save registration settings
      await fetchWithAuth('/api/admin/settings/registration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.registration),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save registration settings');
      });
      break;

    case 'prowlarr':
      // Save Prowlarr URL and API key
      await fetchWithAuth('/api/admin/settings/prowlarr', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.prowlarr),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save Prowlarr settings');
      });

      // Save indexer configuration and flag configs
      const indexersForSave = configuredIndexers.map(idx => ({ ...idx, enabled: true }));
      await fetchWithAuth('/api/admin/settings/prowlarr/indexers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ indexers: indexersForSave, flagConfigs }),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save indexer configuration');
      });
      break;

    case 'download':
      await fetchWithAuth('/api/admin/settings/download-client', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.downloadClient),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save download client settings');
      });
      break;

    case 'paths':
      await fetchWithAuth('/api/admin/settings/paths', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings.paths),
      }).then(res => {
        if (!res.ok) throw new Error('Failed to save paths settings');
      });
      break;

    default:
      throw new Error('Unknown settings tab or tab handles its own saving');
  }
};

/**
 * Validates that authentication is properly configured in Audiobookshelf mode
 */
export const validateAuthSettings = (settings: Settings): { valid: boolean; message?: string } => {
  if (settings.backendMode === 'audiobookshelf') {
    if (!settings.oidc.enabled && !settings.registration.enabled && !settings.hasLocalUsers) {
      return {
        valid: false,
        message: 'At least one authentication method must be enabled (OIDC or Manual Registration) since no local users exist. Otherwise, you will be locked out of the system.',
      };
    }
  }
  return { valid: true };
};

/**
 * Gets validation status for the current tab
 */
export const getTabValidation = (
  activeTab: SettingsTab,
  settings: Settings,
  originalSettings: Settings | null,
  validated: {
    plex: boolean;
    audiobookshelf: boolean;
    oidc: boolean;
    registration: boolean;
    prowlarr: boolean;
    download: boolean;
    paths: boolean;
  }
): boolean => {
  switch (activeTab) {
    case 'library':
      return settings.backendMode === 'plex' ? validated.plex : validated.audiobookshelf;
    case 'auth':
      return validated.oidc || validated.registration;
    case 'prowlarr':
      // Only require validation if URL or API key changed
      // If only indexers/flags changed, allow saving without test
      if (!originalSettings) return validated.prowlarr;

      const prowlarrConnectionChanged =
        settings.prowlarr.url !== originalSettings.prowlarr.url ||
        settings.prowlarr.apiKey !== originalSettings.prowlarr.apiKey;

      return prowlarrConnectionChanged ? validated.prowlarr : true;
    case 'download':
      return validated.download;
    case 'paths':
      return validated.paths;
    case 'ebook':
    case 'bookdate':
      return true; // These tabs handle their own saving
    default:
      return false;
  }
};

/**
 * Gets tab configuration based on backend mode
 */
export const getTabs = (backendMode: 'plex' | 'audiobookshelf') => [
  { id: 'library' as const, label: backendMode === 'plex' ? 'Plex' : 'Audiobookshelf', icon: '📺' },
  ...(backendMode === 'audiobookshelf' ? [{ id: 'auth' as const, label: 'Authentication', icon: '🔐' }] : []),
  { id: 'prowlarr' as const, label: 'Indexers', icon: '🔍' },
  { id: 'download' as const, label: 'Download Client', icon: '⬇️' },
  { id: 'paths' as const, label: 'Paths', icon: '📁' },
  { id: 'ebook' as const, label: 'E-book Sidecar', icon: '📖' },
  { id: 'bookdate' as const, label: 'BookDate', icon: '📚' },
  { id: 'notifications' as const, label: 'Notifications', icon: '🔔' },
];
