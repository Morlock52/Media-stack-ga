import React, { useState } from 'react';
import { AnimatedTerminal } from './AnimatedTerminal';
import { Terminal, Monitor, CheckCircle, Server } from 'lucide-react';

export const InstallGuide: React.FC = () => {
    const [os, setOs] = useState<'unix' | 'windows'>('unix');

    return (
        <div className="container mx-auto px-4 py-12">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Install <span className="text-gradient-primary">MediaStack</span>
                    </h1>
                    <p className="text-xl text-muted-foreground">
                        Get up and running in minutes with our automated setup script.
                    </p>
                </div>

                {/* OS Toggle */}
                <div className="flex justify-center mb-12">
                    <div className="bg-secondary/50 p-1 rounded-xl inline-flex">
                        <button
                            onClick={() => setOs('unix')}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${os === 'unix'
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                }`}
                        >
                            Linux / macOS
                        </button>
                        <button
                            onClick={() => setOs('windows')}
                            className={`px-6 py-2 rounded-lg font-medium transition-all ${os === 'windows'
                                    ? 'bg-primary text-white shadow-lg'
                                    : 'text-muted-foreground hover:text-white'
                                }`}
                        >
                            Windows
                        </button>
                    </div>
                </div>

                {/* Prerequisites */}
                <div className="grid md:grid-cols-3 gap-6 mb-12">
                    <div className="glass p-6 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                            <Server size={20} />
                        </div>
                        <h3 className="font-bold text-white mb-2">Docker Desktop</h3>
                        <p className="text-sm text-muted-foreground">Ensure Docker and Docker Compose are installed and running.</p>
                    </div>
                    <div className="glass p-6 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
                            <Monitor size={20} />
                        </div>
                        <h3 className="font-bold text-white mb-2">Domain Name</h3>
                        <p className="text-sm text-muted-foreground">You need a domain (e.g., mymedia.com) for secure remote access.</p>
                    </div>
                    <div className="glass p-6 rounded-xl border border-white/5">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 mb-4">
                            <CheckCircle size={20} />
                        </div>
                        <h3 className="font-bold text-white mb-2">Cloudflare</h3>
                        <p className="text-sm text-muted-foreground">A free Cloudflare account to manage your DNS and Tunnel.</p>
                    </div>
                </div>

                {/* Animated Terminal */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Terminal className="text-primary" />
                            Interactive Setup
                        </h2>
                        <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-muted-foreground">
                            v2.0.0
                        </span>
                    </div>
                    <AnimatedTerminal />
                </div>

                {/* Command Copy */}
                <div className="glass p-8 rounded-2xl border border-white/10 mb-12">
                    <h3 className="text-xl font-bold text-white mb-4">Run the Script</h3>
                    <p className="text-muted-foreground mb-6">
                        Open your terminal and run the following command to start the interactive setup wizard.
                    </p>

                    <div className="bg-black/50 rounded-xl p-4 font-mono text-sm flex items-center justify-between group relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <code className="relative z-10 text-green-400">
                            {os === 'unix' ? './setup.sh' : '.\\setup.ps1'}
                        </code>
                        <button
                            onClick={() => navigator.clipboard.writeText(os === 'unix' ? './setup.sh' : '.\\setup.ps1')}
                            className="relative z-10 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                            Copy
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
