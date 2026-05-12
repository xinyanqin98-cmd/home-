Set-Location -LiteralPath $PSScriptRoot
$node = "C:\Users\First Blood\AppData\Local\OpenAI\Codex\bin\node.exe"
& $node "$PSScriptRoot\server.js" *> "$PSScriptRoot\preview-runtime.log"
