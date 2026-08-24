const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // In Google Sites sidebar, let's find the Insert tab and its items
    const insertTab = Array.from(document.querySelectorAll("[role='tab']")).find(t => (t.innerText || "").includes("Insert") || (t.innerText || "").includes("แทรก"));
    if (insertTab) insertTab.click();

    // Now find the Embed button in the Insert panel
    const allButtons = Array.from(document.querySelectorAll("*")).filter(el => {
        const text = (el.innerText || "").trim();
        const aria = el.getAttribute("aria-label") || "";
        return (text === "Embed" || aria === "Embed" || text === "ฝัง" || aria === "ฝัง") &&
               (el.tagName === "DIV" || el.tagName === "BUTTON") &&
               el.offsetParent !== null;
    }).map(el => ({
        tag: el.tagName,
        className: el.className,
        role: el.getAttribute("role"),
        aria: el.getAttribute("aria-label"),
        text: el.innerText
    }));

    return JSON.stringify(allButtons);
})()
`;

fs.writeFileSync('scratch/inspect_embed_btn.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_embed_btn.js" as «class utf8»
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

fs.writeFileSync('scratch/inspect_embed_btn.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_embed_btn.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
