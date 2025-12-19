import { z } from 'zod'

// ---------------------------------------------------------------------------
// STEP 1: BASIC CONFIGURATION
// ---------------------------------------------------------------------------
// This schema defines the very first page of the wizard:
// - Where your stack will be hosted (domain)
// - What timezone to use for all containers
// - File permission IDs (PUID/PGID)
// - A master password to reuse for some services
//
// NOTE FOR USERS (in comments):
// - Domain: use your real domain, e.g. media.example.com or home.mydomain.net.
// - PUID / PGID: run `id -u` and `id -g` on your Linux host.
// - Timezone: use an IANA name like "America/New_York".
export const basicConfigSchema = z.object({
    // Primary domain for your stack, without protocol.
    // Examples: "media.example.com", "home.mydomain.net".
    domain: z
        .string()
        .min(3, 'Domain is required')
        .refine((val) => val !== 'example.com', 'Please enter your actual domain')
        .refine(
            (val) => /^[a-zA-Z0-9][a-zA-Z0-9-_.]+[a-zA-Z0-9]$/.test(val),
            'Invalid domain format'
        ),

    // Timezone used by all containers.
    // Example: "America/New_York", "Europe/London".
    timezone: z.string().min(1, 'Timezone is required'),

    // PUID/PGID: numeric user/group IDs for file permissions.
    // On Linux, run:
    //   id -u   => PUID
    //   id -g   => PGID
    puid: z.string().regex(/^\d+$/, 'PUID must be a number'),
    pgid: z.string().regex(/^\d+$/, 'PGID must be a number'),

    // Master password used in some generated configs (e.g. dashboards).
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password is too long'),
})

export type BasicConfigFormData = z.infer<typeof basicConfigSchema>

// ---------------------------------------------------------------------------
// STEP 2: STACK SELECTION
// ---------------------------------------------------------------------------
// The user chooses which services to include (Plex, *Arr, Overseerr, etc.).
// We just validate that at least one was picked; per-service rules come later.
export const stackSelectionSchema = z.object({
    selectedServices: z
        .array(z.string())
        .min(1, 'Please select at least one service'),
})

export type StackSelectionFormData = z.infer<typeof stackSelectionSchema>

// ---------------------------------------------------------------------------
// STEP 3: SERVICE CONFIGURATION
// ---------------------------------------------------------------------------
// Each service can have its own small config map, like:
//   serviceConfigs: {
//     plex: { claimToken: '...', extraEnv: '...' },
//     sonarr: { qualityProfile: 'HD-1080p' }
//   }
export const serviceConfigSchema = z.record(z.string(), z.record(z.string(), z.string()))

// ---------------------------------------------------------------------------
// STEP 4: ADVANCED SETTINGS (all optional)
// ---------------------------------------------------------------------------
// These are power-user / integration fields:
// - Cloudflare: for DNS / tunnels config.
// - Plex claim: one-time token to link Plex server.
// - WireGuard: VPN settings for Gluetun.
export const advancedSettingsSchema = z.object({
    // Cloudflare API token for DNS / tunnel automation (if used).
    cloudflareToken: z.string().optional(),

    // Plex claim token, e.g. "claim-xxxxx" from https://plex.tv/claim
    plexClaim: z.string().optional(),

    // WireGuard private key for Gluetun.
    wireguardPrivateKey: z.string().optional(),

    // WireGuard address block, e.g. "10.0.0.2/32".
    wireguardAddresses: z
        .string()
        .refine(
            (val) => !val || /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/.test(val),
            'Invalid IP address format (e.g., 10.0.0.1/32)'
        )
        .optional(),
})

export type AdvancedSettingsFormData = z.infer<typeof advancedSettingsSchema>

// ---------------------------------------------------------------------------
// COMPLETE CONFIGURATION SCHEMA
// ---------------------------------------------------------------------------
// Merges the basic + advanced fields and adds services + per-service configs.
export const completeConfigSchema = basicConfigSchema
    .merge(advancedSettingsSchema)
    .extend({
        selectedServices: z.array(z.string()),
        serviceConfigs: serviceConfigSchema,
    })

export type CompleteConfigFormData = z.infer<typeof completeConfigSchema>
