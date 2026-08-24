const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    // Open publish options menu if not open
    const pubOptions = document.querySelector("[aria-label='Publish options']");
    if (pubOptions) pubOptions.click();

    setTimeout(() => {
        const pubSettings = Array.from(document.querySelectorAll("[role='menuitem']")).find(m => 
            (m.innerText || "").toLowerCase().includes("publish settings") || (m.innerText || "").includes("การตั้งค่าการเผยแพร่")
        );
        if (pubSettings) pubSettings.click();
    }, 200);

    return "Clicked publish settings";
})()
`;

fs.writeFileSync('scratch/click_pub_settings.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/click_pub_settings.js" as «class utf8»
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

fs.writeFileSync('scratch/click_pub_settings.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/click_pub_settings.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
