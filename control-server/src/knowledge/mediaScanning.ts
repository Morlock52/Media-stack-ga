/**
 * Media Scanning Knowledge Module
 * Comprehensive knowledge base for diagnosing and fixing Plex/Jellyfin media scanning issues
 * Covers library not updating, file naming conventions, permissions, transcoding problems, and metadata issues
 */

import { createLogger } from '../utils/logger.js';
import { getErrorMessage } from '../utils/errors.js';

const logger = createLogger('mediaScanningKnowledge');

/** Severity level for issues */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Media server types */
export type MediaServer = 'plex' | 'jellyfin' | 'emby';

/** Media type */
export type MediaType = 'movies' | 'tv' | 'music' | 'photos' | 'other';

/** Diagnostic step */
export interface DiagnosticStep {
    /** Step number */
    order: number;
    /** Description of what to check */
    description: string;
    /** Command to run (if applicable) */
    command?: string;
    /** Expected result */
    expectedResult?: string;
    /** How to interpret the result */
    interpretation?: string;
}

/** Solution to an issue */
export interface Solution {
    /** Solution title */
    title: string;
    /** Detailed explanation */
    description: string;
    /** Steps to implement the solution */
    steps: string[];
    /** Configuration example (if applicable) */
    configExample?: string;
    /** Environment variables to set */
    envVars?: Record<string, string>;
    /** Whether this requires container restart */
    requiresRestart: boolean;
    /** Additional notes or warnings */
    notes?: string;
}

/** Media scanning issue pattern */
export interface MediaScanningIssuePattern {
    /** Unique issue identifier */
    id: string;
    /** Issue title */
    title: string;
    /** Detailed description */
    description: string;
    /** Severity level */
    severity: IssueSeverity;
    /** Symptoms to look for */
    symptoms: string[];
    /** Log patterns that indicate this issue (regex) */
    logPatterns?: string[];
    /** Which media servers this affects */
    affectedServers?: MediaServer[];
    /** Which media types this affects */
    affectedMediaTypes?: MediaType[];
    /** Diagnostic steps */
    diagnostics: DiagnosticStep[];
    /** Possible solutions */
    solutions: Solution[];
    /** Related issues */
    relatedIssues?: string[];
    /** Tags for searching */
    tags: string[];
}

/**
 * Media Scanning Troubleshooting Knowledge Base
 */
