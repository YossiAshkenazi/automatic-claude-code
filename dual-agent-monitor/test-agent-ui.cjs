const { chromium } = require('playwright');

async function testAgentManagement() {
    console.log('🚀 Starting Agent Management UI Test...');
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Navigate to the app
        console.log('📱 Navigating to http://localhost:6011...');
        await page.goto('http://localhost:6011', { waitUntil: 'networkidle' });
        
        // Wait for the app to load
        await page.waitForSelector('[data-testid="app-header"], h1', { timeout: 10000 });
        console.log('✅ App loaded successfully');
        
        // Take a screenshot of the initial state
        await page.screenshot({ path: 'test-initial-state.png' });
        console.log('📸 Screenshot saved: test-initial-state.png');
        
        // Look for the Agents navigation item
        const agentNavigation = await page.locator('text=Agent', 'text=Agents', '[data-testid*="agent"]', 'button:has-text("Agents")', 'a:has-text("Agents")').first();
        
        if (await agentNavigation.isVisible()) {
            console.log('✅ Found agent management navigation');
            await agentNavigation.click();
            await page.waitForTimeout(1000);
            
            // Take screenshot after navigation
            await page.screenshot({ path: 'test-agents-view.png' });
            console.log('📸 Screenshot saved: test-agents-view.png');
            
            // Check for coming soon message
            const comingSoonText = await page.textContent('body').then(text => 
                text.includes('coming soon') || text.includes('Coming soon')
            );
            
            if (comingSoonText) {
                console.log('❌ FOUND "Coming soon" message - placeholder still exists!');
                
                // Look for the specific text
                const placeholderElement = await page.locator('text=Advanced agent configuration and monitoring capabilities are coming soon').first();
                if (await placeholderElement.isVisible()) {
                    console.log('❌ Found exact placeholder text that needs to be replaced');
                    await placeholderElement.screenshot({ path: 'test-placeholder-found.png' });
                }
            } else {
                console.log('✅ No "coming soon" message found');
                
                // Look for working agent management features
                const createAgentButton = await page.locator('button:has-text("Create Agent"), button:has-text("Create"), button:has-text("Add")').first();
                
                if (await createAgentButton.isVisible()) {
                    console.log('✅ Found Create Agent button - clicking to test...');
                    await createAgentButton.click();
                    await page.waitForTimeout(1000);
                    
                    // Take screenshot of modal/form
                    await page.screenshot({ path: 'test-create-agent-modal.png' });
                    console.log('📸 Screenshot saved: test-create-agent-modal.png');
                    
                    // Check if modal opened
                    const modal = await page.locator('[role="dialog"], .modal, [data-testid*="modal"]').first();
                    if (await modal.isVisible()) {
                        console.log('✅ Create Agent modal opened successfully!');
                        
                        // Look for form fields
                        const nameField = await page.locator('input[name="name"], input[placeholder*="name"]').first();
                        const typeSelect = await page.locator('select[name="type"], [data-testid*="type"]').first();
                        
                        if (await nameField.isVisible()) {
                            console.log('✅ Found name input field');
                        }
                        if (await typeSelect.isVisible()) {
                            console.log('✅ Found agent type selector');
                        }
                        
                    } else {
                        console.log('❌ Create Agent modal did not open');
                    }
                } else {
                    console.log('❌ No Create Agent button found');
                }
            }
            
        } else {
            console.log('❌ Could not find agent management navigation');
            
            // Try to find other navigation options
            const allButtons = await page.locator('button, a').allTextContents();
            console.log('Available navigation options:', allButtons);
        }
        
        // Final screenshot
        await page.screenshot({ path: 'test-final-state.png' });
        console.log('📸 Final screenshot saved: test-final-state.png');
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        await page.screenshot({ path: 'test-error-state.png' });
        console.log('📸 Error screenshot saved: test-error-state.png');
    }
    
    await browser.close();
    console.log('🎯 Test completed!');
}

testAgentManagement().catch(console.error);