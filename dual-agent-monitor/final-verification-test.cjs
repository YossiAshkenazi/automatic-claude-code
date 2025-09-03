const { chromium } = require('playwright');

async function verifyAgentManagementComplete() {
    console.log('🎯 FINAL VERIFICATION: Agent Management Interface');
    console.log('====================================================');
    
    const browser = await chromium.launch({ 
        headless: false, 
        slowMo: 1000 // Slow down for better visibility
    });
    const page = await browser.newPage();
    
    // Set larger viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    try {
        console.log('📱 Loading application at http://localhost:6011...');
        await page.goto('http://localhost:6011', { waitUntil: 'networkidle', timeout: 30000 });
        
        console.log('✅ Application loaded successfully');
        await page.screenshot({ path: 'verification-01-app-loaded.png', fullPage: true });
        
        // Check for agent management navigation
        console.log('🔍 Looking for agent management navigation...');
        
        // Try multiple navigation methods
        const navigationAttempts = [
            async () => {
                const agentBtn = page.locator('text=Manager Agents').first();
                if (await agentBtn.isVisible()) {
                    await agentBtn.click();
                    return 'Manager Agents button';
                }
                return null;
            },
            async () => {
                const agentBtn = page.locator('button:has-text("Agents")').first();
                if (await agentBtn.isVisible()) {
                    await agentBtn.click();
                    return 'Agents button';
                }
                return null;
            },
            async () => {
                const agentBtn = page.locator('text=Agent Management').first();
                if (await agentBtn.isVisible()) {
                    await agentBtn.click();
                    return 'Agent Management text';
                }
                return null;
            }
        ];
        
        let navigationSuccess = null;
        for (const attempt of navigationAttempts) {
            const result = await attempt();
            if (result) {
                navigationSuccess = result;
                break;
            }
        }
        
        if (navigationSuccess) {
            console.log(`✅ Successfully navigated using: ${navigationSuccess}`);
            await page.waitForTimeout(2000);
        } else {
            console.log('⚠️ Could not find agent management navigation, checking current page...');
        }
        
        await page.screenshot({ path: 'verification-02-agent-view.png', fullPage: true });
        
        // Comprehensive check for agent management features
        console.log('🔍 Checking for agent management features...');
        
        const features = {
            'Multi-Agent Dashboard': await page.locator('text=Multi-Agent Dashboard').isVisible(),
            'Agent Management Header': await page.locator('text=Agent Management').isVisible(),
            'Create Agent Button': await page.locator('button:has-text("Create Agent")').isVisible(),
            'Agent Overview': await page.locator('text=Total Agents').isVisible(),
            'Agent Types': await page.locator('text=Agent Types').isVisible(),
            'Active Tasks': await page.locator('text=Active Tasks').isVisible(),
            'Recent Events': await page.locator('text=Recent Events').isVisible(),
            'Overview Tab': await page.locator('button:has-text("Overview")').isVisible(),
            'Agents Tab': await page.locator('button:has-text("Agents")').isVisible(),
            'Communications Tab': await page.locator('button:has-text("Communications")').isVisible(),
            'Connection Status': await page.locator('text=Connected, text=Disconnected, text=Connection').first().isVisible()
        };
        
        console.log('\n📊 FEATURE VERIFICATION RESULTS:');
        for (const [feature, visible] of Object.entries(features)) {
            const status = visible ? '✅' : '❌';
            console.log(`${status} ${feature}: ${visible ? 'VISIBLE' : 'NOT FOUND'}`);
        }
        
        // Check for placeholder text (should not be there)
        const placeholderTexts = [
            'coming soon',
            'Coming soon',
            'Advanced agent configuration and monitoring capabilities are coming soon'
        ];
        
        console.log('\n🚫 PLACEHOLDER CHECK (should all be FALSE):');
        for (const text of placeholderTexts) {
            const found = await page.locator(`text=${text}`).isVisible();
            const status = found ? '❌ FOUND (BAD)' : '✅ NOT FOUND (GOOD)';
            console.log(`${status} "${text}"`);
        }
        
        // Test Create Agent functionality if button is found
        const createAgentBtn = page.locator('button:has-text("Create Agent")').first();
        if (await createAgentBtn.isVisible()) {
            console.log('\n🎯 Testing Create Agent functionality...');
            await createAgentBtn.click();
            await page.waitForTimeout(2000);
            
            await page.screenshot({ path: 'verification-03-create-agent.png', fullPage: true });
            
            const modalVisible = await page.locator('[role="dialog"], .modal').first().isVisible();
            console.log(`✅ Create Agent Modal: ${modalVisible ? 'OPENED' : 'NOT OPENED'}`);
            
            if (modalVisible) {
                const formFields = {
                    'Name Input': await page.locator('input[name="name"], input[placeholder*="name"]').first().isVisible(),
                    'Type Selector': await page.locator('select, [role="combobox"]').first().isVisible(),
                    'Save/Create Button': await page.locator('button[type="submit"], button:has-text("Create")').first().isVisible()
                };
                
                console.log('\n📝 MODAL FORM FIELDS:');
                for (const [field, visible] of Object.entries(formFields)) {
                    const status = visible ? '✅' : '❌';
                    console.log(`${status} ${field}: ${visible ? 'FOUND' : 'NOT FOUND'}`);
                }
            }
        } else {
            console.log('\n⚠️ Create Agent button not visible, checking if it\'s in a different tab...');
            
            // Try clicking on Agents tab
            const agentsTab = page.locator('button:has-text("Agents")').first();
            if (await agentsTab.isVisible()) {
                await agentsTab.click();
                await page.waitForTimeout(1000);
                
                const createBtnInTab = await page.locator('button:has-text("Create Agent")').first().isVisible();
                console.log(`Create Agent in Agents tab: ${createBtnInTab ? '✅ FOUND' : '❌ NOT FOUND'}`);
                
                await page.screenshot({ path: 'verification-04-agents-tab.png', fullPage: true });
            }
        }
        
        // Get current page info
        const title = await page.title();
        const url = page.url();
        const bodyText = await page.textContent('body');
        const hasAgentManagement = bodyText.includes('Multi-Agent') || bodyText.includes('Agent Management') || bodyText.includes('Create Agent');
        
        console.log('\n📄 PAGE INFORMATION:');
        console.log(`Title: "${title}"`);
        console.log(`URL: ${url}`);
        console.log(`Has Agent Management Content: ${hasAgentManagement ? '✅ YES' : '❌ NO'}`);
        
        // Final screenshot
        await page.screenshot({ path: 'verification-05-final.png', fullPage: true });
        
        console.log('\n🎯 FINAL VERIFICATION COMPLETE!');
        console.log('====================================');
        
        const successCount = Object.values(features).filter(Boolean).length;
        const totalFeatures = Object.keys(features).length;
        
        console.log(`📊 FEATURES WORKING: ${successCount}/${totalFeatures} (${Math.round(successCount/totalFeatures*100)}%)`);
        
        if (successCount >= totalFeatures * 0.7) {
            console.log('🎉 SUCCESS: Agent management interface is working!');
        } else {
            console.log('⚠️ PARTIAL: Some features may need attention');
        }
        
    } catch (error) {
        console.error('❌ VERIFICATION FAILED:', error.message);
        await page.screenshot({ path: 'verification-error.png', fullPage: true });
    }
    
    // Keep browser open for 10 seconds for manual inspection
    console.log('\n👀 Browser will remain open for 10 seconds for manual inspection...');
    await page.waitForTimeout(10000);
    
    await browser.close();
}

verifyAgentManagementComplete().catch(console.error);