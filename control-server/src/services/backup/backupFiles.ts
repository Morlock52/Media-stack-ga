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

/** Item names become file names, so keep only safe characters. */
export function sanitizeItemName(itemName: string): string {
    return itemName.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Name of one item's archive in the destination. It carries the backup id so
 * two backups of the same item never overwrite each other.
 */
export function itemArchiveName(backupId: string, itemName: string, encrypted: boolean): string {
    const base = `${backupId}-${sanitizeItemName(itemName)}.tar.gz`;
    return encrypted ? `${base}.enc` : base;
}

/**
 * Name older backups used: the item name only, shared by every backup of that
 * item in the destination. Still read so those backups can be restored.
 */
export function legacyItemArchiveName(itemName: string, encrypted: boolean): string {
    const base = `${sanitizeItemName(itemName)}.tar.gz`;
    return encrypted ? `${base}.enc` : base;
}
