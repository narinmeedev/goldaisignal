const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const el = document.querySelector(".LhYFUe[aria-label='Embed'], [role='menuitem'][aria-label='Embed']");
    if (!el) return "Embed element not found";

    const opts = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent('pointerdown', opts));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', opts));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.click();

    return "Dispatched click events to Embed button";
})()
`;

fs.writeFileSync('scratch/click_mouse_events.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_mouse_events.js" as «class utf8»
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

fs.writeFileSync('scratch/click_mouse_events.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_mouse_events.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
