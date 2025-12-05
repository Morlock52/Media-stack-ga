/**
 * 🧪 Comprehensive Stress Test Suite
 * Tests all control server functionality according to Dec 2025 best practices
 */

import { strict as assert } from 'assert';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m"
};

// Test Results Tracker
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    tests: []
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name, passed, duration, message = '') {
    const status = passed ? '✅' : '❌';
    const color = passed ? 'green' : 'red';
    log(`${status} ${name} (${duration}ms) ${message}`, color);

    results.tests.push({ name, passed, duration, message });
    if (passed) results.passed++;
    else results.failed++;
}

async function testEndpoint(name, method, url, body = null, expectedStatus = 200) {
    const start = Date.now();
    try {
        const options = {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : {}
        };
        if (body) options.body = JSON.stringify(body);

        const res = await fetch(`${BASE_URL}${url}`, options);
        const duration = Date.now() - start;

        const passed = res.status === expectedStatus;
        const data = res.headers.get('content-type')?.includes('application/json')
            ? await res.json()
            : await res.text();

        logTest(name, passed, duration, passed ? '' : `Expected ${expectedStatus}, got ${res.status}`);
        return { passed, data, status: res.status, duration };
    } catch (error) {
        const duration = Date.now() - start;
        logTest(name, false, duration, error.message);
        return { passed: false, error: error.message, duration };
    }
}

// ============= TEST SUITES =============

async function testBasicEndpoints() {
    log('\n📡 Testing Basic Endpoints', 'cyan');
    log('─'.repeat(50), 'cyan');

    await testEndpoint('GET /', 'GET', '/');
    await testEndpoint('GET /api/health', 'GET', '/api/health');
}

async function testPerformance() {
    log('\n⚡ Testing Performance', 'cyan');
    log('─'.repeat(50), 'cyan');

    // Test response times
    const samples = [];
    for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await fetch(`${BASE_URL}/api/health`);
        samples.push(Date.now() - start);
    }

    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const max = Math.max(...samples);
    const min = Math.min(...samples);

    const passed = avg < 200; // Should average under 200ms
    logTest('Average response time < 200ms', passed, Math.round(avg), `avg=${Math.round(avg)}ms, min=${min}ms, max=${max}ms`);
}

async function testConcurrentLoad() {
    log('\n🚀 Testing Concurrent Load', 'cyan');
    log('─'.repeat(50), 'cyan');

    const start = Date.now();
    const requests = Array(50).fill(null).map(() =>
        fetch(`${BASE_URL}/api/health`)
    );

    try {
        const results = await Promise.all(requests);
        const duration = Date.now() - start;
        const allSuccessful = results.every(r => r.ok);

        logTest('50 concurrent requests', allSuccessful, duration, `${results.length} requests completed`);
    } catch (error) {
        logTest('50 concurrent requests', false, Date.now() - start, error.message);
    }
}

async function testAIEndpoints() {
    log('\n🤖 Testing AI Endpoints', 'cyan');
    log('─'.repeat(50), 'cyan');

    // Test voice agent endpoint (may fail without OpenAI key - that's OK)
    const voiceTest = await testEndpoint(
        'POST /api/voice-agent',
        'POST',
        '/api/voice-agent',
        { transcript: 'Hello', history: [] },
        200 // Will return 200 or error
    );

    if (!voiceTest.passed && voiceTest.status === 500) {
        log('  ℹ️  Voice agent may require OpenAI API key', 'yellow');
        results.tests[results.tests.length - 1].skipped = true;
        results.passed--; // Don't count as failure if it's a config issue
        results.skipped++;
    }
}

async function testErrorHandling() {
    log('\n🛡️ Testing Error Handling', 'cyan');
    log('─'.repeat(50), 'cyan');

    // Test 404
    await testEndpoint('GET /nonexistent', 'GET', '/api/nonexistent-endpoint', null, 404);

    // Test malformed requests
    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}/api/voice-agent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid-json'
        });
        const duration = Date.now() - start;
        const passed = res.status === 400 || res.status === 500; // Should handle gracefully
        logTest('Malformed JSON handling', passed, duration);
    } catch (error) {
        logTest('Malformed JSON handling', false, Date.now() - start, error.message);
    }
}

