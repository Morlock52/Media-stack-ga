import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, Code, Shield, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

import { StatusBadge } from '../StatusBadge'

export function HeroSection() {
  const scrollToWizard = () => {
    document.getElementById('builder')?.scrollIntoView({ behavior: 'smooth' })
  }


  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-transparent">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-20 left-20 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-pink-500/10 rounded-full blur-3xl animate-pulse delay-500" />
      </div>

      {/* Grid overlay */}
      <div className="absolute inset-0 opacity-30 grid-pattern" />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Badges and Logo */}
          <div className="flex flex-col items-center gap-6 mb-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, type: 'spring' }}
              className="w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-background/50 border border-border p-2 shadow-2xl shadow-purple-500/20 backdrop-blur-sm overflow-hidden"
            >
              <img src="/media-stack-logo.png" alt="Media Stack Logo" className="w-full h-full object-contain" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 backdrop-blur-sm"
            >
              <Zap className="w-4 h-4 text-purple-400" />
              <span className="text-sm font-medium text-purple-300">Interactive Setup Wizard • 2025</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <StatusBadge />
            </motion.div>
          </div>

          {/* Main heading */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-6xl md:text-7xl font-heading font-bold mb-6 tracking-tight"
          >
            <span className="text-gradient">
              Configure Your
            </span>
            <br />
            <span className="text-gradient-primary">
              Media Stack
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-3xl mx-auto leading-relaxed"
          >
            Generate production-ready <code className="px-2 py-1 bg-purple-500/20 rounded text-purple-300">.env</code> and config files in minutes.
            <br />
            <span className="text-purple-400 font-semibold">Interactive wizard.</span> Complete configs. Zero guesswork.
          </motion.p>

          {/* CTA buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <button
              onClick={scrollToWizard}
              className="group relative px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-semibold text-white hover:shadow-2xl hover:shadow-purple-500/25 transition-all duration-300 hover:scale-105"
              title="Launch the interactive setup wizard"
            >
              <span className="flex items-center gap-2">
                Launch Setup Wizard
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
            </button>

            <Link
              to="/docs"
              className="px-8 py-4 rounded-xl border border-border text-muted-foreground hover:border-purple-500 hover:text-purple-300 transition-all duration-300 hover:bg-purple-500/10 backdrop-blur-sm"
              title="View app guides and documentation"
            >
              <span className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                View Docs
              </span>
            </Link>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            <div className="p-6 rounded-2xl glass-deep hover:border-neon-purple/50 transition-all duration-300 hover:-translate-y-1 group">
              <Code className="w-8 h-8 text-neon-purple mb-4 group-hover:animate-pulse" />
              <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Generate Configs</h3>
              <p className="text-muted-foreground text-sm">Download .env, Authelia, and Cloudflare files</p>
            </div>

            <div className="p-6 rounded-2xl glass-deep hover:border-neon-blue/50 transition-all duration-300 hover:-translate-y-1 group">
              <Shield className="w-8 h-8 text-blue-400 mb-4 group-hover:animate-pulse" />
              <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Production Ready</h3>
              <p className="text-muted-foreground text-sm">Security & best practices built-in</p>
            </div>

            <div className="p-6 rounded-2xl glass-deep hover:border-neon-pink/50 transition-all duration-300 hover:-translate-y-1 group">
              <Zap className="w-8 h-8 text-neon-pink mb-4 group-hover:animate-pulse" />
              <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Save Progress</h3>
              <p className="text-muted-foreground text-sm">Auto-saves so you can return anytime</p>
            </div>
          </motion.div>
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
