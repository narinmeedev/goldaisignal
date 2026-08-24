const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_embed.html', 'utf8');

const jsCode = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return JSON.stringify({ error: "No dialog" });

    const textarea = dialog.querySelector("textarea");
    if (!textarea) return JSON.stringify({ error: "No textarea in dialog" });

    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
    nativeSetter.call(textarea, ${JSON.stringify(htmlContent)});
    
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
    textarea.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));

    // Find Next button
    const nextBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "next" || (b.innerText || "").trim() === "ถัดไป"
    );

    let clickedNext = false;
    if (nextBtn) {
        // Remove disabled if needed or wait
        nextBtn.removeAttribute("disabled");
        nextBtn.removeAttribute("aria-disabled");
        nextBtn.click();
        clickedNext = true;
    }

    return JSON.stringify({
        valLength: textarea.value.length,
        hasNextBtn: !!nextBtn,
        clickedNext: clickedNext
    });
})()
`;

fs.writeFileSync('scratch/inject_site_html.js', jsCode, 'utf8');

const appleScript = `
set jsContent to read POSIX file "/Users/meedev/ai-coding/GoldaiSignal/scratch/inject_site_html.js" as «class utf8»
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

fs.writeFileSync('scratch/inject_site_html.scpt', appleScript, 'utf8');

try {
    const stdout = execSync('osascript scratch/inject_site_html.scpt', { encoding: 'utf8' });
    console.log('Result:', stdout);
} catch (err) {
    console.error('Error:', err.message);
}