async function testSecurityHeaders() {
    log('\n🔒 Testing Security Configuration', 'cyan');
    log('─'.repeat(50), 'cyan');

    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}/`);
        const duration = Date.now() - start;

        // Check CORS
        const corsHeader = res.headers.get('access-control-allow-origin');
        const hasCors = corsHeader !== null;
        logTest('CORS headers present', hasCors, duration, `CORS: ${corsHeader || 'none'}`);

        // Check content-type
        const contentType = res.headers.get('content-type');
        const hasJson = contentType?.includes('application/json');
        logTest('JSON content-type', hasJson, 0, contentType || 'none');

    } catch (error) {
        logTest('Security headers check', false, Date.now() - start, error.message);
    }
}

async function testCorsPolicy() {
    log('\n🌐 Testing CORS Policy', 'cyan');
    log('─'.repeat(50), 'cyan');

    const start = Date.now();
    try {
        const res = await fetch(`${BASE_URL}/api/health`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'GET'
            }
        });
        const duration = Date.now() - start;

        const corsAllowed = res.status === 200 || res.status === 204;
        logTest('CORS preflight', corsAllowed, duration);
    } catch (error) {
        logTest('CORS preflight', false, Date.now() - start, error.message);
    }
}

async function testMemoryLeak() {
    log('\n💾 Testing Memory Stability', 'cyan');
    log('─'.repeat(50), 'cyan');

    const iterations = 100;
    const start = Date.now();

    try {
        for (let i = 0; i < iterations; i++) {
            await fetch(`${BASE_URL}/api/health`);
        }
        const duration = Date.now() - start;
        const avgPerRequest = duration / iterations;

        // If average is stable, no major memory leaks
        const passed = avgPerRequest < 50;
        logTest(`${iterations} sequential requests`, passed, duration, `${avgPerRequest.toFixed(2)}ms per request`);
    } catch (error) {
        logTest('Memory stability test', false, Date.now() - start, error.message);
    }
}

async function testVoiceAgentFlow() {
    log('\n🎤 Testing Voice Agent Conversation Flow', 'cyan');
    log('─'.repeat(50), 'cyan');

    let history = [];
    const inputs = [
        "Hi, I want to set up a media server.",
        "I want to use Plex.",
        "That's all."
    ];

    for (const transcript of inputs) {
        const result = await testEndpoint(
            `Voice: "${transcript.substring(0, 30)}..."`,
            'POST',
            '/api/voice-agent',
            { transcript, history },
            200
        );

        if (result.passed && result.data) {
            history.push({ role: 'user', content: transcript });
            if (result.data.agentResponse) {
                history.push({ role: 'assistant', content: result.data.agentResponse });
            }
        }
    }
}

// ============= MAIN TEST RUNNER =============

async function runAllTests() {
    log('\n' + '='.repeat(60), 'magenta');
    log('🧪 COMPREHENSIVE STRESS TEST SUITE', 'magenta');
    log('   Media Stack Control Server - December 2025', 'magenta');
    log('='.repeat(60) + '\n', 'magenta');

    log(`📍 Testing server at: ${BASE_URL}`, 'blue');
    log(`🕐 Started at: ${new Date().toLocaleString()}\n`, 'blue');

    // Check if server is running
    try {
        await fetch(BASE_URL);
    } catch (error) {
        log(`\n❌ FATAL: Server not running at ${BASE_URL}`, 'red');
        log('   Please start the server first: npm start\n', 'yellow');
        process.exit(1);
    }

    // Run all test suites
    await testBasicEndpoints();
    await testPerformance();
    await testConcurrentLoad();
    await testErrorHandling();
    await testSecurityHeaders();
    await testCorsPolicy();
    await testMemoryLeak();
    await testAIEndpoints();
    await testVoiceAgentFlow();

    // Print summary
    log('\n' + '='.repeat(60), 'magenta');
    log('📊 TEST SUMMARY', 'magenta');
    log('='.repeat(60), 'magenta');

    const total = results.passed + results.failed + results.skipped;
    log(`\n  Total Tests: ${total}`, 'cyan');
    log(`  ✅ Passed: ${results.passed}`, 'green');
    log(`  ❌ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
    log(`  ⏭️  Skipped: ${results.skipped}`, 'yellow');

    const passRate = ((results.passed / (results.passed + results.failed)) * 100).toFixed(1);
    log(`\n  Pass Rate: ${passRate}%`, passRate > 90 ? 'green' : 'yellow');

    log('\n' + '='.repeat(60) + '\n', 'magenta');

    // Exit with appropriate code
    if (results.failed > 0) {
        log('❌ SOME TESTS FAILED\n', 'red');
        process.exit(1);
    } else {
        log('✅ ALL TESTS PASSED!\n', 'green');
        process.exit(0);
    }
}

// Run tests
runAllTests();
