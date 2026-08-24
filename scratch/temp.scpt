
set jsCode to "\n            (() => {\n                const publishBtn = Array.from(document.querySelectorAll(\"button, [role='button']\")).find(b => \n                    (b.innerText || \"\").trim() === \"Publish\" || (b.innerText || \"\").trim() === \"เผยแพร่\"\n                );\n                if (publishBtn) {\n                    publishBtn.click();\n                    setTimeout(() => {\n                        const dialog = document.querySelector(\"[role='dialog']\");\n                        if (dialog) {\n                            const confBtn = Array.from(dialog.querySelectorAll(\"button, [role='button']\")).find(b => \n                                (b.innerText || \"\").trim().toLowerCase() === \"publish\" || (b.innerText || \"\").trim() === \"เผยแพร่\"\n                            );\n                            if (confBtn) confBtn.click();\n                        }\n                    }, 600);\n                    return \"Publish process triggered\";\n                }\n                return \"Publish button not found\";\n            })()\n            "
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
    