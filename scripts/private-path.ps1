param(
    [Parameter(Mandatory=$true)][string]$Target,
    [switch]$Directory
)
$ErrorActionPreference = 'Stop'
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
# Load and modify only the DACL. A fresh security descriptor passed to Set-Acl
# can also request audit/owner updates, which require elevated privileges.
$item = Get-Item -LiteralPath $Target -Force
$acl = $item.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access)
$acl.SetAccessRuleProtection($true, $false)
foreach ($entry in @($acl.GetAccessRules($true, $false, [System.Security.Principal.SecurityIdentifier]))) {
    $acl.RemoveAccessRuleSpecific($entry)
}
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
$item.SetAccessControl($acl)
# Fail closed if setting or reading back the private ACL is unavailable.
$actual = Get-Acl -LiteralPath $Target
if (-not $actual.AreAccessRulesProtected) { throw 'Private ACL inheritance was not disabled.' }
foreach ($entry in $actual.Access) {
    $sid = $entry.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier])
    if ($entry.AccessControlType -eq 'Allow' -and $sid.Value -ne $identity.User.Value) {
        throw 'The path still grants access to another identity.'
    }
}
