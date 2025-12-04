import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw } from 'lucide-react';

interface TerminalLine {
    text: string;
    color?: string;
    delay?: number;
    type?: 'command' | 'output' | 'input' | 'spinner';
}

const SCRIPT_SEQUENCE: TerminalLine[] = [
    { text: "chmod +x setup.sh && ./setup.sh", type: 'command', delay: 500 },
    { text: "📦 Installing 'gum' for a beautiful setup experience...", color: "text-cyan-400", delay: 800 },
    { text: "Media Stack Setup", color: "text-pink-500 font-bold border-2 border-pink-500 p-2 inline-block mb-2", delay: 1200 },
    { text: "Initial Configuration", color: "text-pink-500 font-bold mb-4", delay: 0 },
    { text: "🔍 Checking prerequisites...", color: "text-purple-400", delay: 500 },
    { text: "✅ Docker and Docker Compose are installed", color: "text-green-400", delay: 600 },
    { text: "📝 Configuration", color: "text-pink-500 font-bold mt-4", delay: 500 },
    { text: "? Domain Name", color: "text-cyan-400", delay: 400 },
    { text: "example.com", type: 'input', color: "text-white", delay: 1000 },
    { text: "? Timezone", color: "text-cyan-400", delay: 400 },
    { text: "Etc/UTC", type: 'input', color: "text-white", delay: 800 },
    { text: "? Master Password", color: "text-cyan-400", delay: 400 },
    { text: "************", type: 'input', color: "text-white", delay: 1200 },
    { text: "⚙️  Updating .env file...", type: 'spinner', color: "text-yellow-400", delay: 1500 },
    { text: "📂 Creating directory structure...", type: 'spinner', color: "text-yellow-400", delay: 1200 },
    { text: "📥 Pulling Docker images...", color: "text-purple-400", delay: 800 },
    { text: "Pulling authelia... done", color: "text-gray-400", delay: 200 },
    { text: "Pulling plex... done", color: "text-gray-400", delay: 200 },
    { text: "Pulling sonarr... done", color: "text-gray-400", delay: 200 },
    { text: "Setup Complete!", color: "text-pink-500 font-bold border-2 border-pink-500 p-2 inline-block mt-4", delay: 500 },
    { text: "🚀 Starting stack...", color: "text-green-400", delay: 500 },
    { text: "✅ Stack started! Check status with: docker-compose ps", color: "text-green-400", delay: 0 },
];

export const AnimatedTerminal: React.FC = () => {
    const [lines, setLines] = useState<TerminalLine[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [showCursor, setShowCursor] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    // Cursor blink effect
    useEffect(() => {
        const interval = setInterval(() => setShowCursor(prev => !prev), 500);
        return () => clearInterval(interval);
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [lines]);

    // Animation logic
    useEffect(() => {
        if (!isPlaying) return;

        if (currentIndex < SCRIPT_SEQUENCE.length) {
            const currentLine = SCRIPT_SEQUENCE[currentIndex];

            const timeout = setTimeout(() => {
                setLines(prev => [...prev, currentLine]);
                setCurrentIndex(prev => prev + 1);
            }, currentLine.delay || 300);

            return () => clearTimeout(timeout);
        } else {
            setIsPlaying(false);
        }
    }, [currentIndex, isPlaying]);

    const startAnimation = () => {
        setLines([]);
        setCurrentIndex(0);
        setIsPlaying(true);
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="rounded-xl overflow-hidden bg-[#1e1e1e] border border-white/10 shadow-2xl font-mono text-sm md:text-base relative group">
                {/* Terminal Header */}
                <div className="bg-[#2d2d2d] px-4 py-2 flex items-center gap-2 border-b border-white/5">
                    <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                    </div>
                    <div className="flex-1 text-center text-xs text-muted-foreground">user@mediastack:~/setup</div>
                </div>

                {/* Terminal Body */}
                <div
                    ref={containerRef}
                    className="p-6 min-h-[400px] max-h-[500px] overflow-y-auto scrollbar-hide scroll-smooth"
                >
                    {!isPlaying && lines.length === 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                            <button
                                onClick={startAnimation}
                                className="group/btn flex items-center gap-3 bg-primary hover:bg-primary/90 text-white px-8 py-4 rounded-full font-bold transition-all transform hover:scale-105 shadow-lg hover:shadow-primary/25"
                            >
                                <Play className="fill-current" /> Watch Install Demo
                            </button>
                        </div>
                    )}

                    {lines.map((line, index) => (
                        <div key={index} className={`mb-1 ${line.type === 'command' ? 'mt-4' : ''}`}>
                            {line.type === 'command' && (
                                <span className="text-green-400 mr-2">➜  ~</span>
                            )}
                            {line.type === 'input' && (
                                <span className="text-cyan-400 mr-2">›</span>
                            )}
                            <span className={`${line.color || 'text-gray-300'}`}>
                                {line.text}
                            </span>
                        </div>
                    ))}

                    {isPlaying && (
                        <div className="mt-1">
                            <span className="text-green-400 mr-2">➜  ~</span>
                            <span className={`inline-block w-2 h-4 bg-gray-400 align-middle ${showCursor ? 'opacity-100' : 'opacity-0'}`} />
                        </div>
                    )}
                </div>

                {/* Replay Button (visible when done) */}
                {!isPlaying && lines.length > 0 && (
                    <div className="absolute bottom-4 right-4">
                        <button
                            onClick={startAnimation}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors backdrop-blur-md"
                            title="Replay Animation"
                        >
                            <RotateCcw size={20} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
