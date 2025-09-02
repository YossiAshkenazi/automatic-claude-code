// Direct SDK Test - Bypass our wrapper entirely
// This will help diagnose if the issue is in our code or the Claude SDK itself

const path = require('path');
const os = require('os');

console.log('🔍 SDK Debug Test - Testing Claude SDK directly');
console.log('==============================================');

// Try to find and load the SDK directly
async function testSDKDirectly() {
    try {
        console.log('\n1. Looking for Claude SDK...');
        
        // Try the same path resolution logic as our code
        const userHome = process.env.USERPROFILE || process.env.HOME || os.homedir();
        const possiblePaths = [
            path.join(userHome, 'AppData', 'Roaming', 'npm', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
            path.join(userHome, '.npm-global', 'node_modules', '@anthropic-ai', 'claude-code', 'sdk.mjs'),
        ];
        
        let sdkPath = null;
        const fs = require('fs');
        
        for (const testPath of possiblePaths) {
            if (fs.existsSync(testPath)) {
                sdkPath = testPath;
                console.log(`   ✅ Found SDK at: ${sdkPath}`);
                break;
            }
        }
        
        if (!sdkPath) {
            console.log('   ❌ SDK not found in standard locations');
            return;
        }
        
        console.log('\n2. Loading Claude SDK...');
        // Convert Windows path to file:// URL
        const sdkUrl = `file:///${sdkPath.replace(/\\/g, '/')}`;
        console.log(`   🔄 Loading from: ${sdkUrl}`);
        const claudeSDK = await import(sdkUrl);
        console.log('   ✅ SDK loaded successfully');
        console.log('   ✅ Available methods:', Object.keys(claudeSDK));
        
        console.log('\n3. Testing SDK query function...');
        const queryFunction = claudeSDK.query || claudeSDK.default?.query;
        
        if (!queryFunction) {
            console.log('   ❌ No query function found in SDK');
            return;
        }
        
        console.log('   ✅ Query function found');
        console.log('   🔄 Calling SDK with simple prompt...');
        
        // Set a timeout for the SDK call
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('SDK call timed out after 10 seconds')), 10000);
        });
        
        const sdkCall = async () => {
            const messages = queryFunction({
                prompt: 'Just respond with "Hello from Claude SDK"',
                options: {
                    maxTurns: 1,
                    model: 'sonnet',
                    dangerouslySkipPermissions: true
                }
            });
            
            console.log('   📡 SDK call initiated, waiting for messages...');
            
            for await (const message of messages) {
                console.log(`   📨 Message type: ${message.type}`);
                
                if (message.type === 'assistant') {
                    console.log(`   💬 Assistant: ${message.content?.substring(0, 100)}...`);
                }
                
                if (message.type === 'result') {
                    console.log('   ✅ Result received!');
                    return message;
                }
                
                if (message.type === 'error') {
                    console.log('   ❌ Error from SDK:', message);
                    return message;
                }
            }
        };
        
        const result = await Promise.race([sdkCall(), timeoutPromise]);
        console.log('\n4. SDK Test Results:');
        console.log('   ✅ SUCCESS: SDK responded within timeout');
        console.log('   📊 This means the issue is likely in our wrapper code');
        
    } catch (error) {
        console.log('\n4. SDK Test Results:');
        console.log('   ❌ FAILED:', error.message);
        
        if (error.message.includes('timeout')) {
            console.log('   🔍 DIAGNOSIS: Claude SDK is hanging on query');
            console.log('   💡 Possible causes:');
            console.log('      - Authentication issue with Claude');
            console.log('      - Network connectivity problem');
            console.log('      - Claude API is down');
            console.log('      - API rate limits exceeded');
        } else if (error.message.includes('authentication') || error.message.includes('401')) {
            console.log('   🔍 DIAGNOSIS: Authentication problem');
            console.log('   💡 Try: claude logout && claude login');
        } else {
            console.log('   🔍 DIAGNOSIS: SDK loading or execution error');
            console.log('   💡 Error details:', error);
        }
    }
}

// Run the test
testSDKDirectly().then(() => {
    console.log('\n==============================================');
    console.log('SDK Debug Test Complete');
}).catch(err => {
    console.error('Test crashed:', err);
});