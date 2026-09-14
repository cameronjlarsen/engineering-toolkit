$ErrorActionPreference = "Stop"

$repo = (Get-Location).Path
$oldRel = "plugins/engineering-toolkit/skills/poteto-mode"
$newRel = "plugins/engineering-toolkit/skills/engineering-mode"
$oldDir = Join-Path $repo $oldRel
$newDir = Join-Path $repo $newRel

if (Test-Path -LiteralPath $oldDir) {
    git mv -- $oldRel $newRel
} elseif (-not (Test-Path -LiteralPath $newDir)) {
    throw "Neither $oldRel nor $newRel exists"
}

$replacements = [ordered]@{
    "plugins/engineering-toolkit/skills/poteto-mode" = "plugins/engineering-toolkit/skills/engineering-mode"
    "skills/poteto-mode" = "skills/engineering-mode"
    "../poteto-mode" = "../engineering-mode"
    "/pstack:poteto-mode" = "/pstack:engineering-mode"
    "pstack:poteto-mode" = "pstack:engineering-mode"
    "/poteto-mode" = "/engineering-mode"
    "Poteto mode" = "Engineering mode"
    "@open-pstack/poteto-mode-tools" = "@open-pstack/engineering-mode-tools"
    "@pstack-claude/poteto-mode-tools" = "@pstack-claude/engineering-mode-tools"
    ".poteto-mode-tools-install-key" = ".engineering-mode-tools-install-key"
    "poteto-mode" = "engineering-mode"
}

$skipNames = @("README-UPSTREAM.md", "LICENSE", "LICENSE-cursor-team-kit", "LICENSE-superpowers")
$files = Get-ChildItem -LiteralPath $repo -Recurse -File
foreach ($item in $files) {
    $relative = $item.FullName.Substring($repo.Length + 1).Replace("\", "/")
    if ($relative -eq "scripts/rename-skill-identity.ps1") {
        continue
    }
    if ($item.Extension -in @(".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico")) {
        continue
    }
    if ($skipNames -contains $item.Name) {
        continue
    }

    $text = [System.IO.File]::ReadAllText($item.FullName)
    $updated = $text
    foreach ($entry in $replacements.GetEnumerator()) {
        $updated = $updated.Replace($entry.Key, $entry.Value)
    }
    if ($updated -ne $text) {
        [System.IO.File]::WriteAllText($item.FullName, $updated, [System.Text.UTF8Encoding]::new($false))
    }
}
