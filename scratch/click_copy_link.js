const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const copyLinkBtn = document.querySelector("[aria-label*='Copy published site link'], [data-tooltip*='Copy published site link'], [aria-label*='คัดลอกลิงก์']");
    if (copyLinkBtn) {
        copyLinkBtn.click();
        setTimeout(() => {
            const linkInput = document.querySelector("[role='dialog'] input");
            if (linkInput) {
                console.log("Published Link:", linkInput.value);
            }
        }, 300);
        return "Clicked copy link button";
    }
    return "Copy link button not found";
})()
`;

fs.writeFileSync('scratch/get_copy_link.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/get_copy_link.js" as «class utf8»
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

fs.writeFileSync('scratch/get_copy_link.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/get_copy_link.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
