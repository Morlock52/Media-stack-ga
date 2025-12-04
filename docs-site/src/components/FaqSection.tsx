import { useState } from 'react'

const faqs = [
    {
        question: 'How does this align with plan.md?',
        answer: 'Each section mirrors a verification step: env hardening, Cloudflare ingress, Authelia policies, Arr integrations, qBittorrent VPN routing, Tdarr workflows, Notifiarr broadcasts, Homepage UX, and manual/automated QA. You can track progress using the checklist and integration matrix.',
    },
    {
        question: 'Can I deploy pieces gradually?',
        answer: 'Yes. Start with Authelia + Cloudflare for secure ingress, then layer Plex/Jellyfin, the Arr stack, qBittorrent + Gluetun, Tdarr, and finally Notifiarr. The flow diagram highlights dependency order.',
    },
    {
        question: 'What about hardware acceleration?',
        answer: 'Jellyfin, Plex, and Tdarr all mount /dev/dri for Intel/AMD iGPUs. Plan.md reminds you to enable it per host OS. You can swap Tdarr recipes for GPU or CPU as needed.',
    },
    {
        question: 'How do I keep everything updated?',
        answer: 'Watchtower handles scheduled pulls, while Portainer (behind Authelia) gives you a UI for manual redeploys. The docs also include manual docker-compose commands for rollbacks.',
    },
    {
        question: 'Where can I get support?',
        answer: 'Join the Discord server, read the Reddit megathread, or open a GitHub discussion. Social proof cards on this page point you to the most active venues.',
    },
]

export function FaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(0)

    return (
        <section className="py-24 container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-10 space-y-3">
                <p className="text-primary uppercase tracking-[0.4em] text-xs">FAQ</p>
                <h2 className="text-4xl font-bold">Still curious?</h2>
                <p className="text-muted-foreground">Most frequent questions from Twitter threads, Reddit AMAs, and Discord office hours.</p>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
                {faqs.map((faq, index) => {
                    const isOpen = index === openIndex
                    return (
                        <div
                            key={faq.question}
                            className="glass border border-white/10 rounded-2xl p-4 cursor-pointer"
                            onClick={() => setOpenIndex(isOpen ? null : index)}
                        >
                            <div className="flex items-center justify-between gap-4">
                                <p className="text-lg font-semibold">{faq.question}</p>
                                <span className="text-primary text-xl">{isOpen ? '-' : '+'}</span>
                            </div>
                            {isOpen && (
                                <p className="mt-3 text-muted-foreground">{faq.answer}</p>
                            )}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}
