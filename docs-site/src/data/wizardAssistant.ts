interface WizardQuickAction {
  label: string
  prompt: string
}

interface WizardStepAssistantData {
  greeting: string
  personality: string
  quickActions: WizardQuickAction[]
  proactiveTips: string[]
}

export const wizardStepNames = [
  'Welcome',
  'Basic Config',
  'Stack Selection',
  'Service Config',
  'Advanced Settings',
  'Review & Download'
]

export const wizardStepAssistantData: Record<number, WizardStepAssistantData> = {
  0: {
    greeting: "👋 Hey there! I'm your setup assistant. Ready to build your media server?",
    personality: 'friendly and welcoming',
    quickActions: [
      { label: 'What is this?', prompt: 'What does this media stack do?' },
      { label: 'Do I need an API key?', prompt: 'Do I need to add an OpenAI API key?' },
      { label: 'How long will this take?', prompt: 'How long does the full setup take?' }
    ],
    proactiveTips: [
      'Adding an OpenAI API key unlocks smarter suggestions - but it’s totally optional!',
      'This wizard creates config files - you’ll run them on your server after.'
    ]
  },
  1: {
    greeting: '🌐 Let’s set up the basics. Don’t worry, I’ll explain everything!',
    personality: 'helpful teacher',
    quickActions: [
      { label: 'What domain should I use?', prompt: "What should I put for domain if I don't have one?" },
      { label: "What's PUID/PGID?", prompt: 'Explain PUID and PGID simply' },
      { label: 'Help with password', prompt: 'What makes a good password for this?' }
    ],
    proactiveTips: [
      "No domain yet? Use 'localhost' for now - you can change it later.",
      'PUID/PGID of 1000 works for most Linux systems. Leave them as-is!'
    ]
  },
  2: {
    greeting: '🎬 Time to pick your services! Let me help you choose.',
    personality: 'knowledgeable advisor',
    quickActions: [
      { label: "What's the Arr Stack?", prompt: 'What does the Arr Stack do?' },
      { label: 'Plex vs Jellyfin?', prompt: 'Should I choose Plex or Jellyfin?' },
      { label: 'Do I need VPN?', prompt: 'Do I really need the VPN service?' }
    ],
    proactiveTips: [
      'Newbie Mode is great for starting out - it picks the essentials for you.',
      'Plex has a polished app but needs a free account. Jellyfin is 100% free and open.'
    ]
  },
  3: {
    greeting: "⚙️ Most services work out of the box! Let me show you what's optional.",
    personality: 'reassuring guide',
    quickActions: [
      { label: 'What can I skip?', prompt: 'Which settings can I skip for now?' },
      { label: "What's ALLOWED_NETWORKS?", prompt: 'What should ALLOWED_NETWORKS be?' },
      { label: 'Where do API keys come from?', prompt: 'How do I get API keys for these services?' }
    ],
    proactiveTips: [
      'See a green checkmark? That service needs no config - it just works!',
      'API keys are created AFTER you run docker - the Post-Install guide will help.'
    ]
  },
  4: {
    greeting: '🔐 Advanced settings are optional. Skip what you don’t understand!',
    personality: 'patient mentor',
    quickActions: [
      { label: 'Skip VPN setup?', prompt: 'Can I skip VPN configuration for now?' },
      { label: 'Get Cloudflare token', prompt: 'How do I get a Cloudflare tunnel token?' },
      { label: "What's Plex Claim?", prompt: 'What is a Plex claim token and when do I need it?' }
    ],
    proactiveTips: [
      'Everything here can be added to your .env file later - don’t stress!',
      'Plex claim tokens expire in 4 minutes. Get it right before running docker.'
    ]
  },
  5: {
    greeting: '🎉 You made it! Download your files and follow the checklist below.',
    personality: 'celebratory coach',
    quickActions: [
      { label: "What's next?", prompt: 'What do I do after downloading the files?' },
      { label: 'Help with docker', prompt: 'How do I run docker compose?' },
      { label: 'Something went wrong', prompt: 'My containers are not starting, what should I check?' }
    ],
    proactiveTips: [
      'Download all files, put them in a folder on your server, then run docker compose up -d',
      'Follow the Post-Install Checklist below - it walks you through getting API keys!'
    ]
  }
}
