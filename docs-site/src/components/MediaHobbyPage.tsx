import { motion } from 'framer-motion'
import { Play, Music, Film, BookOpen, Headphones, Tv, Gamepad2, Camera } from 'lucide-react'

const mediaHobbies = [
  {
    icon: Film,
    title: 'Movie Collection',
    description: 'Automated movie downloads with Radarr, Plex/Jellyfin streaming',
    features: ['4K HDR support', 'Automatic metadata', 'Mobile streaming'],
    color: 'from-blue-500 to-purple-600'
  },
  {
    icon: Tv,
    title: 'TV Shows',
    description: 'Complete TV series management with Sonarr and smart scheduling',
    features: ['Season packs', 'Auto-discovery', 'Watchlist integration'],
    color: 'from-purple-500 to-pink-600'
  },
  {
    icon: Music,
    title: 'Music Library',
    description: 'Lidarr for music collection management with high-quality audio',
    features: ['FLAC support', 'Artist discovery', 'Concert recordings'],
    color: 'from-green-500 to-teal-600'
  },
  {
    icon: BookOpen,
    title: 'Books & Audiobooks',
    description: 'Readarr and Audiobookshelf for your reading collection',
    features: ['eBook management', 'Podcast feeds', 'Reading progress'],
    color: 'from-orange-500 to-red-600'
  },
  {
    icon: Headphones,
    title: 'Podcasts',
    description: 'Automatic podcast downloads and organization',
    features: ['RSS feeds', 'Auto-download', 'Player integration'],
    color: 'from-cyan-500 to-blue-600'
  },
  {
    icon: Gamepad2,
    title: 'Gaming Media',
    description: 'Game trailers, streams, and entertainment content',
    features: ['Twitch integration', 'Game captures', 'Streaming setup'],
    color: 'from-pink-500 to-rose-600'
  },
  {
    icon: Camera,
    title: 'Photography',
    description: 'Photo organization and media gallery management',
    features: ['RAW processing', 'Auto-tagging', 'Cloud backup'],
    color: 'from-indigo-500 to-purple-600'
  },
  {
    icon: Play,
    title: 'Live Streaming',
    description: 'IPTV and live TV management with Threadfin',
    features: ['EPG guides', 'Recording', 'Multi-source'],
    color: 'from-red-500 to-orange-600'
  }
]

export function MediaHobbyPage() {
  return (
    <div className="space-y-16">
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-purple-400 to-pink-500 bg-clip-text text-transparent">
              Media Stack for Hobbyists
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
              Transform your media hobbies with automated self-hosted tools. 
              From movie collectors to audiophiles, build the perfect setup.
            </p>
            <div className="flex justify-center gap-4">
              <div className="px-4 py-2 bg-primary/10 border border-primary/30 rounded-lg">
                <span className="text-primary font-semibold">8+ Media Types</span>
              </div>
              <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <span className="text-emerald-400 font-semibold">Fully Automated</span>
              </div>
              <div className="px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <span className="text-blue-400 font-semibold">Self-Hosted</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-black/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Your Media Hobbies, Supercharged</h2>
            <p className="text-muted-foreground">
              Each hobby gets specialized tools and automation
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {mediaHobbies.map((hobby, index) => (
              <motion.div
                key={hobby.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group"
              >
                <div className="glass border border-white/10 rounded-2xl p-6 h-full hover:border-primary/30 transition-all hover:scale-[1.02]">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${hobby.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <hobby.icon className="w-8 h-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">{hobby.title}</h3>
                  <p className="text-muted-foreground mb-6 text-sm">{hobby.description}</p>
                  
                  <div className="space-y-2">
                    {hobby.features.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                        {feature}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Popular Hobby Setups</h2>
            <p className="text-muted-foreground">Pre-configured stacks for common media hobbies</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="glass border border-white/10 rounded-2xl p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
                <Film className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Movie Collector</h3>
              <p className="text-muted-foreground mb-6">
                Perfect for movie enthusiasts with large collections
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Radarr for automation</li>
                <li>• Plex for streaming</li>
                <li>• Tdarr for transcoding</li>
                <li>• Overseerr for requests</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="glass border border-white/10 rounded-2xl p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
                <Music className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Audiophile Setup</h3>
              <p className="text-muted-foreground mb-6">
                High-quality music library with lossless audio
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Lidarr for music</li>
                <li>• Navidrome for streaming</li>
                <li>• Airsonic for mobile</li>
                <li>• FLAC support</li>
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="glass border border-white/10 rounded-2xl p-8"
            >
              <div className="w-12 h-12 rounded-xl bg-green-500/20 text-green-400 flex items-center justify-center mb-6">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Reader's Paradise</h3>
              <p className="text-muted-foreground mb-6">
                Complete eBook and audiobook management
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• Readarr for books</li>
                <li>• Audiobookshelf</li>
                <li>• Calibre integration</li>
                <li>• Kobo sync</li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>
    </div>
  )
}
