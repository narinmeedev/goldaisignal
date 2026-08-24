const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const menuItems = Array.from(document.querySelectorAll("[role='menuitem']")).map(m => ({
        text: (m.innerText || "").trim(),
        aria: m.getAttribute("aria-label")
    }));

    // If View published site is in menu, click it
    const viewPubSite = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").toLowerCase().includes("view published site") || (m.innerText || "").includes("ดูไซต์ที่เผยแพร่")
    );

    // Or Publish settings
    const pubSettings = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").toLowerCase().includes("publish settings") || (m.innerText || "").includes("การตั้งค่าการเผยแพร่")
    );

    return JSON.stringify({
        menuItems: menuItems,
        hasViewPubSite: !!viewPubSite,
        hasPubSettings: !!pubSettings
    });
})()
`;

fs.writeFileSync('scratch/inspect_publish_menu.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_publish_menu.js" as «class utf8»
tell application "Google Chrome"
    repeat with aWindow in every window
        repeat with aTab in every tab of aWindow
            if URL of aTab contains "sites.google.com/d/1jGLfpwGuv8dekzAvqfVKeQZ1hbES2lvA" then
                set res to (execute aTab javascript jsContent)
                return res
            end if
        end repeat
    end repeat
    return "Tab not found"
end tell
`;

fs.writeFileSync('scratch/inspect_publish_menu.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_publish_menu.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
