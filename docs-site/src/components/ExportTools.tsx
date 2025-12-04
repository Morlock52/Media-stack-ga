import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Table, Share2, Check, AlertCircle } from 'lucide-react'

export function ExportTools() {
  const [exporting, setExporting] = useState<string | null>(null)
  const [exported, setExported] = useState<string | null>(null)

  const exportOptions = [
    {
      id: 'pdf',
      label: 'Export as PDF',
      description: 'Complete deployment guide with checklist',
      icon: FileText,
      format: 'PDF',
      action: () => handleExport('pdf'),
    },
    {
      id: 'excel',
      label: 'Export to Excel',
      description: 'Service configuration spreadsheet',
      icon: Table,
      format: 'XLSX',
      action: () => handleExport('excel'),
    },
    {
      id: 'markdown',
      label: 'Export Markdown',
      description: 'Raw plan.md with progress tracking',
      icon: FileText,
      format: 'MD',
      action: () => handleExport('markdown'),
    },
    {
      id: 'share',
      label: 'Share Link',
      description: 'Create shareable progress report',
      icon: Share2,
      format: 'URL',
      action: () => handleExport('share'),
    },
  ]

  const handleExport = (type: string) => {
    setExporting(type)
    setExported(null)

    // Simulate export process
    setTimeout(() => {
      setExporting(null)
      setExported(type)
      
      // Reset success message
      setTimeout(() => setExported(null), 3000)
    }, 2000)
  }

  const generateMockData = (format: string) => {
    const data = {
      title: 'Media Stack Implementation Plan',
      generated: new Date().toISOString(),
      progress: {
        completed: 12,
        total: 15,
        percentage: 80,
      },
      services: [
        { name: 'Authelia', status: 'Completed', config: 'SSO + 2FA' },
        { name: 'Plex', status: 'Completed', config: 'Media Server' },
        { name: 'Sonarr', status: 'In Progress', config: 'TV Automation' },
        { name: 'Radarr', status: 'In Progress', config: 'Movie Automation' },
      ],
    }

    switch (format) {
      case 'pdf':
        return `PDF Report: ${data.title}\nGenerated: ${data.generated}\nProgress: ${data.progress.percentage}%\n\nServices:\n${data.services.map(s => `- ${s.name}: ${s.status}`).join('\n')}`
      case 'excel':
        return `Excel Data: ${JSON.stringify(data, null, 2)}`
      case 'markdown':
        return `# ${data.title}\n\n**Progress:** ${data.progress.completed}/${data.progress.total} (${data.progress.percentage}%)\n\n## Services\n${data.services.map(s => `- **${s.name}**: ${s.status} (${s.config})`).join('\n')}`
      default:
        return 'https://example.com/shared/plan-report'
    }
  }

  return (
    <section className="py-16 bg-black/20" id="export">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Export & Share</h2>
          <p className="text-muted-foreground">Generate reports and share your deployment progress</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {exportOptions.map((option, index) => (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              onClick={option.action}
              disabled={exporting === option.id}
              className={`glass border rounded-2xl p-6 text-left transition-all ${
                exporting === option.id
                  ? 'border-yellow-500/50 bg-yellow-500/10 cursor-not-allowed'
                  : exported === option.id
                  ? 'border-emerald-500/50 bg-emerald-500/10'
                  : 'border-white/10 hover:border-primary/30 hover:scale-[1.02] cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                  <option.icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-1 rounded">
                  {option.format}
                </span>
              </div>
              
              <h3 className="font-semibold text-white mb-2">{option.label}</h3>
              <p className="text-sm text-muted-foreground mb-4">{option.description}</p>
              
              <div className="flex items-center justify-between">
                {exporting === option.id ? (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <motion.div
                      className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    <span className="text-xs">Generating...</span>
                  </div>
                ) : exported === option.id ? (
                  <div className="flex items-center gap-2 text-emerald-400">
                    <Check className="w-4 h-4" />
                    <span className="text-xs">Ready!</span>
                  </div>
                ) : (
                  <Download className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
            </motion.button>
          ))}
        </div>

        {/* Export Preview */}
        {exported && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass border border-white/10 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Export Preview</h3>
              <button
                onClick={() => {
                  const data = generateMockData(exported)
                  const blob = new Blob([data], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `media-stack-plan.${exported === 'excel' ? 'xlsx' : exported === 'pdf' ? 'pdf' : 'md'}`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Download</span>
              </button>
            </div>
            <pre className="bg-black/50 rounded-lg p-4 text-xs text-muted-foreground overflow-x-auto max-h-40">
              {generateMockData(exported)}
            </pre>
          </motion.div>
        )}

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-400" />
            <p className="text-sm text-blue-400">
              All exports include sensitive configuration data - share securely
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
