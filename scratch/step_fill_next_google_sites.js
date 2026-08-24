const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_10_games.html', 'utf8');

const jsCode = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "No dialog";

    const tabs = Array.from(dialog.querySelectorAll("[role='tab']"));
    const embedCodeTab = tabs.find(t => 
        (t.innerText || "").trim().toLowerCase().includes("embed code") || (t.innerText || "").trim().includes("ฝังโค้ด")
    );
    if (embedCodeTab) embedCodeTab.click();

    const textarea = dialog.querySelector("textarea");
    if (!textarea) return "No textarea";

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, ${JSON.stringify(htmlContent)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    const nextBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "next" || (b.innerText || "").trim() === "ถัดไป"
    );

    if (nextBtn) {
        nextBtn.removeAttribute("disabled");
        nextBtn.removeAttribute("aria-disabled");
        nextBtn.click();
        return "Clicked Next button";
    }

    return "Next button not found";
})()
`;

fs.writeFileSync('scratch/step_fill_next.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/step_fill_next.js" as «class utf8»
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

fs.writeFileSync('scratch/step_fill_next.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/step_fill_next.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
