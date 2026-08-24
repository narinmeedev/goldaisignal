const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const viewPubSite = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").toLowerCase().includes("view published site") || (m.innerText || "").includes("ดูไซต์ที่เผยแพร่")
    );

    if (viewPubSite) {
        viewPubSite.click();
        return "Clicked View published site";
    }
    return "Menu item not found";
})()
`;

fs.writeFileSync('scratch/click_view_published.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_view_published.js" as «class utf8»
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

fs.writeFileSync('scratch/click_view_published.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_view_published.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
