const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_10_games.html', 'utf8');

const jsCode = `
(() => {
    // Check if there is an existing embed tile to edit
    const embedTile = document.querySelector("tile[aria-label*='Embed'], tile[aria-label*='Custom Embed'], .atari-embed-container, iframe[src*='atari/embeds']");
    
    // If we click embedTile or select it
    if (embedTile) {
        embedTile.click();
    }

    // Check for edit button (pencil) or click Embed again
    const editBtn = document.querySelector("[aria-label='Edit code'], [data-tooltip='Edit code'], [aria-label*='Edit']");
    if (editBtn) {
        editBtn.click();
        return "Clicked edit code button";
    }

    // Otherwise click Embed menu
    const embedEl = Array.from(document.querySelectorAll("[aria-label='Embed'], [role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );
    if (embedEl) {
        embedEl.click();
        return "Clicked Embed button";
    }

    return "Embed button not found";
})()
`;

fs.writeFileSync('scratch/edit_or_embed.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/edit_or_embed.js" as «class utf8»
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

fs.writeFileSync('scratch/edit_or_embed.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/edit_or_embed.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
