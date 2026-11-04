/**
 * Which files in a backup destination belong to a backup, and the backup id each
 * one carries. Every backup writes `<id>-manifest.json` next to its archives
 * (`*.tar.gz`, or `*.enc` when encrypted); the backup list and scheduled retention
 * read the manifests, so adapters must list them too.
 */
const BACKUP_FILE_PATTERN = /(-manifest\.json|\.tar\.gz\.enc|\.tar\.gz|\.enc)$/;

export function isBackupFile(filename: string): boolean {
    return BACKUP_FILE_PATTERN.test(filename);
}

export function backupIdFromFilename(filename: string): string {
    return filename.replace(BACKUP_FILE_PATTERN, '');
}
