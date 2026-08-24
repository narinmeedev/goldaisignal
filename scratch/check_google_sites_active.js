const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    const openModals = Array.from(document.querySelectorAll("[role='dialog'], [role='menu'], [aria-modal='true']")).map(m => ({
        role: m.getAttribute("role"),
        aria: m.getAttribute("aria-label"),
        text: (m.innerText || "").slice(0, 100)
    }));

    return JSON.stringify({
        hasDialog: !!dialog,
        openModals: openModals
    });
})()
`;

fs.writeFileSync('scratch/check_active_dialog.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/check_active_dialog.js" as «class utf8»
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

fs.writeFileSync('scratch/check_active_dialog.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/check_active_dialog.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
