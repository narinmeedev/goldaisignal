const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return JSON.stringify({ error: "No dialog" });

    const insertBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "insert" || (b.innerText || "").trim() === "แทรก"
    );

    let clicked = false;
    if (insertBtn) {
        insertBtn.click();
        clicked = true;
    }

    return JSON.stringify({
        hasInsertBtn: !!insertBtn,
        insertBtnDisabled: insertBtn ? insertBtn.disabled || insertBtn.getAttribute("aria-disabled") : null,
        clicked: clicked,
        allButtons: Array.from(dialog.querySelectorAll("button, [role='button']")).map(b => (b.innerText || "").trim())
    });
})()
`;

fs.writeFileSync('scratch/click_insert_btn.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_insert_btn.js" as «class utf8»
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

fs.writeFileSync('scratch/click_insert_btn.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_insert_btn.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
