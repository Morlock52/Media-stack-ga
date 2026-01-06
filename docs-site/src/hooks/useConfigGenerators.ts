import { useMemo } from 'react'
import { useSetupStore } from '../store/setupStore'

/**
 * Hook that provides YAML/config generation functions for the wizard.
 * Generates Authelia and Cloudflare Tunnel configuration files based on
 * the current wizard configuration and selected services.
 *
 * @returns Object containing generateAutheliaYaml and generateCloudflareYaml functions
 */
export function useConfigGenerators() {
    const config = useSetupStore((state) => state.config)
    const selectedServices = useSetupStore((state) => state.selectedServices)

    const generateAutheliaYaml = useMemo(
        () => () => {
            return `---
theme: dark
default_redirection_url: https://${config.domain}

server:
  host: 0.0.0.0
  port: 9091

log:
  level: info

totp:
  issuer: ${config.domain}

authentication_backend:
  file:
    path: /config/users_database.yml

access_control:
  default_policy: deny
  rules:
    - domain: "*.${config.domain}"
      policy: two_factor

session:
  name: authelia_session
  domain: ${config.domain}
  expiration: 1h
  inactivity: 5m
  remember_me_duration: 1M
  redis:
    host: redis
    port: 6379
    password: \${AUTHELIA_SESSION_REDIS_PASSWORD}

storage:
  encryption_key: \${AUTHELIA_STORAGE_ENCRYPTION_KEY}
  local:
    path: /config/db.sqlite3

notifier:
  filesystem:
    filename: /config/notification.txt
`
        },
        [config.domain]
    )

    const generateCloudflareYaml = useMemo(
        () => () => {
            const has = (profile: string) => selectedServices.includes(profile)
            const hasArr = has('arr')
            return `tunnel: YOUR_TUNNEL_ID
credentials-file: /etc/cloudflared/cert.json

ingress:
  - hostname: auth.${config.domain}
    service: http://authelia:9091
  - hostname: hub.${config.domain}
    service: http://homepage:3000
  - hostname: portainer.${config.domain}
    service: http://portainer:9000
  - hostname: dozzle.${config.domain}
    service: http://dozzle:8080
  - hostname: grafana.${config.domain}
    service: http://grafana:3000
${selectedServices.includes('plex') ? `  - hostname: plex.${config.domain}
    service: http://plex:32400` : ''}
${selectedServices.includes('jellyfin') ? `  - hostname: jellyfin.${config.domain}
    service: http://jellyfin:8096` : ''}
${hasArr || has('overseerr') ? `  - hostname: request.${config.domain}
    service: http://overseerr:5055` : ''}
${hasArr || has('sonarr') ? `  - hostname: sonarr.${config.domain}
    service: http://sonarr:8989` : ''}
${hasArr || has('radarr') ? `  - hostname: radarr.${config.domain}
    service: http://radarr:7878` : ''}
${hasArr || has('prowlarr') ? `  - hostname: prowlarr.${config.domain}
    service: http://prowlarr:9696` : ''}
${hasArr || has('bazarr') ? `  - hostname: bazarr.${config.domain}
    service: http://bazarr:6767` : ''}
${selectedServices.includes('stats') ? `  - hostname: tautulli.${config.domain}
    service: http://tautulli:8181` : ''}
${selectedServices.includes('transcode') ? `  - hostname: tdarr.${config.domain}
    service: http://tdarr:8265` : ''}
${selectedServices.includes('notify') ? `  - hostname: notifiarr.${config.domain}
    service: http://notifiarr:5454` : ''}
${selectedServices.includes('torrent') ? `  - hostname: qbt.${config.domain}
    service: http://gluetun:8080` : ''}
${selectedServices.includes('mealie') ? `  - hostname: mealie.${config.domain}
    service: http://mealie:9000` : ''}
${selectedServices.includes('kavita') ? `  - hostname: kavita.${config.domain}
    service: http://kavita:5000` : ''}
${selectedServices.includes('audiobookshelf') ? `  - hostname: audiobookshelf.${config.domain}
    service: http://audiobookshelf:13378` : ''}
${selectedServices.includes('photoprism') ? `  - hostname: photoprism.${config.domain}
    service: http://photoprism:2342` : ''}
  - service: http_status:404
`
        },
        [config.domain, selectedServices]
    )

    return { generateAutheliaYaml, generateCloudflareYaml }
}
