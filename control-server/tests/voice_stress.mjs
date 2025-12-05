
import { strict as assert } from 'assert';

const BASE_URL = 'http://localhost:3001';

// ANSI colors for output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m"
};

async function testVoiceAgentFlow(iteration) {
    console.log(`${colors.cyan}--- Starting Stress Test Iteration ${iteration} ---${colors.reset}`);

    let history = [];
    let planFound = false;

    // Simulating a conversation flow
    const inputs = [
        "Hi, I want to set up a media server.",
        "I want to use Plex and Sonarr.",
        "I have a Synology NAS.",
        "My domain is myflix.com.",
        "That's all for now."
    ];

    for (const transcript of inputs) {
        console.log(`${colors.yellow}User: ${transcript}${colors.reset}`);

        const startTime = Date.now();

        try {
            const res = await fetch(`${BASE_URL}/api/voice-agent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript, history })
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

            const data = await res.json();
            const duration = Date.now() - startTime;

            console.log(`${colors.green}AI (${duration}ms): ${data.agentResponse}${colors.reset}`);

            // 1. Check response length (Natural voice should be short)
            if (data.agentResponse.length > 300) {
                console.error(`${colors.red}[FAIL] Response too long for voice mode! (${data.agentResponse.length} chars)${colors.reset}`);
            }

            // 2. Check for leaked JSON in speech
            if (data.agentResponse.includes('{') || data.agentResponse.includes('}')) {
                console.error(`${colors.red}[FAIL] AI spoke JSON!${colors.reset}`);
            }

            // 3. Update history
            history.push({ role: 'user', content: transcript });
            history.push({ role: 'assistant', content: data.agentResponse });

            // 4. Check if plan was generated silently
            if (data.plan) {
                console.log(`${colors.green}[SUCCESS] Plan generated silently:${colors.reset}`, JSON.stringify(data.plan, null, 2));
                planFound = true;
            }

        } catch (error) {
            console.error(`${colors.red}[ERROR] Request failed: ${error.message}${colors.reset}`);
            return false;
        }

        // slight delay between turns
        await new Promise(r => setTimeout(r, 500));
    }

    return planFound;
}

async function runStressTest() {
    let successCount = 0;
    const NUM_ITERATIONS = 3; // Run full conversation 3 times

    for (let i = 1; i <= NUM_ITERATIONS; i++) {
        const passed = await testVoiceAgentFlow(i);
        if (passed) successCount++;
        console.log('\n');
    }

    console.log(`${colors.cyan}=== STRESS TEST SUMMARY ===${colors.reset}`);
    console.log(`Runs: ${NUM_ITERATIONS}`);
    console.log(`Successes: ${successCount}`);

    if (successCount === NUM_ITERATIONS) {
        console.log(`${colors.green}ALL TESTS PASSED ✅${colors.reset}`);
    } else {
        console.log(`${colors.red}SOME TESTS FAILED ❌${colors.reset}`);
        process.exit(1);
    }
}

runStressTest();
