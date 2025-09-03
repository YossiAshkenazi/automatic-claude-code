const http = require('http');

// Test function to verify UI is accessible
function testUI() {
    console.log('🧪 Testing Dual-Agent Monitor UI...\n');
    
    const tests = [
        {
            name: 'Server Health Check',
            path: '/health',
            expectedStatus: 200
        },
        {
            name: 'Main UI Page',
            path: '/',
            expectedStatus: 200,
            expectedContent: 'Dual-Agent Monitor - Enterprise Edition'
        },
        {
            name: 'Sessions API',
            path: '/sessions',
            expectedStatus: 200
        }
    ];
    
    let passed = 0;
    let total = tests.length;
    
    function runTest(test, callback) {
        const options = {
            hostname: 'localhost',
            port: 6003,
            path: test.path,
            method: 'GET'
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                const statusOK = res.statusCode === test.expectedStatus;
                const contentOK = !test.expectedContent || data.includes(test.expectedContent);
                const testPassed = statusOK && contentOK;
                
                if (testPassed) {
                    console.log(`✅ ${test.name}: PASSED`);
                    console.log(`   Status: ${res.statusCode}`);
                    if (test.expectedContent) {
                        console.log(`   Content: Found expected text`);
                    }
                    if (test.path === '/') {
                        console.log(`   HTML Size: ${data.length} bytes`);
                        console.log(`   Contains CSS: ${data.includes('<style>') ? 'Yes' : 'No'}`);
                        console.log(`   Contains JS: ${data.includes('<script>') ? 'Yes' : 'No'}`);
                    }
                    passed++;
                } else {
                    console.log(`❌ ${test.name}: FAILED`);
                    console.log(`   Expected Status: ${test.expectedStatus}, Got: ${res.statusCode}`);
                    if (test.expectedContent && !contentOK) {
                        console.log(`   Expected content not found: "${test.expectedContent}"`);
                    }
                }
                console.log('');
                
                callback();
            });
        });
        
        req.on('error', (err) => {
            console.log(`❌ ${test.name}: FAILED`);
            console.log(`   Error: ${err.message}`);
            console.log('');
            callback();
        });
        
        req.end();
    }
    
    function runNextTest(index) {
        if (index >= tests.length) {
            console.log(`\n📊 Test Results: ${passed}/${total} tests passed`);
            if (passed === total) {
                console.log('🎉 All tests PASSED! UI is working correctly.');
                console.log('\n🌐 Access the UI at: http://localhost:6003');
            } else {
                console.log('⚠️  Some tests failed. Check server status.');
            }
            return;
        }
        
        runTest(tests[index], () => {
            runNextTest(index + 1);
        });
    }
    
    runNextTest(0);
}

// Test WebSocket connection
function testWebSocket() {
    console.log('\n🔗 Testing WebSocket Connection...');
    
    try {
        const net = require('net');
        const socket = new net.Socket();
        
        socket.connect(6003, 'localhost', () => {
            console.log('✅ WebSocket Port: Accessible');
            socket.destroy();
        });
        
        socket.on('error', (err) => {
            console.log('❌ WebSocket Port: Not accessible');
            console.log(`   Error: ${err.message}`);
        });
        
    } catch (error) {
        console.log('❌ WebSocket Test: Failed');
        console.log(`   Error: ${error.message}`);
    }
}

// Run the tests
console.log('🚀 Dual-Agent Monitor UI Test Suite');
console.log('=====================================\n');

testUI();

setTimeout(() => {
    testWebSocket();
}, 2000);