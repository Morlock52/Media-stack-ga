import { useState } from 'react'

export function NewsletterSignup() {
    const [email, setEmail] = useState('')

    return (
        <section className="py-20 container mx-auto px-4">
            <div className="glass border border-white/10 rounded-3xl p-8 flex flex-col gap-4">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">Release radar</p>
                <h2 className="text-3xl md:text-4xl font-bold">Get the monthly plan.md update digest</h2>
                <p className="text-muted-foreground">
                    Hand-curated from GitHub Discussions, Discord polls, and social listening. We send one email covering new functions, Tdarr recipes, Notifiarr templates, and Cloudflare best practices.
                </p>
                <form
                    className="flex flex-col md:flex-row gap-4"
                    onSubmit={(e) => {
                        e.preventDefault()
                        setEmail('Thanks!')
                    }}
                >
                    <input
                        type="email"
                        required
                        placeholder="you@studio.com"
                        value={email === 'Thanks!' ? '' : email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1 rounded-2xl px-4 py-3 bg-white/5 border border-white/10 focus:outline-none focus:border-primary"
                    />
                    <button className="px-6 py-3 rounded-2xl bg-primary text-white font-semibold hover:scale-105 transition-transform">
                        Subscribe
                    </button>
                </form>
                {email === 'Thanks!' && <p className="text-sm text-emerald-300">Thanks! Check your inbox for the latest social recap.</p>}
            </div>
        </section>
    )
}
