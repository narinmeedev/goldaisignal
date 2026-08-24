const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    const buttons = dialog ? Array.from(dialog.querySelectorAll("button, [role='button']")).map(b => ({
        text: (b.innerText || "").trim(),
        disabled: b.disabled || b.getAttribute("aria-disabled")
    })) : [];

    return JSON.stringify({
        hasDialog: !!dialog,
        buttons: buttons,
        embedResult: window.__embedResult || null
    });
})()
`;

fs.writeFileSync('scratch/check_diag_status.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/check_diag_status.js" as «class utf8»
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

fs.writeFileSync('scratch/check_diag_status.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/check_diag_status.scpt', { encoding: 'utf8' });
    console.log('Diag Status:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
