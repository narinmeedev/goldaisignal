const fs = require('fs');
const { execSync } = require('child_process');

const jsCode = `
(() => {
    const main = document.querySelector("[role='main'], .zB4f2b");
    const iframes = Array.from(document.querySelectorAll("iframe")).map(f => ({
        src: f.src,
        rect: f.getBoundingClientRect()
    }));

    return JSON.stringify({
        hasMain: !!main,
        iframes: iframes
    });
})()
`;

fs.writeFileSync('scratch/inspect_main.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inspect_main.js" as «class utf8»
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

fs.writeFileSync('scratch/inspect_main.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inspect_main.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
