import { SetupConfig } from '../store/setupStore'
import { buildControlServerUrl, controlServerAuthHeaders } from './controlServer'

interface AIResponse {
    suggestion: string
    reasoning: string
    config?: Record<string, string>
}

export async function generateServiceConfig(
    serviceId: string,
    currentConfig: SetupConfig,
    userContext?: string
): Promise<AIResponse> {
    try {
        const response = await fetch(buildControlServerUrl('/api/ai/service-config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...controlServerAuthHeaders() },
            body: JSON.stringify({
                serviceId,
                userContext,
                config: {
                    domain: currentConfig.domain,
                    timezone: currentConfig.timezone,
                    puid: currentConfig.puid,
                    pgid: currentConfig.pgid,
                },
            })
        })

        if (!response.ok) {
            const errorJson = await response.json().catch(() => null) as any
            const reason = typeof errorJson?.reason === 'string' ? errorJson.reason : undefined

            if (reason === 'missing_api_key') {
                return {
                    suggestion: 'AI features are disabled. Add an OpenAI API key in Settings to enable smart suggestions.',
                    reasoning: 'missing_api_key',
                }
            }
            if (response.status === 401) {
                return {
                    suggestion: 'Your OpenAI key looks invalid. Update it in Settings to enable AI suggestions.',
                    reasoning: 'invalid_api_key',
                }
            }
            if (response.status === 429) {
                return {
                    suggestion: 'OpenAI is rate limiting requests right now. Try again in a minute.',
                    reasoning: 'rate_limited',
                }
            }

            return {
                suggestion: 'AI request failed. Please try again.',
                reasoning: reason || `http_${response.status}`,
            }
        }

        return response.json()
    } catch (error) {
        console.error('AI Generation Failed:', error)
        return {
            suggestion: "Failed to generate suggestions. Make sure the control server is running and your OpenAI key is stored in Settings.",
            reasoning: error instanceof Error ? error.message : "Unknown error",
        }
    }
}
