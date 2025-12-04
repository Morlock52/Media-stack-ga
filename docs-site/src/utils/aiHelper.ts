import { SetupConfig } from '../store/setupStore'

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
        const prompt = `
        You are an expert DevOps engineer configuring a media stack.
        The user is setting up ${serviceId}.
        
        Current Global Config:
        - Domain: ${currentConfig.domain}
        - Timezone: ${currentConfig.timezone}
        - PUID/PGID: ${currentConfig.puid}/${currentConfig.pgid}
        
        User Context: ${userContext || 'None provided'}
        
        Please suggest optimal environment variables and configuration settings for ${serviceId}.
        Return ONLY a JSON object with the following structure:
        {
            "suggestion": "Brief explanation of the suggestion",
            "reasoning": "Why this is recommended",
            "config": {
                "KEY": "VALUE"
            }
        }
        `

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini', // Use a fast, capable model
                messages: [
                    { role: 'system', content: 'You are a helpful DevOps assistant.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                response_format: { type: "json_object" }
            })
        })

        if (!response.ok) {
            throw new Error(`OpenAI API Error: ${response.statusText}`)
        }

        const data = await response.json()
        const result = JSON.parse(data.choices[0].message.content)
        return result

    } catch (error) {
        console.error('AI Generation Failed:', error)
        return {
            suggestion: "Failed to generate suggestions. Please check your API key.",
            reasoning: error instanceof Error ? error.message : "Unknown error"
        }
    }
}
