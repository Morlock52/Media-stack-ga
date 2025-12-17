const resources = [
    { label: 'TRaSH Guides', href: 'https://trash-guides.info/' },
    { label: 'Cloudflare Zero Trust', href: 'https://one.dash.cloudflare.com/' },
    { label: 'Authelia Docs', href: 'https://www.authelia.com/' },
    { label: 'LinuxServer.io', href: 'https://www.linuxserver.io/' },
    { label: 'Tdarr Recipes', href: 'https://tdarr.io/' },
    { label: 'Notifiarr Wiki', href: 'https://notifiarr.com/' },
]

export function ResourcesStrip() {
    return (
        <section className="py-10 bg-muted/30">
            <div className="container mx-auto px-4 overflow-hidden">
                <div className="flex flex-wrap items-center justify-center gap-6 text-xs uppercase tracking-widest text-muted-foreground">
                    {resources.map(res => (
                        <a key={res.label} href={res.href} target="_blank" rel="noreferrer" className="px-4 py-2 rounded-full border border-border hover:border-primary bg-background/60 hover:bg-muted/80 text-foreground/80 hover:text-foreground transition-colors">
                            {res.label}
                        </a>
                    ))}
                </div>
            </div>
        </section>
    )
}
