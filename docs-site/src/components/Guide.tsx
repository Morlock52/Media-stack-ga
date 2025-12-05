import React, { useState, useEffect } from 'react';
import { GuideSection } from './GuideSection';
import { BookOpen, Monitor, Film, Download, Shield } from 'lucide-react';

export const Guide: React.FC = () => {
    const [activeSection, setActiveSection] = useState('getting-started');

    const scrollToSection = (id: string) => {
        const element = document.getElementById(id);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setActiveSection(id);
        }
    };

    // Update active section on scroll
    useEffect(() => {
        const handleScroll = () => {
            const sections = ['getting-started', 'dashboard', 'requesting-media', 'downloads', 'security'];
            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    if (rect.top >= 0 && rect.top <= 300) {
                        setActiveSection(section);
                        break;
                    }
                }
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <div className="container mx-auto px-4 py-12 flex flex-col lg:flex-row gap-12">
            {/* Sidebar Navigation */}
            <aside className="lg:w-64 flex-shrink-0">
                <div className="sticky top-24 space-y-2 p-4 rounded-xl glass border border-white/5">
                    <h4 className="font-bold text-white mb-4 px-2">Table of Contents</h4>
                    <button
                        onClick={() => scrollToSection('getting-started')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeSection === 'getting-started' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                    >
                        <BookOpen size={16} /> Getting Started
                    </button>
                    <button
                        onClick={() => scrollToSection('dashboard')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeSection === 'dashboard' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                    >
                        <Monitor size={16} /> The Dashboard
                    </button>
                    <button
                        onClick={() => scrollToSection('requesting-media')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeSection === 'requesting-media' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                    >
                        <Film size={16} /> Requesting Media
                    </button>
                    <button
                        onClick={() => scrollToSection('downloads')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeSection === 'downloads' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                    >
                        <Download size={16} /> Downloads
                    </button>
                    <button
                        onClick={() => scrollToSection('security')}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${activeSection === 'security' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-white hover:bg-white/5'}`}
                    >
                        <Shield size={16} /> Security
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <div className="mb-12">
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">How to Use Your <span className="text-gradient-primary">Media Stack</span></h1>
                    <p className="text-xl text-muted-foreground">
                        A comprehensive guide to managing your personal media server, from requesting new movies to monitoring downloads.
                    </p>
                </div>

                <GuideSection id="getting-started" title="Getting Started">
                    <p>
                        Welcome to your new media stack! Once the installation is complete, you have a powerful suite of applications running in Docker containers.
                        Everything is designed to work together seamlessly, automated by the *arr suite (Sonarr, Radarr, etc.) and accessible via a unified dashboard.
                    </p>
                    <p>
                        <strong>Key Concepts:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-2">
                        <li><strong>Automation:</strong> You don't download files manually. You "request" them, and the system handles the rest.</li>
                        <li><strong>Centralization:</strong> All services are linked. Adding a movie in Overseerr triggers Radarr, which triggers Prowlarr, which triggers qBittorrent.</li>
                        <li><strong>Security:</strong> Access is protected by Authelia SSO. You only need to log in once.</li>
                    </ul>
                </GuideSection>

                <GuideSection
                    id="dashboard"
                    title="The Dashboard (Homepage)"
                    imageSrc="/images/dashboard_mockup.webp"
                    imageAlt="Homepage Dashboard Interface"
                    reverse
                >
                    <p>
                        Your journey begins at the <strong>Homepage</strong>. This is your command center, accessible at <code>hub.yourdomain.com</code> (or <code>localhost:3000</code>).
                    </p>
                    <p>
                        The dashboard automatically discovers your running services and displays them as interactive cards. You can see real-time stats like:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-2">
                        <li>Recent media added to Plex/Jellyfin</li>
                        <li>Active downloads in qBittorrent</li>
                        <li>System resource usage (CPU/RAM)</li>
                        <li>Upcoming TV episodes</li>
                    </ul>
                    <p>
                        Clicking any card will take you directly to that application, authenticated automatically via Authelia.
                    </p>
                </GuideSection>

                <GuideSection
                    id="requesting-media"
                    title="Requesting Media (Overseerr)"
                    imageSrc="/images/request_ui_mockup.webp"
                    imageAlt="Overseerr Request Interface"
                >
                    <p>
                        <strong>Overseerr</strong> is the best way to find and add content. Instead of managing Sonarr and Radarr directly, you use this beautiful interface to "shop" for media.
                    </p>
                    <p>
                        <strong>How to request a movie or show:</strong>
                    </p>
                    <ol className="list-decimal list-inside space-y-2 ml-2">
                        <li>Open Overseerr from the dashboard.</li>
                        <li>Type the name of a movie or show in the search bar.</li>
                        <li>Click on the result to see details (trailer, cast, rating).</li>
                        <li>Click the <strong>Request</strong> button.</li>
                        <li>Select your quality profile (e.g., 1080p, 4K) and click <strong>Submit Request</strong>.</li>
                    </ol>
                    <p>
                        That's it! The system will automatically search for the content, download it, and notify you when it's ready to watch.
                    </p>
                </GuideSection>

                <GuideSection
                    id="downloads"
                    title="Monitoring Downloads"
                    imageSrc="/images/download_client_mockup.webp"
                    imageAlt="qBittorrent Download Interface"
                    reverse
                >
                    <p>
                        While the system is fully automated, you might sometimes want to check the status of a download. <strong>qBittorrent</strong> is the engine room of your stack.
                    </p>
                    <p>
                        <strong>Key Features:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-2">
                        <li><strong>VPN Protection:</strong> All traffic is routed through Gluetun. If the VPN drops, downloads stop instantly (Kill Switch).</li>
                        <li><strong>Categories:</strong> Downloads are automatically tagged (tv-sonarr, radarr, etc.) for organized file management.</li>
                        <li><strong>Speed Limits:</strong> You can set global or per-torrent speed limits if you need bandwidth for other tasks.</li>
                    </ul>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mt-4">
                        <p className="text-yellow-200 text-sm">
                            <strong>Note:</strong> You rarely need to touch qBittorrent. Sonarr and Radarr will automatically remove downloads from the list once they are imported to your library.
                        </p>
                    </div>
                </GuideSection>

                <GuideSection
                    id="security"
                    title="Security & Authentication"
                >
                    <p>
                        Your stack is exposed to the internet securely using <strong>Cloudflare Tunnel</strong> and protected by <strong>Authelia</strong>.
                    </p>
                    <p>
                        <strong>Security Layers:</strong>
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-2">
                        <li><strong>No Open Ports:</strong> You don't need to open port 80 or 443 on your router. Cloudflare handles the connection.</li>
                        <li><strong>Single Sign-On (SSO):</strong> Log in once with your master password, and you have access to all apps.</li>
                        <li><strong>Two-Factor Authentication (2FA):</strong> For extra security, enable 2FA in Authelia to require a code from your phone.</li>
                    </ul>
                </GuideSection>
            </div>
        </div>
    );
};
