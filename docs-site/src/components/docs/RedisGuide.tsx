import { Database } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function RedisGuide() {
    return (
        <AppGuideLayout
            icon={<Database className="w-7 h-7 text-rose-300" />}
            title="Redis"
            subtitle="Keeps Authelia sessions durable and fast"
            category="Infrastructure"
            estimatedTime="5–10 minutes"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Role in the stack</h3>
                    <p>
                        Authelia stores sessions, TOTP state, and user preferences in Redis so logins survive container restarts and the
                        stack can scale horizontally later. The compose file enables append-only persistence and a health check so you get an
                        early warning if authentication might fail.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Day-one verification</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            Make sure the container is <em>Up</em>: <code>docker compose ps redis</code>. If it keeps restarting, double-check{' '}
                            <code>REDIS_PASSWORD</code> in your <code>.env</code>.
                        </li>
                        <li>
                            Run <code>docker compose exec redis redis-cli -a $REDIS_PASSWORD ping</code>. Expect <code>PONG</code>.
                        </li>
                        <li>
                            From the Authelia container, validate connectivity:
                            <code>docker compose exec authelia redis-cli -h redis -a $REDIS_PASSWORD info clients</code>. You should see at
                            least one connected client.
                        </li>
                    </ol>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">Maintenance tips</h3>
                    <ul className="list-disc list-inside space-y-2 text-gray-300">
                        <li>
                            Data lives inside the named volume <code>redis_data</code>. Include it in your off-site backups if you want to
                            preserve session state.
                        </li>
                        <li>
                            The command <code>redis-server --appendonly yes</code> already enables durable writes, but you can periodically run{' '}
                            <code>docker compose exec redis redis-cli bgsave</code> before major upgrades.
                        </li>
                        <li>
                            Monitor logs for <em>OOM</em> or <em>Misconf</em>. If you increase users or enable push notifications, consider
                            giving Redis more RAM via <code>deploy.resources</code> limits.
                        </li>
                    </ul>
                </div>
            </section>
        </AppGuideLayout>
    )
}
