import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Code, Shield, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../StatusBadge'
import { buildControlServerUrl, controlServerAuthHeaders } from '../../utils/controlServer'

export function HeroSection() {
  const scrollToWizard = () => {
    document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' })
  }

  type HealthSnapshot = {
    healthy: boolean
    summary: string
    issues: Array<{ type: string; service: string; message: string }>
    suggestions?: Array<{ action: string; service: string; label: string }>
    containerCount: number
    runningCount: number
    error?: string
  }

  const [pulse, setPulse] = useState<{
    status: 'loading' | 'online' | 'offline'
    latencyMs: number | null
    lastCheckedAt: Date | null
    snapshot: HealthSnapshot | null
  }>(() => ({ status: 'loading', latencyMs: null, lastCheckedAt: null, snapshot: null }))
  const featureCardsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let interval: number | null = null

    const fetchSnapshot = async () => {
      const started = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const res = await fetch(buildControlServerUrl('/api/health-snapshot'), {
          headers: { ...controlServerAuthHeaders() },
        })
        const ended = typeof performance !== 'undefined' ? performance.now() : Date.now()
        const latencyMs = Math.max(0, Math.round(ended - started))

        if (!res.ok) throw new Error('Control server unreachable')
        const data = (await res.json()) as HealthSnapshot
        if (cancelled) return

        setPulse({
          status: 'online',
          latencyMs,
          lastCheckedAt: new Date(),
          snapshot: data,
        })
      } catch {
        if (cancelled) return
        setPulse((prev) => ({
          ...prev,
          status: 'offline',
          latencyMs: null,
          lastCheckedAt: new Date(),
          snapshot: null,
        }))
      }
    }

    fetchSnapshot()
    interval = window.setInterval(fetchSnapshot, 10_000)

    return () => {
      cancelled = true
      if (interval) window.clearInterval(interval)
    }
  }, [])

  const computed = useMemo(() => {
    const total = pulse.snapshot?.containerCount ?? 0
    const running = pulse.snapshot?.runningCount ?? 0
    const issues = pulse.snapshot?.issues?.length ?? 0
    const stopped = pulse.snapshot?.issues?.filter((i) => i.type === 'stopped').length ?? 0
    const unhealthy = pulse.snapshot?.issues?.filter((i) => i.type === 'unhealthy').length ?? 0
    const restarting = pulse.snapshot?.issues?.filter((i) => i.type === 'restarting').length ?? 0
    const suggestions = pulse.snapshot?.suggestions ?? []
    const snapshotHealthy = Boolean(pulse.snapshot?.healthy)
    const hasContainers = total > 0
    const uptimePct = hasContainers ? Math.round((running / total) * 100) : snapshotHealthy ? 100 : 0
    const issuesScorePct = Math.max(0, 100 - issues * 15)
    const latencyScorePct =
      pulse.status === 'offline' || pulse.latencyMs == null
        ? 0
        : Math.max(10, 100 - pulse.latencyMs)

    const pctToWidthClass = (pct: number) => {
      if (pct <= 0) return 'w-0'
      if (pct <= 10) return 'w-1/12'
      if (pct <= 20) return 'w-1/6'
      if (pct <= 33) return 'w-1/3'
      if (pct <= 50) return 'w-1/2'
      if (pct <= 66) return 'w-2/3'
      if (pct <= 80) return 'w-5/6'
      return 'w-full'
    }

    return {
      total,
      running,
      issues,
      stopped,
      unhealthy,
      restarting,
      suggestions,
      snapshotHealthy,
      hasContainers,
      uptimePct,
      uptimeWidthClass: pctToWidthClass(uptimePct),
      issuesWidthClass: pctToWidthClass(issuesScorePct),
      latencyWidthClass: pctToWidthClass(latencyScorePct),
    }
  }, [pulse.snapshot, pulse.status, pulse.latencyMs])

  useEffect(() => {
    const node = featureCardsRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const cards = Array.from(node.querySelectorAll<HTMLElement>('[data-feature-card]'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement
          if (entry.isIntersecting) {
            target.classList.add('feature-card-visible')
          } else {
            target.classList.remove('feature-card-visible')
          }
        })
      },
      {
        threshold: [0.2, 0.5],
        rootMargin: '0px 0px -10% 0px',
      }
    )

    cards.forEach((card) => observer.observe(card))
    return () => observer.disconnect()
  }, [])


  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-transparent">
      {/* Matrix grid + scanlines */}
      <div className="absolute inset-0 opacity-35 matrix-grid pointer-events-none" />
      <div className="absolute inset-0 scanlines pointer-events-none" />

      <div className="relative z-10 container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center"
        >
          <div className="text-center lg:text-left">
            {/* Badges and Logo */}
            <div className="flex flex-col items-center lg:items-start gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/15 via-cyan-500/20 to-lime-500/20 border border-primary/40 backdrop-blur-sm shadow-lg shadow-emerald-500/10"
              >
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary font-mono uppercase tracking-[0.18em]">
                  Interactive Setup Wizard
                </span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <StatusBadge iconClassName="w-12 h-12" forceFullColor />
              </motion.div>

            </div>

            {/* Main heading */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-6xl lg:text-7xl font-heading font-bold mb-6 tracking-tight"
            >
              <span className="text-gradient neon-text">
                Configure Your
              </span>
              <br />
              <span className="text-gradient-primary glitch neon-text" data-text="Media Stack">
                Media Stack
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto lg:mx-0 leading-relaxed"
            >
              Generate production-ready <code className="px-2 py-1 bg-primary/15 rounded text-primary">.env</code> and config files in minutes.
              <br />
              <span className="text-primary font-semibold">Interactive wizard.</span> Complete configs. Zero guesswork.
            </motion.p>

            {/* CTA buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center lg:items-start mb-8"
            >
              <button
                onClick={scrollToWizard}
                className="group relative px-8 py-4 bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 rounded-xl font-semibold text-white hover:shadow-2xl hover:shadow-emerald-400/25 transition-all duration-300 hover:scale-105"
                title="Launch the interactive setup wizard"
              >
                <span className="flex items-center gap-2">
                  Launch Setup Wizard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-lime-400 blur-xl opacity-50 group-hover:opacity-75 transition-opacity pointer-events-none" />
              </button>

              <Link
                to="/docs"
                className="px-8 py-4 rounded-xl border border-border text-muted-foreground hover:border-primary/60 hover:text-primary transition-all duration-300 hover:bg-primary/10 backdrop-blur-sm"
                title="View app guides and documentation"
              >
                <span className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  View Docs
                </span>
              </Link>
            </motion.div>

            <div className="flex flex-wrap justify-center lg:justify-start gap-3 text-[11px] font-mono uppercase tracking-[0.2em] text-primary/70">
              <span className="px-3 py-1 rounded-full border border-primary/30 bg-primary/10">Zero Trust</span>
              <span className="px-3 py-1 rounded-full border border-primary/30 bg-primary/10">Auto Config</span>
              <span className="px-3 py-1 rounded-full border border-primary/30 bg-primary/10">Live Sync</span>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="hidden lg:block"
          >
            <div
              className={
                "relative rounded-3xl border border-primary/40 backdrop-blur-2xl p-6 shadow-[0_30px_90px_-40px_rgba(16,185,129,0.6)] overflow-hidden " +
                (computed.snapshotHealthy
                  ? 'bg-slate-950/70'
                  : pulse.status === 'offline'
                    ? 'bg-slate-950/85'
                    : 'bg-slate-950/80')
              }
            >
              <div className="absolute inset-0 matrix-grid opacity-15 pointer-events-none" />
              <div className="absolute -top-14 -right-10 w-48 h-48 bg-emerald-400/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-14 -left-10 w-48 h-48 bg-cyan-400/15 blur-3xl pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.35em] text-primary/70 font-mono">
                  <span>System Pulse</span>
                  {pulse.status === 'loading' ? (
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse" />
                      Loading
                    </span>
                  ) : pulse.status === 'offline' ? (
                    <span className="flex items-center gap-2 text-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Offline
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Live
                    </span>
                  )}
                </div>

                <div className="hud-line" />

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="rounded-xl border border-primary/30 bg-black/40 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-mono">Control Server</p>
                    <p
                      className={
                        'text-base font-semibold ' +
                        (pulse.status === 'offline' ? 'text-amber-300' : pulse.status === 'loading' ? 'text-muted-foreground' : 'text-emerald-300')
                      }
                    >
                      {pulse.status === 'offline' ? 'Offline' : pulse.status === 'loading' ? 'Checking…' : 'Online'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pulse.status === 'offline' || pulse.latencyMs == null ? '—' : `${pulse.latencyMs}ms latency`}
                    </p>
                  </div>

                  <div className="rounded-xl border border-primary/30 bg-black/40 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-mono">Containers</p>
                    <p className="text-base font-semibold text-foreground font-mono">
                      {pulse.status === 'offline'
                        ? '—'
                        : computed.hasContainers
                          ? `${computed.running}/${computed.total}`
                          : '0'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pulse.status === 'offline'
                        ? 'API unreachable'
                        : computed.hasContainers
                          ? 'running / total'
                          : 'No containers detected'}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-black/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-primary/70 uppercase tracking-[0.2em]">Summary</span>
                    <span
                      className={
                        'text-xs ' +
                        (pulse.status === 'offline'
                          ? 'text-amber-300'
                          : computed.snapshotHealthy
                            ? 'text-emerald-300'
                            : 'text-amber-300')
                      }
                    >
                      {pulse.status === 'offline' ? 'Unavailable' : computed.snapshotHealthy ? 'Healthy' : 'Degraded'}
                    </span>
                  </div>
                  <div className="text-xs text-primary/80 font-mono break-words">
                    {pulse.status === 'offline'
                      ? 'Control server not reachable (start it on :3001)'
                      : pulse.snapshot?.error
                        ? pulse.snapshot.error
                        : pulse.snapshot?.summary || '—'}
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="rounded-lg border border-primary/20 bg-black/30 px-2 py-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-mono">Stopped</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{pulse.status === 'offline' ? '—' : computed.stopped}</div>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-black/30 px-2 py-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-mono">Unhealthy</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{pulse.status === 'offline' ? '—' : computed.unhealthy}</div>
                    </div>
                    <div className="rounded-lg border border-primary/20 bg-black/30 px-2 py-2">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-primary/60 font-mono">Restarting</div>
                      <div className="text-sm font-semibold text-foreground font-mono">{pulse.status === 'offline' ? '—' : computed.restarting}</div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-primary/20 bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-mono mb-2">Issues</p>
                    {pulse.status === 'offline' ? (
                      <p className="text-xs text-muted-foreground font-mono">—</p>
                    ) : computed.issues === 0 ? (
                      <p className="text-xs text-emerald-300 font-mono">None</p>
                    ) : (
                      <div className="space-y-1">
                        {(pulse.snapshot?.issues || []).slice(0, 3).map((issue, idx) => (
                          <div key={`${issue.service}-${issue.type}-${idx}`} className="text-xs font-mono text-primary/80">
                            <span className="text-primary/60">[{issue.type}]</span> {issue.service}
                          </div>
                        ))}
                        {computed.issues > 3 && (
                          <div className="text-xs font-mono text-muted-foreground">+{computed.issues - 3} more</div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-primary/20 bg-black/30 p-3">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-primary/70 font-mono mb-2">Suggested Actions</p>
                    {pulse.status === 'offline' ? (
                      <p className="text-xs text-muted-foreground font-mono">—</p>
                    ) : computed.suggestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground font-mono">No actions</p>
                    ) : (
                      <div className="space-y-1">
                        {computed.suggestions.slice(0, 3).map((s, idx) => (
                          <div key={`${s.service}-${s.action}-${idx}`} className="text-xs font-mono text-primary/80">
                            {s.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-primary/20 bg-black/30 p-3 font-mono text-xs text-primary/80 space-y-1">
                  <div>
                    &gt; poll: every 10s
                  </div>
                  <div>
                    &gt; checked:{' '}
                    {pulse.lastCheckedAt
                      ? pulse.lastCheckedAt.toLocaleString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          month: '2-digit',
                          day: '2-digit',
                        })
                      : '—'}
                  </div>
                  <div>
                    &gt; source: {pulse.status === 'offline' ? '—' : '/api/health-snapshot'}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto"
          ref={featureCardsRef}
        >
          <div
            className="feature-card p-6 rounded-2xl glass-deep hover:border-emerald-400/70 transition-all duration-500 hover:-translate-y-1 group"
            data-feature-card
            style={{ transitionDelay: '60ms' }}
          >
            <Code className="w-8 h-8 text-emerald-300 mb-4 group-hover:animate-pulse" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Generate Configs</h3>
            <p className="text-muted-foreground text-sm">Download .env, Authelia, and Cloudflare files</p>
          </div>

          <div
            className="feature-card p-6 rounded-2xl glass-deep hover:border-cyan-300/70 transition-all duration-500 hover:-translate-y-1 group"
            data-feature-card
            style={{ transitionDelay: '140ms' }}
          >
            <Shield className="w-8 h-8 text-cyan-300 mb-4 group-hover:animate-pulse" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Production Ready</h3>
            <p className="text-muted-foreground text-sm">Security & best practices built-in</p>
          </div>

          <div
            className="feature-card p-6 rounded-2xl glass-deep hover:border-lime-300/70 transition-all duration-500 hover:-translate-y-1 group"
            data-feature-card
            style={{ transitionDelay: '220ms' }}
          >
            <Zap className="w-8 h-8 text-lime-300 mb-4 group-hover:animate-pulse" />
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Save Progress</h3>
            <p className="text-muted-foreground text-sm">Auto-saves so you can return anytime</p>
          </div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-border rounded-full flex justify-center">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 h-3 bg-muted-foreground rounded-full mt-2"
          />
        </div>
      </motion.div>
    </section>
  )
}
