const { chromium } = require('playwright');

async function testAgentManagementEnhanced() {
    console.log('🚀 Starting Enhanced Agent Management UI Test...');
    
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    try {
        // Navigate to the app
        console.log('📱 Navigating to http://localhost:6011...');
        await page.goto('http://localhost:6011', { waitUntil: 'networkidle' });
        
        // Wait for the app to load
        await page.waitForSelector('body', { timeout: 10000 });
        console.log('✅ App loaded successfully');
        
        // Take screenshot of initial state
        await page.screenshot({ path: 'enhanced-test-01-initial.png', fullPage: true });
        console.log('📸 Screenshot: enhanced-test-01-initial.png');
        
        // Look for various ways to access agent management
        const agentButtons = await page.locator('button:has-text("Agent"), button:has-text("Manager"), a[href*="agent"]').all();
        
        console.log(`Found ${agentButtons.length} potential agent management buttons`);
        
        // Check if we're already in the agent management view
        const agentManagementKeywords = ['Multi-Agent Dashboard', 'Agent Management', 'Create Agent', 'Agent List'];
        let foundAgentManagement = false;
        
        for (const keyword of agentManagementKeywords) {
            const element = await page.locator(`text=${keyword}`).first();
            if (await element.isVisible()) {
                console.log(`✅ Found "${keyword}" - Agent management is visible`);
                foundAgentManagement = true;
                break;
            }
        }
        
        if (!foundAgentManagement && agentButtons.length > 0) {
            console.log('🔄 Clicking agent management button...');
            await agentButtons[0].click();
            await page.waitForTimeout(2000);
            
            // Check again after navigation
            for (const keyword of agentManagementKeywords) {
                const element = await page.locator(`text=${keyword}`).first();
                if (await element.isVisible()) {
                    console.log(`✅ After navigation, found "${keyword}"`);
                    foundAgentManagement = true;
                    break;
                }
            }
        }
        
        // Take screenshot of agent view
        await page.screenshot({ path: 'enhanced-test-02-agent-view.png', fullPage: true });
        console.log('📸 Screenshot: enhanced-test-02-agent-view.png');
        
        // Look for ALL possible create buttons with various selectors
        const createButtonSelectors = [
            'button:has-text("Create Agent")',
            'button:has-text("Create")',
            'button:has-text("Add Agent")',
            'button:has-text("Add")',
            'button:has-text("New Agent")',
            'button:has-text("+")',
            '[data-testid*="create"]',
            '[data-testid*="add"]',
            '.create-agent',
            '#create-agent'
        ];
        
        let createButton = null;
        for (const selector of createButtonSelectors) {
            const button = await page.locator(selector).first();
            if (await button.isVisible()) {
                console.log(`✅ Found create button with selector: ${selector}`);
                createButton = button;
                break;
            }
        }
        
        if (createButton) {
            console.log('🎯 Testing Create Agent functionality...');
            await createButton.click();
            await page.waitForTimeout(2000);
            
            await page.screenshot({ path: 'enhanced-test-03-create-modal.png', fullPage: true });
            console.log('📸 Screenshot: enhanced-test-03-create-modal.png');
            
            // Look for modal or form elements
            const modalSelectors = [
                '[role="dialog"]',
                '.modal',
                '[data-testid*="modal"]',
                '[data-testid*="create"]',
                'form',
                '.agent-creator'
            ];
            
            let modalFound = false;
            for (const selector of modalSelectors) {
                const modal = await page.locator(selector).first();
                if (await modal.isVisible()) {
                    console.log(`✅ Found modal/form with selector: ${selector}`);
                    modalFound = true;
                    
                    // Look for form fields
                    const nameInput = await page.locator('input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]').first();
                    const typeSelect = await page.locator('select, [role="combobox"]').first();
                    const submitButton = await page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
                    
                    if (await nameInput.isVisible()) console.log('✅ Found name input field');
                    if (await typeSelect.isVisible()) console.log('✅ Found type selector');
                    if (await submitButton.isVisible()) console.log('✅ Found submit button');
                    
                    break;
                }
            }
            
            if (!modalFound) {
                console.log('❌ Create Agent modal/form not found');
            }
            
        } else {
            console.log('❌ No Create Agent button found');
            
            // Get all visible buttons for debugging
            const allButtons = await page.locator('button').allTextContents();
            console.log('All available buttons:', allButtons.filter(text => text.trim().length > 0));
        }
        
        // Check for agent list or overview
        const agentOverview = await page.locator('text=Agent Types, text=Total Agents, text=Active Agents').first();
        if (await agentOverview.isVisible()) {
            console.log('✅ Found agent overview/stats section');
        }
        
        // Check for real-time features
        const connectionStatus = await page.locator('text=Connected, text=Disconnected, text=Connection').first();
        if (await connectionStatus.isVisible()) {
            console.log('✅ Found connection status indicator');
        }
        
        // Final comprehensive screenshot
        await page.screenshot({ path: 'enhanced-test-04-final-state.png', fullPage: true });
        console.log('📸 Screenshot: enhanced-test-04-final-state.png');
        
        // Get page title and URL for confirmation
        const title = await page.title();
        const url = page.url();
        console.log(`📄 Page title: "${title}"`);
        console.log(`🔗 Current URL: ${url}`);
        
    } catch (error) {
        console.error('❌ Test failed with error:', error.message);
        await page.screenshot({ path: 'enhanced-test-error.png', fullPage: true });
        console.log('📸 Error screenshot: enhanced-test-error.png');
    }
    
    await browser.close();
    console.log('🎯 Enhanced test completed!');
    console.log('\n📋 SUMMARY:');
    console.log('- Check the screenshots to see the actual agent management interface');
    console.log('- The "coming soon" placeholder should be replaced with working functionality');
    console.log('- Look for agent creation, management, and real-time features');
}

testAgentManagementEnhanced().catch(console.error);