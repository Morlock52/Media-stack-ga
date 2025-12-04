import { Cloud } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function CloudflaredGuide() {
    return (
        <AppGuideLayout
            icon={<Cloud className="w-7 h-7 text-orange-300" />}
            title="Cloudflared"
            subtitle="Expose every container securely with Cloudflare Tunnel"
            category="Networking"
            estimatedTime="20–30 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Why Cloudflared?</h3>
                    <p>
                        Cloudflared creates an outbound-only tunnel from your homelab to Cloudflare&apos;s edge so you never open router
                        ports. Traffic hits Cloudflare, passes through the tunnel, and then lands on Authelia before reaching apps like Plex,
                        qBittorrent, or Overseerr. The result: Zero Trust access with HTTPS + SSO on every hostname.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Initial Setup</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Visit the{' '}
                            <a
                                href="https://one.dash.cloudflare.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-300 hover:underline"
                            >
                                Cloudflare Zero Trust dashboard
                            </a>{' '}
                            → Access → Tunnels → <strong>Create a tunnel</strong>. Name it something like <code>mediastack</code>.
                        </li>
                        <li>
                            Choose the <strong>Cloudflared</strong> connector, download the credentials file, and place it in{' '}
                            <code>config/cloudflared/</code>. The setup wizard already creates this folder; just replace the credential file if
                            you re-generated it manually.
                        </li>
                        <li>
                            Confirm your <code>.env</code> has <code>CLOUDFLARED_COMMAND=tunnel --no-autoupdate run mediastack</code>{' '}
                            (or the name you used). Update it if the tunnel UUID changed.
                        </li>
                        <li>
                            Start (or restart) the container: <code>docker compose up -d cloudflared</code>.
                        </li>
                        <li>
                            Watch the logs until you see <em>&quot;Connection established&quot;</em>: <code>docker compose logs -f cloudflared</code>.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Add Public Hostnames</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            In Zero Trust → Access → Tunnels → <strong>Your tunnel</strong> → <strong>Public hostnames</strong>, click{' '}
                            <strong>Add a public hostname</strong>.
                        </li>
                        <li>
                            Enter subdomain + domain (e.g., <code>plex.yourdomain.com</code>) and point it to the internal service URL,
                            such as <code>http://plex:32400</code>, <code>http://overseerr:5055</code>, or <code>http://homepage:3000</code>.
                        </li>
                        <li>
                            Repeat for each service. Match the hostnames listed in <code>apps.md</code> or the Homepage dashboard so users see
                            consistent links.
                        </li>
                        <li>
                            Optional but recommended: attach a Cloudflare Access policy (Identity → Applications) for especially sensitive
                            services like qBittorrent or Portainer so only approved identities even reach Authelia.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Verification Checklist</h3>
                    <ul className="list-disc list-inside space-y-1 text-gray-300">
                        <li>
                            <code>docker compose ps cloudflared</code> shows <em>Up</em> and the logs contain <em>Connected to Cloudflare</em>.
                        </li>
                        <li>
                            Hitting <code>https://auth.yourdomain.com</code> or <code>https://plex.yourdomain.com</code> loads via HTTPS and
                            prompts for Authelia.
                        </li>
                        <li>
                            In Zero Trust → Tunnels, latency stays green and reconnects within a few seconds after reboots.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
