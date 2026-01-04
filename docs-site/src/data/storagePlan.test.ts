import { describe, it, expect } from 'vitest'
import {
  createDefaultStoragePlan,
  DEFAULT_DATA_ROOT,
  STORAGE_CATEGORIES,
  type StoragePlan,
} from './storagePlan'

describe('storagePlan', () => {
  describe('STORAGE_CATEGORIES', () => {
    it('should have required categories', () => {
      const categoryIds = STORAGE_CATEGORIES.map((c) => c.id)
      expect(categoryIds).toContain('dataRoot')
      expect(categoryIds).toContain('configRoot')
      expect(categoryIds).toContain('downloads')
      expect(categoryIds).toContain('movies')
      expect(categoryIds).toContain('tv')
      expect(categoryIds).toContain('music')
      expect(categoryIds).toContain('books')
      expect(categoryIds).toContain('audiobooks')
      expect(categoryIds).toContain('photos')
      expect(categoryIds).toContain('transcode')
    })

    it('should have dataRoot and configRoot always visible', () => {
      const dataRoot = STORAGE_CATEGORIES.find((c) => c.id === 'dataRoot')
      const configRoot = STORAGE_CATEGORIES.find((c) => c.id === 'configRoot')
      expect(dataRoot?.alwaysVisible).toBe(true)
      expect(configRoot?.alwaysVisible).toBe(true)
    })

    it('should have valid service mappings', () => {
      const movies = STORAGE_CATEGORIES.find((c) => c.id === 'movies')
      expect(movies?.services).toContain('plex')
      expect(movies?.services).toContain('jellyfin')
      expect(movies?.services).toContain('radarr')

      const downloads = STORAGE_CATEGORIES.find((c) => c.id === 'downloads')
      expect(downloads?.services).toContain('torrent')
      expect(downloads?.services).toContain('usenet')
    })

    it('should have defaultPath functions that work correctly', () => {
      const testRoot = '/test/root'
      STORAGE_CATEGORIES.forEach((category) => {
        const path = category.defaultPath(testRoot)
        expect(path).toBeDefined()
        expect(typeof path).toBe('string')
        if (category.id === 'dataRoot') {
          expect(path).toBe(testRoot)
        } else {
          expect(path.startsWith(testRoot)).toBe(true)
        }
      })
    })
  })

  describe('createDefaultStoragePlan', () => {
    it('should create a plan with all categories', () => {
      const plan = createDefaultStoragePlan()
      STORAGE_CATEGORIES.forEach((category) => {
        expect(plan[category.id]).toBeDefined()
      })
    })

    it('should use DEFAULT_DATA_ROOT when no root specified', () => {
      const plan = createDefaultStoragePlan()
      expect(plan.dataRoot.path).toBe(DEFAULT_DATA_ROOT)
    })

    it('should use custom root when provided', () => {
      const customRoot = '/custom/media'
      const plan = createDefaultStoragePlan(customRoot)
      expect(plan.dataRoot.path).toBe(customRoot)
      expect(plan.configRoot.path).toBe(`${customRoot}/config`)
      expect(plan.movies.path).toBe(`${customRoot}/media/movies`)
      expect(plan.downloads.path).toBe(`${customRoot}/downloads`)
    })

    it('should set all paths as local type by default', () => {
      const plan = createDefaultStoragePlan()
      Object.values(plan).forEach((setting) => {
        expect(setting.type).toBe('local')
      })
    })

    it('should generate correct nested paths', () => {
      const root = '/srv/data'
      const plan = createDefaultStoragePlan(root)

      expect(plan.tv.path).toBe(`${root}/media/tv`)
      expect(plan.music.path).toBe(`${root}/media/music`)
      expect(plan.books.path).toBe(`${root}/media/books`)
      expect(plan.audiobooks.path).toBe(`${root}/media/audiobooks`)
      expect(plan.photos.path).toBe(`${root}/media/photos`)
      expect(plan.transcode.path).toBe(`${root}/transcode`)
    })
  })

  describe('DEFAULT_DATA_ROOT', () => {
    it('should be a valid path string', () => {
      expect(typeof DEFAULT_DATA_ROOT).toBe('string')
      expect(DEFAULT_DATA_ROOT.length).toBeGreaterThan(0)
      expect(DEFAULT_DATA_ROOT.startsWith('/')).toBe(true)
    })
  })

  describe('StoragePlan type', () => {
    it('should allow valid storage plans', () => {
      const plan: StoragePlan = {
        dataRoot: { path: '/data', type: 'local' },
        movies: { path: '/data/movies', type: 'network' },
      }
      expect(plan.dataRoot.type).toBe('local')
      expect(plan.movies.type).toBe('network')
    })
  })
})
