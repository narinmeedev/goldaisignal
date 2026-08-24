const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "No dialog";

    const embedCodeTab = Array.from(dialog.querySelectorAll("[role='tab']")).find(t => 
        (t.innerText || "").trim().toLowerCase().includes("embed code") || (t.innerText || "").trim().includes("ฝังโค้ด")
    );

    if (embedCodeTab) {
        embedCodeTab.click();
        return "Clicked Embed code tab";
    }
    return "Embed code tab not found";
})()
`;

fs.writeFileSync('scratch/click_embed_code_tab.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_embed_code_tab.js" as «class utf8»
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

fs.writeFileSync('scratch/click_embed_code_tab.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_embed_code_tab.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
