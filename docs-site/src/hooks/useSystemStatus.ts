// hooks/useSystemStatus.ts
import { useState, useEffect } from 'react';
import { buildControlServerUrl } from '../utils/controlServer';

export interface Container {
    id: string;
    name: string;
    status: string;
    state: 'running' | 'exited' | 'dead' | 'paused';
    ports: string;
}

const API_URL = buildControlServerUrl('/api');

export function useSystemStatus() {
    const [containers, setContainers] = useState<Container[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchStatus = async (): Promise<boolean> => {
        try {
            const res = await fetch(`${API_URL}/containers`);
            if (res.ok) {
                const data = await res.json();
                setContainers(data);
                setIsConnected(true);
                return true;
            } else {
                setIsConnected(false);
                return false;
            }
        } catch {
            setIsConnected(false);
            return false;
        } finally {
            setLoading(false);
        }
    };

    const controlService = async (serviceName: string, action: 'start' | 'stop' | 'restart' | 'up') => {
        try {
            const res = await fetch(`${API_URL}/service/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceName })
            });
            if (!res.ok) throw new Error('Failed to control service');
            
            // Refresh status after action
            setTimeout(fetchStatus, 1000);
            setTimeout(fetchStatus, 3000); // Check again later for slow starts
            return true;
        } catch (e) {
            console.error('useSystemStatus: service control failed:', e instanceof Error ? e.message : e);
            return false;
        }
    };

    useEffect(() => {
        const shouldPoll = Boolean(import.meta.env.DEV || import.meta.env.VITE_CONTROL_SERVER_URL);
        if (!shouldPoll) {
            setLoading(false);
            return;
        }

        let canceled = false;
        let delayMs = 3000;

        const loop = async () => {
            if (canceled) return;
            const connected = await fetchStatus();
            if (canceled) return;

            // Backoff: poll faster when connected, slower when offline.
            delayMs = connected ? 5000 : Math.min(delayMs * 2, 60000);
            setTimeout(loop, delayMs);
        };

        loop();
        return () => {
            canceled = true;
        };
    }, []);

    return {
        containers,
        isConnected,
        loading,
        controlService
    };
}
