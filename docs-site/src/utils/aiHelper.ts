import { SetupConfig } from '../store/setupStore'
import { buildControlServerUrl } from './controlServer'

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
    const apiKey = currentConfig.openaiApiKey

    if (!apiKey) {
        return {
            suggestion: "AI features are disabled. Please add an OpenAI API key to enable smart suggestions.",
            reasoning: "No API key provided."
        }
    }

    try {
        const response = await fetch(buildControlServerUrl('/api/ai/service-config'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                serviceId,
                userContext,
                config: {
                    domain: currentConfig.domain,
                    timezone: currentConfig.timezone,
                    puid: currentConfig.puid,
                    pgid: currentConfig.pgid,
                },
                openaiKey: apiKey,
            })
        })

        if (!response.ok) {
            if (response.status === 401) {
                return {
                    suggestion: 'Your OpenAI key looks invalid. Update it in Advanced settings to enable AI suggestions.',
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
                reasoning: `http_${response.status}`,
            }
        }

        return response.json()
    } catch (error) {
        console.error('AI Generation Failed:', error)
        return {
            suggestion: "Failed to generate suggestions. Please check your API key.",
            reasoning: error instanceof Error ? error.message : "Unknown error"
        }
    }
}
