const fs = require('fs');
const { execSync } = require('child_process');

const htmlContent = fs.readFileSync('scratch/google_site_10_games.html', 'utf8');

// Step 1: Open Embed dialog
const step1Js = `
(() => {
    const embedEl = Array.from(document.querySelectorAll("[aria-label='Embed'], [role='menuitem']")).find(el => 
        (el.innerText || "").trim() === "Embed" || el.getAttribute("aria-label") === "Embed"
    );
    if (embedEl) {
        embedEl.click();
        return "Step 1 OK: Clicked Embed";
    }
    return "Step 1 Fail: Embed not found";
})()
`;

// Step 2: Switch to Embed Code tab and fill textarea
const step2Js = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "Step 2 Fail: No dialog";

    const embedCodeTab = Array.from(dialog.querySelectorAll("[role='tab']")).find(t => 
        (t.innerText || "").trim().toLowerCase().includes("embed code") || (t.innerText || "").trim().includes("ฝังโค้ด")
    );
    if (embedCodeTab) embedCodeTab.click();

    const textarea = dialog.querySelector("textarea");
    if (!textarea) return "Step 2 Fail: No textarea";

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
        return "Step 2 OK: Filled and clicked Next";
    }

    return "Step 2 Fail: Next button not found";
})()
`;

// Step 3: Click Insert
const step3Js = `
(() => {
    const dialog = document.querySelector("[role='dialog']");
    if (!dialog) return "Step 3 Fail: No dialog";

    const insertBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
        (b.innerText || "").trim().toLowerCase() === "insert" || (b.innerText || "").trim() === "แทรก"
    );
    if (insertBtn) {
        insertBtn.click();
        return "Step 3 OK: Clicked Insert";
    }
    return "Step 3 Fail: Insert button not found";
})()
`;

function runAppleScript(jsCode) {
    const scpt = `
set jsCode to ${JSON.stringify(jsCode)}
tell application "Google Chrome"
    repeat with aWindow in every window
        repeat with aTab in every tab of aWindow
            if URL of aTab contains "sites.google.com/d/1jGLfpwGuv8dekzAvqfVKeQZ1hbES2lvA" then
                set res to (execute aTab javascript jsCode)
                return res
            end if
        end repeat
    end repeat
    return "Tab not found"
end tell
    `;
    fs.writeFileSync('scratch/temp.scpt', scpt, 'utf8');
    return execSync('osascript scratch/temp.scpt', { encoding: 'utf8' }).trim();
}

console.log('Running Step 1...');
console.log(runAppleScript(step1Js));

setTimeout(() => {
    console.log('Running Step 2...');
    console.log(runAppleScript(step2Js));

    setTimeout(() => {
        console.log('Running Step 3...');
        console.log(runAppleScript(step3Js));

        setTimeout(() => {
            console.log('Publishing site...');
            const pubJs = `
            (() => {
                const publishBtn = Array.from(document.querySelectorAll("button, [role='button']")).find(b => 
                    (b.innerText || "").trim() === "Publish" || (b.innerText || "").trim() === "เผยแพร่"
                );
                if (publishBtn) {
                    publishBtn.click();
                    setTimeout(() => {
                        const dialog = document.querySelector("[role='dialog']");
                        if (dialog) {
                            const confBtn = Array.from(dialog.querySelectorAll("button, [role='button']")).find(b => 
                                (b.innerText || "").trim().toLowerCase() === "publish" || (b.innerText || "").trim() === "เผยแพร่"
                            );
                            if (confBtn) confBtn.click();
                        }
                    }, 600);
                    return "Publish process triggered";
                }
                return "Publish button not found";
            })()
            `;
            console.log(runAppleScript(pubJs));
        }, 1500);
    }, 1200);
}, 1000);
