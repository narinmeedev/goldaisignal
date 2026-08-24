const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Check all menu items
    const menuItems = Array.from(document.querySelectorAll("[role='menuitem']")).map(m => ({
        text: (m.innerText || "").trim(),
        aria: m.getAttribute("aria-label")
    }));

    // Try finding embed in right sidebar
    const embedEl = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
        (m.innerText || "").trim() === "Embed" || m.getAttribute("aria-label") === "Embed"
    );

    if (embedEl) {
        embedEl.click();
        return JSON.stringify({ clicked: true, menuItems: menuItems });
    }

    return JSON.stringify({ clicked: false, menuItems: menuItems });
})()
`;

fs.writeFileSync('scratch/find_embed.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/find_embed.js" as «class utf8»
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

fs.writeFileSync('scratch/find_embed.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/find_embed.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
