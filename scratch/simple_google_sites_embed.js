const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_10_games.html', 'utf8');

const jsCode = `
(() => {
    // 1. Click embed item
    const embedEl = Array.from(document.querySelectorAll("[role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );
    if (!embedEl) return "No embed item";
    embedEl.click();

    return "Clicked embed item";
})()
`;

fs.writeFileSync('scratch/simple_click_embed.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/simple_click_embed.js" as «class utf8»
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

fs.writeFileSync('scratch/simple_click_embed.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/simple_click_embed.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
