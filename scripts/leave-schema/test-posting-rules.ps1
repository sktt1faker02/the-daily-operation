$ErrorActionPreference = 'Stop'
$leaveProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
[Reflection.Assembly]::LoadFrom('C:/Users/Jomari/AppData/Local/Microsoft/PowerAppsCLI/Microsoft.PowerApps.CLI.2.13.1/tools/Microsoft.Xrm.Sdk.dll') | Out-Null
[Reflection.Assembly]::LoadFrom((Join-Path $leaveProject 'plugins/A365.Leave.Plugins/bin/A365.Leave.Plugins.dll')) | Out-Null
Add-Type -AssemblyName System.Web.Extensions
$leaveSerializer = New-Object Web.Script.Serialization.JavaScriptSerializer
$leavePolicy = $leaveSerializer.Deserialize([IO.File]::ReadAllText((Join-Path $leaveProject 'src/features/leave/approved-policy.json')), [A365.Leave.Plugins.Policy])
$leaveTests = 0
function Assert-LeaveRule($Actual, $Expected) {
    if ($Actual -cne $Expected) { throw "Rule mismatch: expected $Expected; received $Actual" }
    $script:leaveTests++
}
function Assert-LeaveRejected([scriptblock]$Operation) {
    $leaveRejected = $false
    try { & $Operation | Out-Null } catch { $leaveRejected = $true }
    if (-not $leaveRejected) { throw 'Expected invalid leave to be rejected.' }
    $script:leaveTests++
}
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Days([datetime]'2026-10-22', [datetime]'2026-10-26', $leavePolicy)) 3d
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Days([datetime]'2026-12-23', [datetime]'2026-12-28', $leavePolicy)) 2d
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Days([datetime]'2026-02-25', [datetime]'2026-02-25', $leavePolicy)) 1d
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Days([datetime]'2026-03-20', [datetime]'2026-03-20', $leavePolicy) }
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Days([datetime]'2026-05-27', [datetime]'2026-05-27', $leavePolicy) }
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Days([datetime]'2026-10-24', [datetime]'2026-10-26', $leavePolicy) }
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Days([datetime]'2026-10-23', [datetime]'2026-10-22', $leavePolicy) }
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Days([datetime]'2026-03-31', [datetime]'2026-04-01', $leavePolicy) }
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Days([datetime]'2027-02-01', [datetime]'2027-02-01', $leavePolicy) }
$leaveAccrued = 0d
1..12 | ForEach-Object { $leaveAccrued += [A365.Leave.Plugins.Rules]::Accrual($_) }
Assert-LeaveRule $leaveAccrued 10d
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Benefit(749910000, 2d, 3d)) 749910002
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Benefit(749910000, 0d, 1d)) 749910001
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Benefit(749910000, -1d, 1d)) 749910001
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Benefit(749910000, 3d, 3d)) 749910000
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Benefit(749910001, 3d, 1d)) 749910001
$leaveSplit = [A365.Leave.Plugins.Rules]::Allocate(749910000, 4d, [datetime]'2026-10-26', [datetime]'2026-10-30', $leavePolicy)
Assert-LeaveRule $leaveSplit.Benefit 749910002
Assert-LeaveRule $leaveSplit.PaidDays 4d
Assert-LeaveRule $leaveSplit.UnpaidDays 1d
Assert-LeaveRule $leaveSplit.days.Count 5
Assert-LeaveRule $leaveSplit.days[0].paidDays 1d
Assert-LeaveRule $leaveSplit.days[4].date '2026-10-30'
Assert-LeaveRule $leaveSplit.days[4].unpaidDays 1d
$leaveFraction = [A365.Leave.Plugins.Rules]::Allocate(749910000, 1.25d, [datetime]'2026-10-15', [datetime]'2026-10-19', $leavePolicy)
Assert-LeaveRule $leaveFraction.PaidDays 1.25d
Assert-LeaveRule $leaveFraction.UnpaidDays 1.75d
Assert-LeaveRule $leaveFraction.days[1].date '2026-10-16'
Assert-LeaveRule $leaveFraction.days[1].paidDays 0.25d
Assert-LeaveRule $leaveFraction.days[1].unpaidDays 0.75d
Assert-LeaveRule $leaveFraction.days[2].date '2026-10-19'
foreach ($leaveBalance in @(0d, -1d, 4d, 10d)) {
    $leaveUnpaid = [A365.Leave.Plugins.Rules]::Allocate(749910001, $leaveBalance, [datetime]'2026-10-26', [datetime]'2026-10-30', $leavePolicy)
    Assert-LeaveRule $leaveUnpaid.PaidDays 0d
    Assert-LeaveRule $leaveUnpaid.UnpaidDays 5d
}
foreach ($leaveBalance in @(0d, -1d)) {
    Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Allocate(749910000, $leaveBalance, [datetime]'2026-10-26', [datetime]'2026-10-30', $leavePolicy).UnpaidDays) 5d
}
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Allocate(749910000, 10d, [datetime]'2026-10-26', [datetime]'2026-10-30', $leavePolicy).PaidDays) 5d
$leaveHoliday = [A365.Leave.Plugins.Rules]::Allocate(749910000, 1d, [datetime]'2026-12-23', [datetime]'2026-12-28', $leavePolicy)
Assert-LeaveRule $leaveHoliday.days.Count 2
Assert-LeaveRule $leaveHoliday.days[1].date '2026-12-28'
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Allocate(749910002, 4d, [datetime]'2026-10-26', [datetime]'2026-10-30', $leavePolicy) }
Assert-LeaveRejected { [A365.Leave.Plugins.Rules]::Allocate(749910000, 1.234d, [datetime]'2026-10-26', [datetime]'2026-10-30', $leavePolicy) }
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Period([datetime]'2027-01-04').ToString('yyyy-MM-dd')) '2026-04-01'
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::PeriodEnd([datetime]'2026-04-01').ToString('yyyy-MM-dd')) '2027-01-04'
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Period([datetime]'2027-01-05').ToString('yyyy-MM-dd')) '2027-01-05'
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Period([datetime]'2028-01-04').ToString('yyyy-MM-dd')) '2027-01-05'
Assert-LeaveRule ([A365.Leave.Plugins.Rules]::Period([datetime]'2028-01-05').ToString('yyyy-MM-dd')) '2028-01-05'
Write-Host "Passed $leaveTests server policy checks. No Dataverse calls or financial test records."
