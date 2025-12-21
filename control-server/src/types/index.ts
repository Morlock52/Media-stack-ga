export interface Container {
    id: string;
    name: string;
    status: string;
    state: string;
    ports: string;
}

export interface ServiceIssue {
    type: 'stopped' | 'unhealthy' | 'restarting';
    service: string;
    message: string;
}

export interface Agent {
    id: string;
    name: string;
    icon: string;
    color: string;
    description: string;
    systemPrompt?: string;
}

export interface RemoteDeployRequest {
    host: string;
    port?: number;
    username: string;
    authType?: 'key' | 'password';
    privateKey?: string;
    password?: string;
    deployPath?: string;
    autoRemoveConflictingContainers?: boolean;
    autoDisableVpnOnTunMissing?: boolean;
    // Optional: allow the UI to send generated outputs directly (so the control server
    // doesn't need a writable bind-mount of the repo just to deploy).
    composeYml?: string;
    envFile?: string;
}

export interface AiChatRequest {
    message: string;
    agentId?: string;
    history?: any[]; // We can refine this later
    context?: any;
}

export interface AiChatResponse {
    answer: string;
    agent: {
        id: string;
        name: string;
        icon: string;
    };
    nudges: string[];
    aiPowered: boolean;
    toolUsed?: {
        command: string;
        type?: string;
    } | null;
}