export const MEDIA_SCANNING_KB: MediaScanningIssuePattern[] = [
    {
        id: 'library-not-updating',
        title: 'Library not updating or scanning new files',
        description: 'Media server fails to detect new files added to library folders. Scans complete but new content doesn\'t appear.',
        severity: 'high',
        symptoms: [
            'New files added but don\'t appear in library',
            'Manual scan shows "0 items added"',
            'Library last scanned time doesn\'t update',
            'Scanner appears to run but finds nothing',
            'Files visible in file browser but not in library'
        ],
        logPatterns: [
            'Scan complete.*0.*items',
            'Library.*not.*found',
            'Path.*not.*accessible',
            'No.*media.*files.*found',
            'Scan.*failed.*permission',
            'Unable.*to.*access.*library'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv', 'music'],
        diagnostics: [
            {
                order: 1,
                description: 'Verify file permissions inside container',
                command: 'docker exec plex ls -la /data/media',
                expectedResult: 'Files should be readable by the user running Plex/Jellyfin (usually UID 1000 or PUID)',
                interpretation: 'If permission denied or files owned by different user, scanner cannot read files.'
            },
            {
                order: 2,
                description: 'Check if library path is correctly mounted',
                command: 'docker exec plex df -h /data/media',
                expectedResult: 'Should show the mounted volume with available space',
                interpretation: 'If path doesn\'t exist or shows 0 bytes, volume is not mounted correctly.'
            },
            {
                order: 3,
                description: 'Verify files are in supported formats',
                command: 'docker exec plex ls -R /data/media | grep -E "\\.(mkv|mp4|avi|mov)$"',
                expectedResult: 'Should list video files with supported extensions',
                interpretation: 'Unsupported formats will be ignored by scanner.'
            },
            {
                order: 4,
                description: 'Check scanner logs for specific errors',
                expectedResult: 'Look for permission errors, path not found, or file format warnings',
                interpretation: 'Scanner logs often contain specific reasons why files are skipped.'
            },
            {
                order: 5,
                description: 'Verify library path configuration',
                expectedResult: 'Library path in UI should match the container\'s internal path',
                interpretation: 'Path mismatch between host and container is a common issue.'
            }
        ],
        solutions: [
            {
                title: 'Fix file permissions',
                description: 'Ensure media files are readable by the media server process',
                steps: [
                    'Find your PUID/PGID: docker exec plex id',
                    'On host, fix ownership: sudo chown -R 1000:1000 /path/to/media',
                    'Fix permissions: sudo chmod -R 755 /path/to/media',
                    'For files: sudo find /path/to/media -type f -exec chmod 644 {} \\;',
                    'Restart container: docker restart plex',
                    'Trigger library scan'
                ],
                configExample: `# In docker-compose.yml, ensure PUID/PGID match your media files:
services:
  plex:
    environment:
      - PUID=1000
      - PGID=1000
    volumes:
      - /path/to/media:/data/media`,
                envVars: {
                    'PUID': '1000',
                    'PGID': '1000'
                },
                requiresRestart: true,
                notes: 'This is the most common cause of scanning issues. Ensure the user running Plex/Jellyfin has read access to all media files.'
            },
            {
                title: 'Verify and fix volume mounts',
                description: 'Ensure library paths are correctly mounted and accessible',
                steps: [
                    'Check docker-compose.yml volume mappings',
                    'Verify host path exists and contains media',
                    'Ensure container path matches library configuration in UI',
                    'Test access: docker exec plex ls -la /data/media',
                    'If path doesn\'t exist, fix volume mapping and recreate container',
                    'Update library path in server settings to match container path'
                ],
                configExample: `# Correct volume mapping:
volumes:
  - /mnt/storage/movies:/data/movies
  - /mnt/storage/tv:/data/tv

# In Plex/Jellyfin, library paths should be:
# Movies: /data/movies
# TV Shows: /data/tv

# NOT the host paths like /mnt/storage/movies`,
                requiresRestart: true,
                notes: 'Always use the container-internal path when configuring libraries in Plex/Jellyfin UI, not the host path.'
            },
            {
                title: 'Enable and check scanner logs',
                description: 'Increase logging to identify why specific files are being skipped',
                steps: [
                    'For Plex: Settings → Server → General → Verbose logging',
                    'For Jellyfin: Dashboard → Logs → Set log level to Debug',
                    'Trigger manual library scan',
                    'Check logs for specific file errors',
                    'Look for "skipped", "ignored", or "failed" messages',
                    'Address specific issues found in logs'
                ],
                requiresRestart: false,
                notes: 'Remember to disable verbose logging after troubleshooting to reduce log volume.'
            },
            {
                title: 'Rebuild library database',
                description: 'If library database is corrupted, rebuild it from scratch',
                steps: [
                    'Backup existing library database',
                    'For Plex: Stop container, delete Library/Application Support/Plex Media Server/Plug-in Support/Databases/com.plexapp.plugins.library.db',
                    'For Jellyfin: Dashboard → Libraries → Remove library → Re-add library',
                    'Restart container',
                    'Re-add library and trigger full scan',
                    'Wait for complete scan (may take hours for large libraries)'
                ],
                requiresRestart: true,
                notes: 'This is a last resort. Database corruption is rare but can cause persistent scanning issues.'
            }
        ],
        relatedIssues: ['file-naming-incorrect', 'permission-denied', 'metadata-not-loading'],
        tags: ['scanning', 'library', 'permissions', 'mount', 'detection']
    },
    {
        id: 'file-naming-incorrect',
        title: 'Files not matching due to incorrect naming',
        description: 'Media server finds files but cannot match them to the correct metadata due to improper file naming conventions.',
        severity: 'medium',
        symptoms: [
            'Files appear as "Unknown" or with wrong metadata',
            'TV episodes matched to wrong season/episode',
            'Movies matched to wrong title',
            'Multiple versions of same item appear',
            'Metadata refresh doesn\'t fix matching'
        ],
        logPatterns: [
            'Could.*not.*match',
            'Unable.*to.*identify',
            'No.*match.*found',
            'Multiple.*matches',
            'Ambiguous.*match',
            'Failed.*to.*parse.*filename'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv'],
        diagnostics: [
            {
                order: 1,
                description: 'Check current file naming structure',
                command: 'docker exec plex find /data/media -type f -name "*.mkv" | head -20',
                expectedResult: 'Review actual filenames against recommended naming conventions',
                interpretation: 'Files should follow Plex/Jellyfin naming standards for proper matching.'
            },
            {
                order: 2,
                description: 'Verify folder structure',
                expectedResult: 'Movies: /Movies/Movie Name (Year)/Movie Name (Year).ext\nTV: /TV Shows/Show Name/Season 01/Show Name - S01E01 - Episode.ext',
                interpretation: 'Proper folder structure is essential for media matching.'
            },
            {
                order: 3,
                description: 'Check for special characters or encoding issues',
                command: 'docker exec plex find /data/media -type f | grep -E "[^[:ascii:]]"',
                expectedResult: 'Identify files with non-ASCII characters',
                interpretation: 'Special characters can confuse the matcher.'
            }
        ],
        solutions: [
            {
                title: 'Rename files to Plex/Jellyfin standards',
                description: 'Use proper naming conventions for accurate metadata matching',
                steps: [
                    'For Movies: "Movie Name (Year).ext" in folder "Movie Name (Year)"',
                    'Example: /Movies/Avatar (2009)/Avatar (2009).mkv',
                    'For TV Shows: "Show Name - S01E01 - Episode Name.ext"',
                    'Example: /TV/Breaking Bad/Season 01/Breaking Bad - S01E01 - Pilot.mkv',
                    'Include year for movies to avoid confusion with remakes',
                    'Use SxxExx format for TV episodes (S01E01, not 1x01)',
                    'Avoid special characters: use letters, numbers, spaces, hyphens, parentheses only'
                ],
                configExample: `# Recommended structure:

/data/movies/
  ├── Avatar (2009)/
  │   └── Avatar (2009).mkv
  ├── The Matrix (1999)/
  │   └── The Matrix (1999).mkv

/data/tv/
  ├── Breaking Bad/
  │   ├── Season 01/
  │   │   ├── Breaking Bad - S01E01 - Pilot.mkv
  │   │   └── Breaking Bad - S01E02 - Cat's in the Bag.mkv
  │   └── Season 02/
  │       └── Breaking Bad - S02E01 - Seven Thirty-Seven.mkv`,
                requiresRestart: false,
                notes: 'Use tools like FileBot or Sonarr/Radarr to automate proper renaming.'
            },
            {
                title: 'Use FileBot or automated renaming',
                description: 'Leverage tools to automatically rename files according to standards',
                steps: [
                    'Install FileBot or use Sonarr/Radarr for automated renaming',
                    'For FileBot: filebot -rename /path/to/media --db TheMovieDB --format "{n} ({y})"',
                    'For Sonarr/Radarr: Configure naming scheme in Settings → Media Management',
                    'Enable "Rename Episodes/Movies" in download client settings',
                    'Trigger manual rename for existing files',
                    'Verify renamed files follow conventions',
                    'Trigger library scan to re-match'
                ],
                configExample: `# Sonarr/Radarr naming format:
# Movies (Radarr):
{Movie Title} ({Release Year})

# TV Episodes (Sonarr):
{Series Title} - S{season:00}E{episode:00} - {Episode Title}`,
                requiresRestart: false,
                notes: 'Sonarr and Radarr are the best tools for maintaining proper naming as they rename files automatically on import.'
            },
            {
                title: 'Fix match manually with correct metadata',
                description: 'Manually identify and fix incorrect matches',
                steps: [
                    'In Plex/Jellyfin, click on the incorrectly matched item',
                    'Click "..." menu → "Fix Match" or "Identify"',
                    'Search for correct title',
                    'Verify year, season, episode number',
                    'Select correct match',
                    'Click "OK" to apply',
                    'Refresh metadata if needed'
                ],
                requiresRestart: false,
                notes: 'This is a temporary fix. Proper file naming prevents future issues.'
            }
        ],
        relatedIssues: ['metadata-not-loading', 'library-not-updating'],
        tags: ['naming', 'matching', 'metadata', 'filebot', 'conventions']
    },
    {
        id: 'permission-denied',
        title: 'Permission denied errors during scanning',
        description: 'Media server cannot read files or directories due to insufficient permissions.',
        severity: 'high',
        symptoms: [
            'Scanner logs show "Permission denied"',
            'Some folders scan successfully, others fail',
            'Files added by different users don\'t appear',
            'Library partially scans then stops',
            'Error accessing specific directories'
        ],
        logPatterns: [
            'Permission.*denied',
            'Access.*denied',
            'EACCES',
            'Cannot.*read.*directory',
            'Insufficient.*permissions',
            'Operation.*not.*permitted'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv', 'music', 'photos'],
        diagnostics: [
            {
                order: 1,
                description: 'Check file/directory ownership',
                command: 'docker exec plex ls -la /data/media',
                expectedResult: 'Files should be owned by user matching PUID in container',
                interpretation: 'If files owned by different UID, container cannot read them.'
            },
            {
                order: 2,
                description: 'Verify PUID/PGID settings',
                command: 'docker exec plex id',
                expectedResult: 'Should show uid and gid matching your media files',
                interpretation: 'Mismatch between container user and file ownership causes permission issues.'
            },
            {
                order: 3,
                description: 'Test read access to specific files',
                command: 'docker exec plex cat /data/media/Movies/test.mkv > /dev/null',
                expectedResult: 'Should succeed without errors',
                interpretation: 'If fails with permission error, confirms access issue.'
            },
            {
                order: 4,
                description: 'Check directory execute permissions',
                command: 'docker exec plex ls -ld /data/media/*',
                expectedResult: 'Directories should have execute (x) permission',
                interpretation: 'Without execute permission, cannot traverse into directories.'
            }
        ],
        solutions: [
            {
                title: 'Fix ownership to match container PUID/PGID',
                description: 'Change file ownership to match the user running the media server',
                steps: [
                    'Check container PUID: docker exec plex id',
                    'Note the uid and gid (usually 1000:1000)',
                    'On host, fix ownership: sudo chown -R 1000:1000 /path/to/media',
                    'Verify: ls -la /path/to/media',
                    'Restart container: docker restart plex',
                    'Trigger library scan'
                ],
                configExample: `# Commands to fix permissions:
sudo chown -R 1000:1000 /mnt/storage/media
sudo find /mnt/storage/media -type d -exec chmod 755 {} \\;
sudo find /mnt/storage/media -type f -exec chmod 644 {} \\;

# Verify ownership:
ls -la /mnt/storage/media`,
                requiresRestart: true,
                notes: 'Run these commands on the Docker host, not inside the container.'
            },
            {
                title: 'Set correct PUID/PGID in docker-compose',
                description: 'Configure container to run as user that owns media files',
                steps: [
                    'Find your user ID: id -u (usually 1000)',
                    'Find your group ID: id -g (usually 1000)',
                    'Edit docker-compose.yml',
                    'Set PUID and PGID environment variables',
                    'Recreate container: docker compose up -d --force-recreate plex',
                    'Verify: docker exec plex id',
                    'Trigger library scan'
                ],
                configExample: `services:
  plex:
    image: lscr.io/linuxserver/plex:latest
    environment:
      - PUID=1000  # Your user ID
      - PGID=1000  # Your group ID
      - TZ=America/New_York
    volumes:
      - ./config:/config
      - /mnt/storage/media:/data/media`,
                envVars: {
                    'PUID': '1000',
                    'PGID': '1000'
                },
                requiresRestart: true,
                notes: 'This is the recommended approach for LinuxServer.io containers.'
            },
            {
                title: 'Use umask to set default permissions for new files',
                description: 'Configure system to create new files with appropriate permissions',
                steps: [
                    'Set UMASK in docker-compose.yml: UMASK=022',
                    'This creates files with 644 (rw-r--r--) and dirs with 755 (rwxr-xr-x)',
                    'Recreate container with new UMASK',
                    'New files will be created with correct permissions automatically'
                ],
                configExample: `services:
  plex:
    environment:
      - PUID=1000
      - PGID=1000
      - UMASK=022  # Files: 644, Dirs: 755`,
                envVars: {
                    'UMASK': '022'
                },
                requiresRestart: true,
                notes: 'UMASK only affects new files. Existing files need manual permission fix.'
            }
        ],
        relatedIssues: ['library-not-updating', 'transcoding-permission-failed'],
        tags: ['permissions', 'access', 'puid', 'pgid', 'ownership', 'umask']
    },
    {
        id: 'transcoding-failed',
        title: 'Transcoding fails or produces errors',
        description: 'Media server cannot transcode video files for playback, causing playback failures or quality issues.',
        severity: 'high',
        symptoms: [
            'Video playback fails with transcoding error',
            'Playback starts then stops',
            'Only some videos fail to play',
            'Error: "Conversion failed"',
            'Transcoder crashes or becomes unresponsive',
            'High CPU usage but no playback'
        ],
        logPatterns: [
            'Transcode.*failed',
            'Conversion.*failed',
            'codec.*not.*supported',
            'Hardware.*acceleration.*failed',
            'Transcoder.*crashed',
            'VAAPI.*error',
            'NVENC.*error',
            'QSV.*error',
            'FFmpeg.*error'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv'],
        diagnostics: [
            {
                order: 1,
                description: 'Check transcoding logs',
                expectedResult: 'Look for FFmpeg errors, codec issues, or hardware acceleration failures',
                interpretation: 'Logs reveal specific transcoding failures.'
            },
            {
                order: 2,
                description: 'Verify /tmp or /transcode directory permissions',
                command: 'docker exec plex ls -la /transcode',
                expectedResult: 'Directory should be writable by media server process',
                interpretation: 'Transcoder needs write access to temporary directory.'
            },
            {
                order: 3,
                description: 'Check available disk space for transcoding',
                command: 'docker exec plex df -h /transcode',
                expectedResult: 'Should have several GB free for temporary transcoded files',
                interpretation: 'Insufficient space causes transcoding to fail mid-stream.'
            },
            {
                order: 4,
                description: 'Test if hardware acceleration is properly configured',
                command: 'docker exec plex ls -la /dev/dri',
                expectedResult: 'GPU devices should be accessible if hardware transcoding enabled',
                interpretation: 'Missing /dev/dri means hardware acceleration unavailable.'
            },
            {
                order: 5,
                description: 'Verify codec support',
                command: 'docker exec plex ffmpeg -codecs | grep -E "(h264|hevc|av1)"',
                expectedResult: 'Should show support for common video codecs',
                interpretation: 'Missing codec support means transcoding will fail for certain files.'
            }
        ],
        solutions: [
            {
                title: 'Fix /transcode directory permissions and space',
                description: 'Ensure transcoding directory is writable and has sufficient space',
                steps: [
                    'Create dedicated transcode directory on host: mkdir -p /mnt/transcode',
                    'Set permissions: sudo chmod 777 /mnt/transcode',
                    'Mount in docker-compose.yml: /mnt/transcode:/transcode',
                    'In Plex/Jellyfin settings, set transcode path to /transcode',
                    'Ensure mount point has at least 10GB free space',
                    'Restart container',
                    'Test transcoding with a known working file'
                ],
                configExample: `services:
  plex:
    volumes:
      - /mnt/transcode:/transcode
    environment:
      - PUID=1000
      - PGID=1000

# Set transcoding directory in Plex:
# Settings → Transcoder → Transcoder temporary directory: /transcode`,
                requiresRestart: true,
                notes: 'Transcoding can require significant temporary storage, especially for 4K content.'
            },
            {
                title: 'Enable or disable hardware acceleration',
                description: 'Configure GPU passthrough for hardware transcoding or fall back to software',
                steps: [
                    'For Intel QuickSync: Add /dev/dri to docker-compose devices',
                    'For NVIDIA: Install nvidia-docker and add runtime',
                    'In Plex/Jellyfin settings: Enable hardware acceleration',
                    'Select appropriate hardware type (QSV, NVENC, VAAPI)',
                    'If hardware transcoding fails, disable it to use CPU',
                    'Restart container',
                    'Test playback'
                ],
                configExample: `# Intel QuickSync (QSV):
services:
  plex:
    devices:
      - /dev/dri:/dev/dri
    group_add:
      - "109"  # render group, find with: getent group render

# NVIDIA:
services:
  plex:
    runtime: nvidia
    environment:
      - NVIDIA_VISIBLE_DEVICES=all
      - NVIDIA_DRIVER_CAPABILITIES=all

# In Plex: Settings → Transcoder
# ✓ Use hardware acceleration when available
# Hardware transcoding device: Intel QuickSync (QSV) or NVIDIA NVENC`,
                requiresRestart: true,
                notes: 'Hardware transcoding significantly reduces CPU usage but requires proper GPU passthrough.'
            },
            {
                title: 'Disable problematic transcoding features',
                description: 'If specific transcoding features cause issues, disable them',
                steps: [
                    'In Plex: Settings → Transcoder',
                    'Disable "Use hardware-accelerated video encoding" if causing crashes',
                    'Reduce "Background transcoding x264 preset" to "fast" or "veryfast"',
                    'Disable "HDR tone mapping" if not needed',
                    'Lower "Transcoder quality" if quality issues persist',
                    'Consider using Direct Play/Direct Stream instead',
                    'In player settings: Enable "Direct Play" and "Direct Stream"'
                ],
                requiresRestart: false,
                notes: 'Direct Play avoids transcoding entirely but requires compatible client formats.'
            },
            {
                title: 'Update FFmpeg or container image',
                description: 'Newer FFmpeg versions have better codec support and bug fixes',
                steps: [
                    'Pull latest container image: docker compose pull plex',
                    'Recreate container: docker compose up -d plex',
                    'Verify FFmpeg version: docker exec plex ffmpeg -version',
                    'Check if issue persists with updated version',
                    'If using custom FFmpeg build, ensure it includes required codecs'
                ],
                requiresRestart: true,
                notes: 'LinuxServer.io images include recent FFmpeg builds with broad codec support.'
            }
        ],
        relatedIssues: ['transcoding-permission-failed', 'codec-not-supported'],
        tags: ['transcoding', 'ffmpeg', 'hardware-acceleration', 'gpu', 'playback', 'codec']
    },
    {
        id: 'transcoding-permission-failed',
        title: 'Transcoding fails due to permission errors',
        description: 'Transcoder cannot write temporary files due to permission issues on transcode directory.',
        severity: 'medium',
        symptoms: [
            'Transcoding fails with "Permission denied"',
            'Cannot create temporary transcode files',
            'Logs show EACCES errors during transcoding',
            'Direct Play works but transcoding fails'
        ],
        logPatterns: [
            'Transcode.*permission.*denied',
            'EACCES.*transcode',
            'Cannot.*write.*transcode',
            'Failed.*to.*create.*transcode',
            'Permission.*denied.*/tmp'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv'],
        diagnostics: [
            {
                order: 1,
                description: 'Check transcode directory permissions',
                command: 'docker exec plex ls -la /transcode',
                expectedResult: 'Directory should be writable (755 or 777)',
                interpretation: 'If not writable, transcoder cannot create temporary files.'
            },
            {
                order: 2,
                description: 'Test write access',
                command: 'docker exec plex touch /transcode/test.txt',
                expectedResult: 'Should succeed without errors',
                interpretation: 'If fails, confirms permission issue.'
            },
            {
                order: 3,
                description: 'Check disk space on transcode volume',
                command: 'docker exec plex df -h /transcode',
                expectedResult: 'Should have free space available',
                interpretation: 'Full disk can appear as permission error.'
            }
        ],
        solutions: [
            {
                title: 'Fix transcode directory permissions',
                description: 'Ensure transcode directory is writable',
                steps: [
                    'On host, fix permissions: sudo chmod 777 /mnt/transcode',
                    'Or match PUID: sudo chown -R 1000:1000 /mnt/transcode && chmod 755 /mnt/transcode',
                    'Inside container, verify: docker exec plex touch /transcode/test.txt',
                    'Remove test file: docker exec plex rm /transcode/test.txt',
                    'Restart container if needed',
                    'Test transcoding'
                ],
                configExample: `# On host:
sudo mkdir -p /mnt/transcode
sudo chmod 777 /mnt/transcode

# Or for better security, match container PUID:
sudo chown -R 1000:1000 /mnt/transcode
sudo chmod 755 /mnt/transcode`,
                requiresRestart: false,
                notes: 'chmod 777 is less secure but ensures all users can write. Use PUID matching for better security.'
            },
            {
                title: 'Use tmpfs for transcode directory',
                description: 'Mount transcode directory as tmpfs (RAM disk) for better performance and no permission issues',
                steps: [
                    'Edit docker-compose.yml',
                    'Add tmpfs mount for /transcode',
                    'Allocate sufficient size (at least 4GB)',
                    'Recreate container: docker compose up -d plex',
                    'Verify mount: docker exec plex df -h /transcode',
                    'Test transcoding'
                ],
                configExample: `services:
  plex:
    tmpfs:
      - /transcode:size=4G,mode=0777
    # Or if you prefer separate volume:
    volumes:
      - type: tmpfs
        target: /transcode
        tmpfs:
          size: 4294967296  # 4GB in bytes`,
                requiresRestart: true,
                notes: 'tmpfs uses RAM, so ensure your system has enough memory. Improves transcoding performance but lost on reboot.'
            }
        ],
        relatedIssues: ['transcoding-failed', 'permission-denied'],
        tags: ['transcoding', 'permissions', 'tmpfs', 'access']
    },
    {
        id: 'metadata-not-loading',
        title: 'Metadata or artwork not loading',
        description: 'Media is detected but metadata, posters, or fanart fail to download or display.',
        severity: 'medium',
        symptoms: [
            'Media shows with generic poster',
            'No plot summary or metadata',
            'Missing cast and crew information',
            'Artwork failed to download',
            'Metadata agent errors in logs',
            'Some items have metadata, others don\'t'
        ],
        logPatterns: [
            'Metadata.*failed',
            'Unable.*to.*download.*artwork',
            'Agent.*error',
            'HTTP.*timeout.*metadata',
            'Failed.*to.*fetch.*metadata',
            'TMDB.*error',
            'TVDB.*error'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv'],
        diagnostics: [
            {
                order: 1,
                description: 'Check internet connectivity from container',
                command: 'docker exec plex ping -c 4 api.themoviedb.org',
                expectedResult: 'Should receive responses',
                interpretation: 'If fails, container cannot reach metadata providers.'
            },
            {
                order: 2,
                description: 'Test DNS resolution',
                command: 'docker exec plex nslookup api.themoviedb.org',
                expectedResult: 'Should resolve to IP address',
                interpretation: 'DNS issues prevent metadata downloads.'
            },
            {
                order: 3,
                description: 'Check if behind VPN blocking metadata',
                expectedResult: 'If Plex/Jellyfin uses network_mode: service:gluetun, may be blocked',
                interpretation: 'VPN kill switch can block metadata providers.'
            },
            {
                order: 4,
                description: 'Verify metadata agent configuration',
                expectedResult: 'In settings, check that agents are enabled and in correct order',
                interpretation: 'Disabled or misconfigured agents won\'t fetch metadata.'
            }
        ],
        solutions: [
            {
                title: 'Ensure Plex/Jellyfin has internet access',
                description: 'Verify container can reach metadata providers',
                steps: [
                    'Test connectivity: docker exec plex ping -c 4 8.8.8.8',
                    'If no internet, check network mode in docker-compose',
                    'If using VPN (network_mode: service:gluetun), metadata may be blocked',
                    'Solution: Use bridge network for Plex/Jellyfin, only route download clients through VPN',
                    'Or configure VPN to allow metadata provider IPs',
                    'Restart container and test metadata refresh'
                ],
                configExample: `# Don't route Plex/Jellyfin through VPN:
services:
  plex:
    network_mode: bridge  # Not service:gluetun
    ports:
      - "32400:32400"

  # Only download clients should use VPN:
  qbittorrent:
    network_mode: service:gluetun
    depends_on:
      - gluetun`,
                requiresRestart: true,
                notes: 'Media servers need internet access for metadata. Only torrent/usenet clients should use VPN.'
            },
            {
                title: 'Refresh metadata for affected items',
                description: 'Manually trigger metadata refresh',
                steps: [
                    'For Plex: Click item → ... menu → Refresh',
                    'Or for library: Manage Library → Refresh All Metadata',
                    'For Jellyfin: Dashboard → Libraries → Scan Library',
                    'Enable "Replace all metadata" to force re-download',
                    'Wait for scan to complete',
                    'Check if metadata now appears'
                ],
                requiresRestart: false,
                notes: 'Full library refresh can take a long time for large libraries.'
            },
            {
                title: 'Fix metadata agent configuration',
                description: 'Ensure correct agents are enabled and configured',
                steps: [
                    'For Plex: Settings → Agents → Shows/Movies',
                    'Ensure "The Movie Database" or "TheTVDB" is enabled and first',
                    'Disable any problematic agents',
                    'For Jellyfin: Dashboard → Plugins → Catalog',
                    'Install "TMDb" and "TheTVDB" plugins if missing',
                    'Dashboard → Libraries → Edit library → Metadata downloaders',
                    'Check TMDb/TVDB are selected',
                    'Save and refresh metadata'
                ],
                configExample: `# Plex recommended agent order:
Movies:
1. Plex Movie (new agent) or The Movie Database
2. Local Media Assets

TV Shows:
1. The TVDB
2. Local Media Assets

# Jellyfin:
Ensure TMDb and TheTVDB plugins are installed`,
                requiresRestart: false,
                notes: 'Plex\'s new movie agent is recommended for movies. TVDB is best for TV shows.'
            },
            {
                title: 'Clear metadata cache and rebuild',
                description: 'If metadata is corrupted, clear cache and re-download',
                steps: [
                    'Stop Plex/Jellyfin container',
                    'For Plex: Delete Library/Application Support/Plex Media Server/Metadata',
                    'For Jellyfin: Dashboard → Scheduled Tasks → Clean up metadata',
                    'Restart container',
                    'Trigger full metadata refresh',
                    'Wait for complete re-download (may take hours)'
                ],
                requiresRestart: true,
                notes: 'This forces complete metadata re-download. Only use if other solutions fail.'
            }
        ],
        relatedIssues: ['file-naming-incorrect', 'library-not-updating'],
        tags: ['metadata', 'artwork', 'posters', 'tmdb', 'tvdb', 'agents']
    },
    {
        id: 'codec-not-supported',
        title: 'Codec not supported or playback compatibility issues',
        description: 'Media files use codecs not supported by client or server, causing playback failures.',
        severity: 'medium',
        symptoms: [
            'Video plays but no audio',
            'Audio plays but no video',
            'Completely fails to play',
            'Error: "This server is not powerful enough"',
            'Codec not supported message',
            'Only works on some devices'
        ],
        logPatterns: [
            'Codec.*not.*supported',
            'Unsupported.*format',
            'Failed.*to.*decode',
            'No.*decoder.*available',
            'Stream.*not.*compatible'
        ],
        affectedServers: ['plex', 'jellyfin'],
        affectedMediaTypes: ['movies', 'tv', 'music'],
        diagnostics: [
            {
                order: 1,
                description: 'Identify file codec',
                command: 'docker exec plex ffprobe -v error -show_entries stream=codec_name,codec_type /data/media/file.mkv',
                expectedResult: 'Shows video and audio codecs used',
                interpretation: 'Uncommon codecs (e.g., AV1, FLAC, DTS) may not be supported by all clients.'
            },
            {
                order: 2,
                description: 'Check client capabilities',
                expectedResult: 'Web browsers support limited codecs; native apps support more',
                interpretation: 'If works on one device but not another, client codec support differs.'
            },
            {
                order: 3,
                description: 'Verify FFmpeg codec support',
                command: 'docker exec plex ffmpeg -codecs | grep -E "(hevc|av1|dts|truehd)"',
                expectedResult: 'Should show support for modern codecs',
                interpretation: 'If codec missing, server cannot transcode it.'
            }
        ],
        solutions: [
            {
                title: 'Enable transcoding for incompatible codecs',
                description: 'Let server transcode unsupported codecs to compatible format',
                steps: [
                    'In client player settings: Disable "Direct Play"',
                    'Enable "Direct Stream" and "Allow fallback to transcoding"',
                    'Server will automatically transcode incompatible streams',
                    'May increase server CPU/GPU usage',
                    'Test playback on problematic client'
                ],
                requiresRestart: false,
                notes: 'Transcoding allows playback but increases server load and may reduce quality.'
            },
            {
                title: 'Convert files to compatible codecs',
                description: 'Re-encode media to widely supported codecs (H.264/AAC)',
                steps: [
                    'For maximum compatibility, use H.264 video + AAC audio',
                    'Use HandBrake or FFmpeg to convert',
                    'FFmpeg command: ffmpeg -i input.mkv -c:v libx264 -c:a aac output.mkv',
                    'Or use "Fast 1080p30" preset in HandBrake',
                    'Replace original or keep both versions',
                    'Refresh library to detect new files'
                ],
                configExample: `# Convert to H.264 + AAC:
ffmpeg -i input.mkv -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k output.mkv

# Batch convert all MKV files:
for f in *.mkv; do
  ffmpeg -i "$f" -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "converted_$f"
done`,
                requiresRestart: false,
                notes: 'Re-encoding takes time and may slightly reduce quality. CRF 23 is good balance of size/quality.'
            },
            {
                title: 'Use Plex optimized versions',
                description: 'Create optimized versions for specific devices',
                steps: [
                    'In Plex, click item → ... menu → Optimize',
                    'Select device profile (mobile, TV, web, etc.)',
                    'Plex creates transcoded version in background',
                    'Optimized version automatically used on compatible devices',
                    'Original file remains unchanged'
                ],
                requiresRestart: false,
                notes: 'Optimized versions consume additional storage but enable smooth playback.'
            },
            {
                title: 'Install codec packs on client devices',
                description: 'Some clients support additional codecs with codec packs',
                steps: [
                    'For Windows clients: Install K-Lite Codec Pack',
                    'For Android: Use VLC or MX Player which support more codecs',
                    'For iOS: Use Infuse player for better codec support',
                    'For web: Use Plex/Jellyfin native apps instead of browser',
                    'Native apps generally support more codecs than web players'
                ],
                requiresRestart: false,
                notes: 'Better client codec support reduces server transcoding load.'
            }
        ],
        relatedIssues: ['transcoding-failed'],
        tags: ['codec', 'compatibility', 'playback', 'h264', 'hevc', 'av1', 'audio']
    },
    {
        id: 'plex-claim-failed',
        title: 'Plex server not claimed or authentication issues',
        description: 'Plex server fails to claim with account, preventing remote access and sharing.',
        severity: 'high',
        symptoms: [
            'Cannot claim server with Plex account',
            'Server not appearing in server list',
            'PLEX_CLAIM token not working',
            'Server shows as "Unclaimed"',
            'Cannot access server remotely'
        ],
        logPatterns: [
            'Claim.*failed',
            'Invalid.*claim.*token',
            'Authentication.*failed',
            'Unable.*to.*claim',
            'Claim.*token.*expired'
        ],
        affectedServers: ['plex'],
        diagnostics: [
            {
                order: 1,
                description: 'Check if PLEX_CLAIM token is valid',
                expectedResult: 'Token should start with "claim-" and be less than 4 minutes old',
                interpretation: 'Claim tokens expire quickly (4 minutes). Must recreate for each attempt.'
            },
            {
                order: 2,
                description: 'Verify server can reach Plex authentication servers',
                command: 'docker exec plex ping -c 4 plex.tv',
                expectedResult: 'Should receive responses',
                interpretation: 'No internet access prevents claiming.'
            },
            {
                order: 3,
                description: 'Check if server is using VPN',
                expectedResult: 'Plex server should NOT be routed through VPN',
                interpretation: 'VPN can block Plex authentication.'
            }
        ],
        solutions: [
            {
                title: 'Get fresh claim token and reclaim',
                description: 'Claim tokens expire in 4 minutes, get new one',
                steps: [
                    'Visit https://www.plex.tv/claim/',
                    'Copy the claim token (starts with "claim-")',
                    'Immediately add to docker-compose.yml PLEX_CLAIM',
                    'Run: docker compose up -d plex',
                    'Within 4 minutes, server should claim automatically',
                    'Check Plex web UI to verify server is claimed',
                    'After successful claim, can remove PLEX_CLAIM from compose file'
                ],
                configExample: `services:
  plex:
    environment:
      - PLEX_CLAIM=claim-xxxxxxxxxxxxxxxxxxxx  # Get from plex.tv/claim
      - PUID=1000
      - PGID=1000
    # After successful claim, remove PLEX_CLAIM line`,
                envVars: {
                    'PLEX_CLAIM': 'claim-xxxxxxxxxxxxxxxxxxxx'
                },
                requiresRestart: true,
                notes: 'Act quickly! Token expires in 4 minutes. Can remove PLEX_CLAIM after successful claim.'
            },
            {
                title: 'Ensure Plex has internet access',
                description: 'Plex must reach plex.tv for authentication',
                steps: [
                    'Verify Plex is NOT using network_mode: service:gluetun',
                    'Should use bridge or host network mode',
                    'Test connectivity: docker exec plex ping plex.tv',
                    'If behind firewall, ensure outbound HTTPS (443) allowed',
                    'Restart Plex after network changes',
                    'Retry claiming process'
                ],
                configExample: `services:
  plex:
    network_mode: bridge  # NOT service:gluetun
    ports:
      - "32400:32400"`,
                requiresRestart: true,
                notes: 'Only download clients should use VPN, not Plex itself.'
            },
            {
                title: 'Manually claim server in web UI',
                description: 'If automatic claiming fails, try manual process',
                steps: [
                    'Access Plex at http://localhost:32400/web',
                    'Sign in with your Plex account',
                    'Follow the setup wizard',
                    'Server should claim automatically after sign-in',
                    'If still fails, try from different browser or incognito mode',
                    'Check server appears in https://app.plex.tv/desktop/#!/'
                ],
                requiresRestart: false,
                notes: 'Manual claiming can work when token claiming fails.'
            }
        ],
        relatedIssues: ['metadata-not-loading'],
        tags: ['plex', 'claim', 'authentication', 'remote-access', 'token']
    },
    {
        id: 'jellyfin-reverse-proxy',
        title: 'Jellyfin behind reverse proxy connection issues',
        description: 'Jellyfin fails to work correctly when accessed through reverse proxy or Cloudflare Tunnel.',
        severity: 'medium',
        symptoms: [
            'Jellyfin loads but playback fails',
            'WebSocket connection errors',
            'Infinite loading on some pages',
            'API calls fail through proxy',
            'Works on local network but not through proxy'
        ],
        logPatterns: [
            'WebSocket.*failed',
            'Proxy.*connection.*failed',
            'Invalid.*request.*origin',
            'CORS.*error',
            'X-Forwarded.*missing'
        ],
        affectedServers: ['jellyfin'],
        diagnostics: [
            {
                order: 1,
                description: 'Check reverse proxy headers',
                expectedResult: 'Proxy must pass X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host',
                interpretation: 'Missing headers cause Jellyfin to generate incorrect URLs.'
            },
            {
                order: 2,
                description: 'Verify base URL configuration',
                expectedResult: 'In Jellyfin Network settings, check base URL matches proxy path',
                interpretation: 'Mismatch between base URL and proxy path breaks routing.'
            },
            {
                order: 3,
                description: 'Test WebSocket support',
                expectedResult: 'Proxy must support WebSocket upgrade for real-time features',
                interpretation: 'No WebSocket support breaks live updates.'
            }
        ],
        solutions: [
            {
                title: 'Configure Jellyfin network settings',
                description: 'Set correct base URL and trusted proxies',
                steps: [
                    'In Jellyfin: Dashboard → Networking',
                    'Set "Base URL" if using subpath (e.g., /jellyfin)',
                    'Leave empty if using subdomain',
                    'Add proxy IP to "Known Proxies" (e.g., 172.18.0.0/16 for Docker)',
                    'Enable "Allow remote connections to this server"',
                    'Save and restart Jellyfin'
                ],
                configExample: `# Jellyfin Network Settings:
Base URL: (leave empty for subdomain, or "/jellyfin" for subpath)
Known Proxies: 172.18.0.0/16
☑ Allow remote connections to this server
☑ Enable automatic port mapping`,
                requiresRestart: true,
                notes: 'Base URL must match your reverse proxy configuration exactly.'
            },
            {
                title: 'Configure reverse proxy headers',
                description: 'Ensure proxy passes required headers to Jellyfin',
                steps: [
                    'If using Nginx, add proxy_set_header directives',
                    'If using Caddy, headers set automatically',
                    'If using Traefik, add X-Forwarded headers',
                    'Ensure WebSocket upgrade headers included',
                    'Test after proxy configuration change'
                ],
                configExample: `# Nginx configuration:
location /jellyfin {
    proxy_pass http://jellyfin:8096;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $http_host;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}

# Caddy (automatic):
jellyfin.example.com {
    reverse_proxy jellyfin:8096
}`,
                requiresRestart: true,
                notes: 'WebSocket support is critical for Jellyfin\'s real-time features.'
            },
            {
                title: 'Configure Cloudflare Tunnel',
                description: 'Special configuration for Cloudflare Tunnel access',
                steps: [
                    'In Cloudflare dashboard, ensure WebSocket is enabled',
                    'Cloudflare → Speed → Optimization → WebSockets: On',
                    'In tunnel config, set http://jellyfin:8096 as backend',
                    'In Jellyfin Network settings, leave Base URL empty',
                    'Add Cloudflare IP ranges to Known Proxies',
                    'Test access through tunnel URL'
                ],
                configExample: `# Cloudflare Tunnel config.yml:
ingress:
  - hostname: jellyfin.example.com
    service: http://jellyfin:8096
    originRequest:
      noTLSVerify: true
  - service: http_status:404

# Jellyfin Known Proxies (Cloudflare IPs):
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22`,
                requiresRestart: true,
                notes: 'Cloudflare provides free tunnels and automatic HTTPS. Ensure WebSocket enabled.'
            }
        ],
        relatedIssues: ['metadata-not-loading'],
        tags: ['jellyfin', 'reverse-proxy', 'cloudflare', 'nginx', 'caddy', 'websocket']
    }
];

/**
 * Search knowledge base by keywords
 */
export function searchMediaScanningKB(query: string): MediaScanningIssuePattern[] {
    const lowerQuery = query.toLowerCase();
    const results: MediaScanningIssuePattern[] = [];

    for (const pattern of MEDIA_SCANNING_KB) {
        // Search in title, description, symptoms, and tags
        const searchText = [
            pattern.title,
            pattern.description,
            ...pattern.symptoms,
            ...pattern.tags
        ].join(' ').toLowerCase();

        if (searchText.includes(lowerQuery)) {
            results.push(pattern);
        }
    }

    logger.debug({ query, resultCount: results.length }, 'Media scanning KB search completed');

    return results;
}

/**
 * Find issue patterns by media server type
 */
export function getIssuesByServer(server: MediaServer): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(
        pattern => !pattern.affectedServers || pattern.affectedServers.includes(server)
    );
}

/**
 * Get Plex-specific issues
 */
export function getPlexIssues(): MediaScanningIssuePattern[] {
    return getIssuesByServer('plex');
}

/**
 * Get Jellyfin-specific issues
 */
export function getJellyfinIssues(): MediaScanningIssuePattern[] {
    return getIssuesByServer('jellyfin');
}

/**
 * Find issue patterns by media type
 */
export function getIssuesByMediaType(mediaType: MediaType): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(
        pattern => !pattern.affectedMediaTypes || pattern.affectedMediaTypes.includes(mediaType)
    );
}

/**
 * Find issue patterns by severity
 */
export function getIssuesBySeverity(severity: IssueSeverity): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(pattern => pattern.severity === severity);
}

/**
 * Get all critical issues
 */
export function getCriticalIssues(): MediaScanningIssuePattern[] {
    return getIssuesBySeverity('critical');
}

/**
 * Get all high severity issues
 */
export function getHighSeverityIssues(): MediaScanningIssuePattern[] {
    return getIssuesBySeverity('high');
}

/**
 * Match log output against known patterns
 */
export function matchLogPatterns(logOutput: string): MediaScanningIssuePattern[] {
    const matches: MediaScanningIssuePattern[] = [];

    for (const pattern of MEDIA_SCANNING_KB) {
        if (!pattern.logPatterns) continue;

        for (const logPattern of pattern.logPatterns) {
            try {
                const regex = new RegExp(logPattern, 'i');
                if (regex.test(logOutput)) {
                    matches.push(pattern);
                    break; // Only add pattern once even if multiple patterns match
                }
            } catch (error) {
                logger.warn({ logPattern, error: getErrorMessage(error) }, 'Invalid regex pattern');
            }
        }
    }

    logger.debug({ matchCount: matches.length }, 'Log pattern matching completed');

    return matches;
}

/**
 * Get issues related to a specific issue ID
 */
export function getRelatedIssues(issueId: string): MediaScanningIssuePattern[] {
    const issue = MEDIA_SCANNING_KB.find(p => p.id === issueId);
    if (!issue || !issue.relatedIssues) {
        return [];
    }

    return MEDIA_SCANNING_KB.filter(p => issue.relatedIssues!.includes(p.id));
}

/**
 * Get issue by ID
 */
export function getIssueById(issueId: string): MediaScanningIssuePattern | undefined {
    return MEDIA_SCANNING_KB.find(p => p.id === issueId);
}

/**
 * Get scanning-related issues
 */
export function getScanningIssues(): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(p =>
        p.tags.includes('scanning') || p.tags.includes('library') || p.tags.includes('detection')
    );
}

/**
 * Get permission-related issues
 */
export function getPermissionIssues(): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(p =>
        p.tags.includes('permissions') || p.tags.includes('access') || p.tags.includes('ownership')
    );
}

/**
 * Get transcoding-related issues
 */
export function getTranscodingIssues(): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(p =>
        p.tags.includes('transcoding') || p.tags.includes('ffmpeg') || p.tags.includes('codec')
    );
}

/**
 * Get metadata-related issues
 */
export function getMetadataIssues(): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(p =>
        p.tags.includes('metadata') || p.tags.includes('matching') || p.tags.includes('naming')
    );
}

/**
 * Get common issues (high severity and frequently encountered)
 */
export function getCommonIssues(): MediaScanningIssuePattern[] {
    return MEDIA_SCANNING_KB.filter(p =>
        p.severity === 'high' || p.id === 'file-naming-incorrect' || p.id === 'metadata-not-loading'
    );
}
