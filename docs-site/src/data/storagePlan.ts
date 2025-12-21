export type StoragePathType = 'local' | 'network'

export interface StoragePathSetting {
  path: string
  type: StoragePathType
}

export type StoragePlan = Record<string, StoragePathSetting>

export interface StorageCategoryDefinition {
  id: string
  label: string
  description: string
  services: string[]
  defaultPath: (root: string) => string
  alwaysVisible?: boolean
}

export const DEFAULT_DATA_ROOT = '/srv/mediastack'

export const STORAGE_CATEGORIES: StorageCategoryDefinition[] = [
  {
    id: 'dataRoot',
    label: 'Data Root',
    description: 'Base folder where all generated configs, media, and downloads live.',
    services: [],
    alwaysVisible: true,
    defaultPath: (root) => root,
  },
  {
    id: 'configRoot',
    label: 'Config Backups',
    description: 'All generated docker, Authelia, and Homepage configs are written here.',
    services: [],
    alwaysVisible: true,
    defaultPath: (root) => `${root}/config`,
  },
  {
    id: 'downloads',
    label: 'Downloads',
    description: 'qBittorrent/SABnzbd download directory shared with the *Arr apps.',
    services: ['torrent', 'usenet', 'sonarr', 'radarr', 'lidarr', 'readarr', 'bazarr', 'arr'],
    defaultPath: (root) => `${root}/downloads`,
  },
  {
    id: 'movies',
    label: 'Movies Library',
    description: 'Radarr imports and Plex/Jellyfin/Emby read this directory.',
    services: ['plex', 'jellyfin', 'emby', 'radarr', 'transcode', 'arr'],
    defaultPath: (root) => `${root}/media/movies`,
  },
  {
    id: 'tv',
    label: 'TV Library',
    description: 'Sonarr imports episodic content here and media servers stream from it.',
    services: ['plex', 'jellyfin', 'emby', 'sonarr', 'transcode', 'arr'],
    defaultPath: (root) => `${root}/media/tv`,
  },
  {
    id: 'music',
    label: 'Music Library',
    description: 'Lidarr-managed music plus Plex/Jellyfin music libraries.',
    services: ['plex', 'jellyfin', 'lidarr'],
    defaultPath: (root) => `${root}/media/music`,
  },
  {
    id: 'books',
    label: 'Books & Comics',
    description: 'Used by Readarr and Kavita for ebooks, manga, and comics.',
    services: ['readarr', 'kavita'],
    defaultPath: (root) => `${root}/media/books`,
  },
  {
    id: 'audiobooks',
    label: 'Audiobooks',
    description: 'Shared by Readarr and Audiobookshelf for long-form audio.',
    services: ['audiobookshelf', 'readarr'],
    defaultPath: (root) => `${root}/media/audiobooks`,
  },
  {
    id: 'photos',
    label: 'Photo Library',
    description: 'PhotoPrism watches this directory for pictures and memories.',
    services: ['photoprism'],
    defaultPath: (root) => `${root}/media/photos`,
  },
  {
    id: 'transcode',
    label: 'Transcode / Temp',
    description: 'Used by Plex/Jellyfin transient transcodes or Tdarr worker cache.',
    services: ['plex', 'jellyfin', 'transcode'],
    defaultPath: (root) => `${root}/transcode`,
  },
]

export const createDefaultStoragePlan = (dataRoot: string = DEFAULT_DATA_ROOT): StoragePlan =>
  STORAGE_CATEGORIES.reduce<StoragePlan>((acc, category) => {
    acc[category.id] = {
      path: category.defaultPath(dataRoot),
      type: 'local',
    }
    return acc
  }, {})
