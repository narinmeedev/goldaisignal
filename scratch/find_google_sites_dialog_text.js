const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const allMatching = Array.from(document.querySelectorAll("*")).filter(el => {
        const text = (el.innerText || "").trim();
        return text.includes("Embed code") || text.includes("By URL") || text.includes("ฝังโค้ด") || text.includes("ตาม URL");
    }).map(el => ({
        tag: el.tagName,
        className: el.className,
        role: el.getAttribute("role"),
        text: el.innerText.slice(0, 50)
    }));

    return JSON.stringify(allMatching);
})()
`;

fs.writeFileSync('scratch/find_dialog_text.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/find_dialog_text.js" as «class utf8»
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

fs.writeFileSync('scratch/find_dialog_text.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/find_dialog_text.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
