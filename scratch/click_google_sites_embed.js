const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Find embed button
    const embedEl = Array.from(document.querySelectorAll("[aria-label='Embed'], [role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );

    if (embedEl) {
        embedEl.click();
        return "Clicked embed item";
    }
    return "Embed item not found";
})()
`;

fs.writeFileSync('scratch/click_embed.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_embed.js" as «class utf8»
tell application "Google Chrome"
    repeat with aWindow in every window
        repeat with aTab in every tab of aWindow
            if URL of aTab contains "sites.google.com" then
                set res to (execute aTab javascript jsContent)
                return res
            end if
        end repeat
    end repeat
    return "Tab not found"
end tell
`;

fs.writeFileSync('scratch/click_embed.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_embed.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
