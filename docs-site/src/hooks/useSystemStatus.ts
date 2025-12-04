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

    const fetchStatus = async () => {
        try {
            const res = await fetch(`${API_URL}/containers`);
            if (res.ok) {
                const data = await res.json();
                setContainers(data);
                setIsConnected(true);
            } else {
                setIsConnected(false);
            }
        } catch (err) {
            console.error('useSystemStatus: failed to fetch container status', err);
            setIsConnected(false);
            // console.error('Control server offline');
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
        fetchStatus();
        const interval = setInterval(fetchStatus, 3000); // Poll every 3s
        return () => clearInterval(interval);
    }, []);

    return {
        containers,
        isConnected,
        loading,
        controlService
    };
}
