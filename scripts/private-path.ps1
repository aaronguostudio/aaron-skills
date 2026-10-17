param(
    [Parameter(Mandatory=$true)][string]$Target,
    [switch]$Directory
)
$ErrorActionPreference = 'Stop'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$acl = if ($Directory) {
    New-Object System.Security.AccessControl.DirectorySecurity
} else {
    New-Object System.Security.AccessControl.FileSecurity
}
$acl.SetOwner($identity.User)
$acl.SetAccessRuleProtection($true, $false)
$inherit = if ($Directory) {
    [System.Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'
} else {
    [System.Security.AccessControl.InheritanceFlags]::None
}
$rule = [System.Security.AccessControl.FileSystemAccessRule]::new(
    $identity.User,
    [System.Security.AccessControl.FileSystemRights]::FullControl,
    $inherit,
    [System.Security.AccessControl.PropagationFlags]::None,
    [System.Security.AccessControl.AccessControlType]::Allow
)
$acl.AddAccessRule($rule)
Set-Acl -LiteralPath $Target -AclObject $acl
# Fail closed if setting or reading back the private ACL is unavailable.
$actual = Get-Acl -LiteralPath $Target
if (-not $actual.AreAccessRulesProtected) { throw 'Private ACL inheritance was not disabled.' }
foreach ($entry in $actual.Access) {
    $sid = $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
    if ($entry.AccessControlType -eq 'Allow' -and $sid.Value -ne $identity.User.Value) {
        throw 'The path still grants access to another identity.'
    }
}
