import { Sparkles, FileDown, FileUp } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'

interface ToolsDialogProps {
    isOpen: boolean
    onClose: () => void
    onTemplatesClick: () => void
    onExportClick: () => void
    onImportClick: () => void
}

/**
 * Dialog for wizard tools: import/export configuration and template browser.
 * Provides quick access to configuration management features.
 */
export function ToolsDialog({
    isOpen,
    onClose,
    onTemplatesClick,
    onExportClick,
    onImportClick
}: ToolsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-xl">
                <DialogHeader>
                    <DialogTitle>Wizard Tools</DialogTitle>
                    <DialogDescription>
                        Import/export your configuration or start from a curated template.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        className="justify-start"
                        onClick={() => {
                            onClose()
                            onTemplatesClick()
                        }}
                    >
                        <Sparkles className="w-4 h-4" />
                        Browse Templates
                    </Button>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="justify-start"
                            onClick={() => {
                                onClose()
                                onExportClick()
                            }}
                            title="Export current configuration"
                        >
                            <FileDown className="w-4 h-4" />
                            Export Config
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            className="justify-start"
                            onClick={() => {
                                onClose()
                                onImportClick()
                            }}
                            title="Import a saved configuration"
                        >
                            <FileUp className="w-4 h-4" />
                            Import Config
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
