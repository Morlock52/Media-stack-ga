import React, { useState } from 'react';
import { Download, Check, X } from 'lucide-react';

interface Service {
  id: string;
  name: string;
  category: string;
  port: number;
  enabled: boolean;
}

const initialServices: Service[] = [
  { id: 'plex', name: 'Plex', category: 'Media', port: 32400, enabled: true },
  { id: 'jellyfin', name: 'Jellyfin', category: 'Media', port: 8096, enabled: false },
  { id: 'sonarr', name: 'Sonarr', category: 'Automation', port: 8989, enabled: true },
  { id: 'radarr', name: 'Radarr', category: 'Automation', port: 7878, enabled: true },
  { id: 'prowlarr', name: 'Prowlarr', category: 'Automation', port: 9696, enabled: true },
  { id: 'qbittorrent', name: 'qBittorrent', category: 'Download', port: 8080, enabled: true },
  { id: 'authelia', name: 'Authelia', category: 'Security', port: 9091, enabled: true },
];

export const ConfigGenerator: React.FC = () => {
  const [services, setServices] = useState(initialServices);

  const toggleService = (id: string) => {
    setServices(services.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const generateConfig = () => {
    let yaml = `version: '3.8'\n\nservices:\n`;
    services.filter(s => s.enabled).forEach(s => {
      yaml += `  ${s.id}:\n    image: lscr.io/linuxserver/${s.id}:latest\n    container_name: ${s.id}\n    restart: unless-stopped\n    ports:\n      - ${s.port}:${s.port}\n\n`;
    });
    
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'docker-compose.yml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-6 bg-card rounded-lg border border-border shadow-sm">
      <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <Download className="w-6 h-6 text-blue-500" />
        Config Generator
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {services.map(service => (
          <div 
            key={service.id}
            onClick={() => toggleService(service.id)}
            className={`p-3 rounded-md border cursor-pointer transition-all flex items-center justify-between ${
              service.enabled 
                ? 'bg-primary/10 border-primary' 
                : 'bg-muted/50 border-border hover:border-primary/50'
            }`}
          >
            <span className="font-medium">{service.name}</span>
            {service.enabled ? <Check className="w-5 h-5 text-primary" /> : <X className="w-5 h-5 text-muted-foreground" />}
          </div>
        ))}
      </div>

      <button
        onClick={generateConfig}
        className="w-full py-3 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
      >
        <Download className="w-5 h-5" />
        Download docker-compose.yml
      </button>
    </div>
  );
};
