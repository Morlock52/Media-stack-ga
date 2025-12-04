const awards = [
    { label: 'Product Hunt · #3 Product of the Day', meta: 'Based on community votes' },
    { label: 'r/selfhosted · Megathread Winner', meta: 'Week 42 build showcase' },
    { label: 'LinkedIn · MediaOps Spotlight', meta: 'Top 5 pipeline tools' },
]

export function AwardsBar() {
    return (
        <section className="py-10 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 border-y border-white/5">
            <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
                {awards.map(award => (
                    <div key={award.label}>
                        <p className="text-white font-semibold">{award.label}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest">{award.meta}</p>
                    </div>
                ))}
            </div>
        </section>
    )
}
