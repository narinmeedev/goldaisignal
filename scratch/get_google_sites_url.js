const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Find copy link icon button next to preview/share
    const allButtons = Array.from(document.querySelectorAll("button, [role='button']")).map(b => ({
        aria: b.getAttribute("aria-label"),
        tooltip: b.getAttribute("data-tooltip"),
        text: (b.innerText || "").trim()
    }));

    // Find the dropdown next to Publish
    const publishOptionsBtn = document.querySelector("[aria-label='Publish options'], [data-tooltip='Publish options']");
    if (publishOptionsBtn) {
        publishOptionsBtn.click();
    }

    return JSON.stringify({
        buttons: allButtons.slice(0, 20),
        hasPublishOptions: !!publishOptionsBtn
    });
})()
`;

fs.writeFileSync('scratch/get_site_url.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/get_site_url.js" as «class utf8»
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

fs.writeFileSync('scratch/get_site_url.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/get_site_url.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
