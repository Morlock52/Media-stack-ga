interface StorageEntry {
    id: string
    label: string
    path: string
    type: 'local' | 'network'
}

interface StorageLayoutCardProps {
    storageEntries: StorageEntry[]
}

/**
 * Displays the storage layout summary showing storage paths for selected services.
 * Each entry shows the category label, path, and optional "Network share" badge.
 */
export function StorageLayoutCard({ storageEntries }: StorageLayoutCardProps) {
    return (
        <div className="p-4 rounded-xl bg-muted/40 border border-border">
            <h3 className="text-sm font-semibold text-foreground/80 mb-4">Storage Layout</h3>
            <div className="space-y-2 text-xs">
                {storageEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">{entry.label}</span>
                        <div className="text-right">
                            <p className="font-mono text-foreground break-all">{entry.path}</p>
                            {entry.type === 'network' && (
                                <span className="text-[10px] text-primary uppercase tracking-wide">Network share</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
