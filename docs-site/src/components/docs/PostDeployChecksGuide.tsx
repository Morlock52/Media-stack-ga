import { ShieldCheck } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function PostDeployChecksGuide() {
    return (
        <AppGuideLayout
            icon={<ShieldCheck className="w-7 h-7 text-emerald-400" />}
            title="Post‑Deploy Checks"
            subtitle="Verify VPN + Auth + Tunnel after updates"
            category="Maintenance"
            estimatedTime="2–3 min"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">When to run this</h3>
                    <p>
                        Run after <code>docker compose pull</code>, <code>docker compose up -d</code>, or after Watchtower updates.
                        It catches the common “everything looks up but nothing works” failures: VPN DNS issues, auth misroutes,
                        and tunnel/DNS drift.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">One‑shot command</h3>
                    <div className="bg-slate-950 p-4 rounded-lg border border-white/10 font-mono text-xs whitespace-pre-wrap">
                        bash ./scripts/post_deploy_check.sh
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        Full notes live in <code>docs/operations/POST_DEPLOY_CHECKS.md</code>.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">What it checks</h3>
                    <ul className="list-disc list-inside space-y-1">
                        <li><strong>Gluetun:</strong> public IP + DNS resolution from inside the VPN namespace</li>
                        <li><strong>qBittorrent:</strong> confirms it is network‑namespaced behind Gluetun (kill‑switch wiring)</li>
                        <li><strong>Authelia:</strong> <code>/api/verify</code> returns 401 (unauthenticated) and <code>/api/state</code> returns 200</li>
                        <li><strong>Cloudflare Tunnel/DNS:</strong> optional hostname + HTTP reachability probe</li>
                    </ul>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Common overrides</h3>
                    <div className="bg-slate-950 p-4 rounded-lg border border-white/10 font-mono text-xs whitespace-pre-wrap">
                        export AUTHELIA_BASE=&quot;https://auth.example.com&quot;
                        {'\n'}export TEST_HOST=&quot;homepage.example.com&quot;
                        {'\n'}export HEALTH_PATH=&quot;/&quot;
                        {'\n'}bash ./scripts/post_deploy_check.sh
                    </div>
                    <p className="mt-2 text-xs text-gray-400">
                        Tip: if you use Authelia protection, a 302 redirect to login is still a good sign that the tunnel is working.
                    </p>
                </div>
            </section>
        </AppGuideLayout>
    )
}

