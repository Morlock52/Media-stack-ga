import { useState } from 'react'
import { motion } from 'framer-motion'
import { Share2, Twitter, Linkedin, Facebook, Link2, Check } from 'lucide-react'

export function SocialShare() {
  const [isOpen, setIsOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareText = 'Check out this Media Stack implementation plan! 🚀'

  const shareLinks = [
    {
      name: 'Twitter',
      icon: Twitter,
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
      color: 'hover:bg-blue-500/20 hover:border-blue-500/30'
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
      color: 'hover:bg-blue-600/20 hover:border-blue-600/30'
    },
    {
      name: 'Facebook',
      icon: Facebook,
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      color: 'hover:bg-blue-700/20 hover:border-blue-700/30'
    }
  ]

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg glass border border-white/10 hover:border-primary/30 transition-all"
      >
        <Share2 className="w-4 h-4" />
        <span className="text-sm">Share</span>
      </button>

      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          className="absolute top-full mt-2 right-0 glass border border-white/20 rounded-xl p-2 z-50 min-w-[200px]"
        >
          {shareLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all ${link.color}`}
            >
              <link.icon className="w-4 h-4" />
              <span className="text-sm">{link.name}</span>
            </a>
          ))}
          
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-all hover:bg-gray-500/20 hover:border-gray-500/30"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Link2 className="w-4 h-4" />}
            <span className="text-sm">{copied ? 'Copied!' : 'Copy Link'}</span>
          </button>
        </motion.div>
      )}
    </div>
  )
}
