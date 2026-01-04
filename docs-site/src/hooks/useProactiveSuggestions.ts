import { useMemo, useCallback } from 'react'
import { useSetupStore } from '../store/setupStore'

export interface ProactiveSuggestion {
  id: string
  text: string
  description?: string
  icon: 'sparkles' | 'shield' | 'chart' | 'zap' | 'server' | 'info'
  action: () => void
  priority: 'high' | 'medium' | 'low'
  dismissible: boolean
}

const DISMISSED_KEY = 'mediastack-dismissed-suggestions'

function getDismissed(): Set<string> {
  try {
    const stored = localStorage.getItem(DISMISSED_KEY)
    return stored ? new Set(JSON.parse(stored)) : new Set()
  } catch {
    return new Set()
  }
}

function saveDismissed(dismissed: Set<string>) {
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...dismissed]))
}

export function useProactiveSuggestions(currentStep: number) {
  const {
    selectedServices,
    config,
    toggleService,
    updateConfig
  } = useSetupStore()

  const dismiss = useCallback((id: string) => {
    const dismissed = getDismissed()
    dismissed.add(id)
    saveDismissed(dismissed)
  }, [])

  const suggestions = useMemo(() => {
    const dismissed = getDismissed()
    const items: ProactiveSuggestion[] = []

    // Step 2: Stack Selection suggestions
    if (currentStep === 2) {
      // Suggest Tautulli for Plex users
      if (selectedServices.includes('plex') && !selectedServices.includes('tautulli')) {
        items.push({
          id: 'add-tautulli',
          text: 'Add Tautulli for Plex analytics?',
          description: 'Track who watches what and get detailed playback statistics',
          icon: 'chart',
          action: () => toggleService('tautulli'),
          priority: 'medium',
          dismissible: true
        })
      }

      // Suggest Overseerr for request management
      if ((selectedServices.includes('plex') || selectedServices.includes('jellyfin')) &&
          selectedServices.includes('arr') &&
          !selectedServices.includes('overseerr')) {
        items.push({
          id: 'add-overseerr',
          text: 'Add Overseerr for media requests?',
          description: 'Let users request movies and TV shows easily',
          icon: 'sparkles',
          action: () => toggleService('overseerr'),
          priority: 'high',
          dismissible: true
        })
      }

      // Suggest VPN for torrent users
      if (selectedServices.includes('torrent') && !selectedServices.includes('vpn')) {
        items.push({
          id: 'add-vpn',
          text: 'Add VPN protection for downloads?',
          description: 'Route torrent traffic through Gluetun VPN for privacy',
          icon: 'shield',
          action: () => toggleService('vpn'),
          priority: 'high',
          dismissible: true
        })
      }

      // Suggest Bazarr for subtitle lovers
      if (selectedServices.includes('arr') && !selectedServices.includes('bazarr')) {
        items.push({
          id: 'add-bazarr',
          text: 'Add Bazarr for automatic subtitles?',
          description: 'Automatically download subtitles for all your media',
          icon: 'info',
          action: () => toggleService('bazarr'),
          priority: 'low',
          dismissible: true
        })
      }
    }

    // Step 3: Service Config suggestions
    if (currentStep === 3) {
      // Check for Plex without claim token
      if (selectedServices.includes('plex') && !config.plexClaim) {
        items.push({
          id: 'plex-claim-reminder',
          text: 'Get your Plex claim token',
          description: 'Required to link Plex to your account (valid for 4 minutes)',
          icon: 'zap',
          action: () => window.open('https://plex.tv/claim', '_blank'),
          priority: 'high',
          dismissible: false
        })
      }
    }

    // Step 4: Advanced Settings suggestions
    if (currentStep === 4) {
      // Suggest Cloudflare for remote access
      if (!config.cloudflareToken && selectedServices.length > 3) {
        items.push({
          id: 'add-cloudflare',
          text: 'Enable secure remote access?',
          description: 'Cloudflare Tunnel provides free, secure access without port forwarding',
          icon: 'shield',
          action: () => window.open('https://one.dash.cloudflare.com/', '_blank'),
          priority: 'medium',
          dismissible: true
        })
      }

      // Suggest VPN config if VPN is enabled but no key
      if (selectedServices.includes('vpn') && !config.wireguardPrivateKey) {
        items.push({
          id: 'vpn-config-reminder',
          text: 'Configure VPN credentials',
          description: 'Add your WireGuard private key for VPN to work',
          icon: 'shield',
          action: () => {
            // Focus on the VPN config field
            const input = document.getElementById('wireguardPrivateKey')
            input?.focus()
          },
          priority: 'high',
          dismissible: false
        })
      }
    }

    // Step 5: Review suggestions
    if (currentStep === 5) {
      // Suggest remote deploy if many services
      if (selectedServices.length >= 5) {
        items.push({
          id: 'consider-remote-deploy',
          text: 'Deploy directly to your server?',
          description: 'Skip manual setup - deploy via SSH with one click',
          icon: 'server',
          action: () => {
            // This would trigger opening the remote deploy modal
            const deployBtn = document.querySelector('[data-deploy-trigger]') as HTMLButtonElement
            deployBtn?.click()
          },
          priority: 'medium',
          dismissible: true
        })
      }
    }

    // Filter out dismissed suggestions
    return items.filter(item => !dismissed.has(item.id))
  }, [currentStep, selectedServices, config, toggleService, updateConfig])

  return { suggestions, dismiss }
}
