const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Click view in snackbar
    const viewBtn = Array.from(document.querySelectorAll("a, button, [role='button']")).find(el => (el.innerText || "").trim().toLowerCase() === "view" || (el.innerText || "").trim() === "ดู");
    if (viewBtn) {
        viewBtn.click();
        return "Clicked view button";
    }

    const copyBtn = document.querySelector("[data-tooltip='Copy published site link'], [aria-label*='Copy published site link'], [aria-label*='คัดลอกลิงก์']");
    if (copyBtn) {
        copyBtn.click();
        return "Clicked copy link button";
    }

    return "Button not found";
})()
`;

fs.writeFileSync('scratch/click_view_site.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_view_site.js" as «class utf8»
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

fs.writeFileSync('scratch/click_view_site.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_view_site.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
