import { Shield } from 'lucide-react'
import { AppGuideLayout } from './AppGuideLayout'

export function AutheliaGuide() {
    return (
        <AppGuideLayout
            icon={<Shield className="w-7 h-7 text-orange-500" />}
            title="Authelia"
            subtitle="Single Sign-On & Two-Factor Authentication"
            category="Security"
            estimatedTime="Setup via .env"
        >
            <section className="space-y-6 text-sm text-gray-300">
                <div>
                    <h3 className="text-base font-semibold text-white mb-2">How Authelia protects you</h3>
                    <p>
                        Authelia sits in front of your apps. When you access <code>sonarr.yourdomain.com</code>, Cloudflare checks with Authelia first.
                        You must log in with your username/password (and 2FA) before you can even see the Sonarr login screen.
                    </p>
                </div>

                <div>
                    <h3 className="text-base font-semibold text-white mb-2">User Management</h3>
                    <ol className="list-decimal list-inside space-y-2 text-gray-300">
                        <li>
                            <strong>Users File:</strong> Users are defined in <code>config/authelia/users_database.yml</code>.
                        </li>
                        <li>
                            <strong>Changing Password:</strong>
                            You must generate a new Argon2 hash for your password.
                            <div className="bg-slate-950 p-2 mt-1 rounded border border-white/10 font-mono text-xs">
                                docker run --rm authelia/authelia:latest authelia crypto hash generate argon2 --password 'YourPassword'
                            </div>
                            Replace the hash in the config file with the new output.
                        </li>
                        <li>
                            <strong>2FA:</strong> When you log in for the first time, register your device (using Google Authenticator, Authy, etc.) by following the on-screen QR code.
                        </li>
                    </ol>
                </div>
            </section>
        </AppGuideLayout>
    )
}
