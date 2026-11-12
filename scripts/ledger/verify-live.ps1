param([switch]$Crud)
# Authorized Dev activation checks. Never changes real payroll or posts history.
$ErrorActionPreference='Stop'
$ledgerRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$ledgerEnvironment='https://org9a7651f0.crm5.dynamics.com'
$ledgerCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$ledgerWork=Join-Path $PSScriptRoot '.work/activation'
New-Item -ItemType Directory -Force -Path $ledgerWork|Out-Null
$ledgerChecks=@();$ledgerOrdinary=0;$ledgerLimit='Signed-in Power Apps browser UAT remains separate from CLI/impersonation checks.'
function Check([bool]$Condition,[string]$Name) {if(-not $Condition){throw "Ledger activation check failed: $Name"};$script:ledgerChecks+=$Name;Write-Host "PASS: $Name"}
function Request([string]$Path,[string]$Method='GET',$Body=$null,[string]$Caller='') {
    if($Path -notmatch '^/api/data/v9\.2/(WhoAmI|a365_LedgerCommand|a365_ledgertransactions|audits|sdkmessageprocessingsteps|plugintypes|a365_employees|systemusers|roles|customapis|EntityDefinitions|RetrieveRolePrivilegesRole)'){throw 'Outside Ledger activation scope.'}
    if($Method -ne 'GET' -and $Path -cne '/api/data/v9.2/a365_LedgerCommand' -and $Path -cne '/api/data/v9.2/a365_ledgertransactions'){throw 'Only scoped Ledger test operations permitted.'}
    $arguments=@('api','request','--target','dataverse','--environment',$ledgerEnvironment,'--path',$Path,'--method',$Method,'--context','app=dataverse-skills/1.16.0;skill=dv-query;agent=codex')
    if($Caller){$arguments+=@('--header',"CallerObjectId:$Caller")}
    if($null -ne $Body){$file=Join-Path $ledgerWork 'request.json';[IO.File]::WriteAllText($file,($Body|ConvertTo-Json -Depth 15 -Compress),(New-Object Text.UTF8Encoding($false)));$arguments+=@('--body-file',$file)}
    $previous=$ErrorActionPreference;$ErrorActionPreference='Continue'
    $output=& $ledgerCli @arguments 2>&1;$code=$LASTEXITCODE;$ErrorActionPreference=$previous
    if($code -ne 0){[IO.File]::WriteAllText((Join-Path $ledgerWork 'last-error.txt'),($output -join "`n"));return @{Success=$false;Data=$null;Message=($output -join ' ')}}
    try{return @{Success=$true;Data=(($output -join "`n")|ConvertFrom-Json);Message=''}}catch{throw 'Unverified Dataverse response.'}
}
function Command($InputBody,[string]$Caller='') {
    $response=Request '/api/data/v9.2/a365_LedgerCommand' 'POST' @{Request=($InputBody|ConvertTo-Json -Depth 12 -Compress)} $Caller
    if($response.Success){$response.Data=$response.Data.Response|ConvertFrom-Json}
    return $response
}
function Read-Page([string]$Search='') {
    $response=Command @{command='list';search=$Search}
    if(-not $response.Success){throw "Ledger list failed. Inspect ignored scripts/ledger/.work/activation/last-error.txt. $($response.Message)"}
    return $response.Data
}
$config=Get-Content -Raw (Join-Path $ledgerRoot 'power.config.json')|ConvertFrom-Json
if($config.environmentId -cne 'b58b083e-d27d-eabd-a143-2a49dcb9d89a'){throw 'Unexpected app environment.'}
$identity=Request '/api/data/v9.2/WhoAmI'
Check $identity.Success 'Authenticated Dev identity'
$steps=Request '/api/data/v9.2/sdkmessageprocessingsteps?$select=name,statecode,stage,mode,_eventhandler_value&$filter=startswith(name,''A365 Ledger '')'
$types=Request '/api/data/v9.2/plugintypes?$select=plugintypeid,typename&$filter=startswith(typename,''A365.Ledger.Plugins.'')'
Check ($steps.Success -and $types.Success) 'Read registered guards and handler types'
$known=@($types.Data.value.plugintypeid)
Check (@($steps.Data.value).Count -ge 30 -and @($steps.Data.value|Where-Object {$_.statecode -ne 0 -or $known -notcontains $_._eventhandler_value}).Count -eq 0) 'Ledger steps are active and reference the signed Ledger handlers'
Check (@($steps.Data.value|Where-Object {$_.mode -eq 1 -and $_.stage -eq 40 -and $_.name -like '*HistoryWorker*'}).Count -eq 2) 'Durable history worker registered for create and retry'
foreach($table in @('a365_ledgertransaction','a365_ledgeroperation','a365_ledgercoordination','a365_ledgerhistory')){
    foreach($message in @('Create','Update','Delete','CreateMultiple','UpdateMultiple','SetState')){
        $name="A365 Ledger ProtectLedgerWrites $table $message"
        Check (@($steps.Data.value|Where-Object {$_.name -ceq $name -and $_.mode -eq 0 -and $_.stage -eq 20}).Count -eq 1) "Synchronous guard: $table $message"
    }
}
$baseline=Read-Page
Check (@($baseline.categories).Count -eq 9 -and $null -ne $baseline.totals.count -and $null -ne $baseline.balance) 'Live list and complete aggregate contract'
$history=Command @{command='historyPreview'}
Check ($history.Success -and $null -ne $history.Data.missing) 'Historical preview loads without posting history'
$jobs=Command @{command='historyJobs'}
Check $jobs.Success 'Historical progress loads'
$employeeRole=Request '/api/data/v9.2/roles?$select=roleid&$filter=name eq ''A365 - Payroll Employee'''
Check ($employeeRole.Success -and @($employeeRole.Data.value).Count -eq 1) 'Resolve the existing Payroll Employee role'
$employeePrivileges=Request "/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId=$($employeeRole.Data.value[0].roleid))"
Check $employeePrivileges.Success 'Read Payroll Employee privileges without changing the role'
foreach($table in @('a365_ledgertransaction','a365_ledgeroperation','a365_ledgercoordination','a365_ledgerhistory')){
    $metadata=Request "/api/data/v9.2/EntityDefinitions(LogicalName='$table')?`$select=LogicalName,Privileges"
    Check ($metadata.Success -and @($employeePrivileges.Data.RolePrivileges|Where-Object {$metadata.Data.Privileges.PrivilegeId -contains $_.PrivilegeId}).Count -eq 0) "Payroll Employee role has no privileges on $table"
}
$testId=$null;$nativeId=$null;$marker='LEDGER-ACTIVATION-'+[guid]::NewGuid().ToString('D')
$cleaned=$false;$deleteAudit=$false
try {
    if($Crud){
        $testId=[guid]::NewGuid().ToString('D');$nativeId=[guid]::NewGuid().ToString('D')
        $day=[datetime]::UtcNow.AddHours(8).ToString('yyyy-MM-dd')
        $utilities=@($baseline.categories|Where-Object label -ceq 'Utilities')[0].value
        $native=Request '/api/data/v9.2/a365_ledgertransactions' 'POST' @{a365_ledgertransactionid=$nativeId;a365_name=$marker;a365_date=$day;a365_description=$marker;a365_direction='debit';a365_amount=0.01;a365_category=$utilities}
        Check (-not $native.Success -and $native.Message -like '*Use the validated Ledger command*') 'Native financial write denied even to the administrator'
        $save=@{command='save';operationId=$testId;date=$day;receipt='0001';reference='';direction='debit';amount='0.01';category=[string]$utilities;description=$marker}
        $saved=Command $save
        Check ($saved.Success -and $saved.Data.id -ceq $testId) 'Live manual save commits through the transaction and guards'
        $read=Read-Page $marker;$row=@($read.rows|Where-Object id -ceq $testId)[0]
        Check ($null -ne $row -and $row.receipt -ceq '0001' -and $row.reference -ceq '' -and [decimal]$row.amount -eq 0.01 -and $row.version) 'Saved amount, receipt zeros, blank reference and concurrency version retained'
        Check ([decimal]$read.balance -eq ([decimal]$baseline.balance-0.01) -and [decimal]$read.totals.debit -eq 0.01 -and [int]$read.totals.count -eq 1) 'Company balance and filtered totals include the test once'
        $repeat=Command $save
        Check ($repeat.Success -and [int](Read-Page $marker).totals.count -eq 1) 'Repeated save does not duplicate the transaction'
        $edit=@{};foreach($key in $save.Keys){$edit[$key]=$save[$key]};$edit.operationId=[guid]::NewGuid().ToString('D');$edit.id=$testId;$edit.version=$row.version;$edit.amount='0.02'
        $edited=Command $edit
        Check $edited.Success 'Live manual edit succeeds'
        $replay=Command $save;$row=@((Read-Page $marker).rows|Where-Object id -ceq $testId)[0]
        Check ($replay.Success -and [decimal]$row.amount -eq 0.02) 'Replayed completed operation preserves a subsequent manual edit'
        $stale=@{};foreach($key in $edit.Keys){$stale[$key]=$edit[$key]};$stale.operationId=[guid]::NewGuid().ToString('D');$stale.amount='0.03'
        $rejected=Command $stale
        Check (-not $rejected.Success -and $rejected.Message -like '*The record changed*') 'Stale-version edit is rejected without changing the saved row'
        $invalid=@{};foreach($key in $save.Keys){$invalid[$key]=$save[$key]};$invalid.operationId=[guid]::NewGuid().ToString('D');$invalid.amount='1.001'
        $rejected=Command $invalid
        Check (-not $rejected.Success -and $rejected.Message -like '*at most two decimal places*') 'Server rejects excess amount precision'
        $invalid.amount='1.00';$invalid.category='123';$invalid.operationId=[guid]::NewGuid().ToString('D')
        $rejected=Command $invalid
        Check (-not $rejected.Success -and $rejected.Message -like '*Select a valid Chart of Account*') 'Server rejects an unapproved category'
        $invalid.amount='0';$invalid.category=[string]$utilities;$invalid.operationId=[guid]::NewGuid().ToString('D')
        $rejected=Command $invalid
        Check (-not $rejected.Success -and $rejected.Message -like '*Manual amounts must be positive*') 'Server rejects zero manual amounts'
    }
    $links=Request '/api/data/v9.2/a365_employees?$select=a365_employeeid,_a365_systemuser_value&$filter=_a365_systemuser_value ne null&$top=50'
    Check $links.Success 'Resolve eligible ordinary employee accounts for effective-access tests'
    foreach($link in @($links.Data.value)){
        if($ledgerOrdinary -ge 2){break}
        $user=$link._a365_systemuser_value
        $roles=Request "/api/data/v9.2/roles?`$select=name&`$filter=systemuserroles_association/any(u:u/systemuserid eq $user) or teamroles_association/any(t:t/teammembership_association/any(u:u/systemuserid eq $user))"
        if(-not $roles.Success){throw 'Cannot verify ordinary account role membership.'}
        $names=@($roles.Data.value.name)
        if($names -notcontains 'A365 - Payroll Employee' -or $names -contains 'A365 - Payroll Admin' -or $names -contains 'System Administrator'){continue}
        $directory=Request "/api/data/v9.2/systemusers($user)?`$select=azureactivedirectoryobjectid"
        if(-not $directory.Success -or -not $directory.Data.azureactivedirectoryobjectid){continue}
        $caller=$directory.Data.azureactivedirectoryobjectid
        $who=Request '/api/data/v9.2/WhoAmI' 'GET' $null $caller
        if(-not $who.Success -or $who.Data.UserId -ine $user){$ledgerLimit='Ordinary-account impersonation could not be verified; direct signed-in employee access remains unverified.';continue}
        $denied=Command @{command='list'} $caller
        Check (-not $denied.Success -and $denied.Message -like '*Payroll Admin access is required*') 'Verified ordinary employee cannot read/export through the API'
        $direct=Request '/api/data/v9.2/a365_ledgertransactions?$select=a365_ledgertransactionid&$top=1' 'GET' $null $caller
        Check (-not $direct.Success) 'Verified ordinary employee cannot read the ledger table directly'
        if($testId){$detail=Request "/api/data/v9.2/a365_ledgertransactions($testId)?`$select=a365_ledgertransactionid" 'GET' $null $caller;Check (-not $detail.Success) 'Verified ordinary employee cannot read a manipulated ledger record ID'}
        $denied=Command @{command='pay';periodId=[guid]::NewGuid().ToString('D');operationId=[guid]::NewGuid().ToString('D');version=[datetime]::UtcNow.ToString('o')} $caller
        Check (-not $denied.Success -and $denied.Message -like '*Payroll Admin access is required*') 'Verified ordinary employee cannot invoke payroll payment'
        $ledgerOrdinary++
    }
} finally {
    # Only exact activation IDs are eligible for cleanup. Never touch real rows.
    foreach($id in @($testId,$nativeId)|Where-Object {$_}){
        $page=Read-Page $marker;$owned=@($page.rows|Where-Object {$_.id -ceq $id -and $_.description -ceq $marker})
        if($owned.Count){$removed=Command @{command='delete';id=$id;version=$owned[0].version;operationId=[guid]::NewGuid().ToString('D')};if(-not $removed.Success){throw "Activation test cleanup failed for $id; resolve before release."}}
    }
    if($Crud){
        $after=Read-Page
        Check ([int](Read-Page $marker).totals.count -eq 0 -and [decimal]$after.balance -eq [decimal]$baseline.balance -and [int]$after.totals.count -eq [int]$baseline.totals.count) 'Only activation-created test rows removed; original count and balance restored'
        $cleaned=$true
    }
}
if($Crud){
    for($attempt=0;$attempt -lt 6;$attempt++){
        $audit=Request "/api/data/v9.2/audits?`$select=auditid,operation&`$filter=_objectid_value eq $testId and operation eq 3&`$top=1"
        if($audit.Success -and @($audit.Data.value).Count){$deleteAudit=$true;break}
        Start-Sleep -Seconds 2
    }
    Check $deleteAudit 'Native deletion audit retained after the test ledger row is removed'
}
$report=[ordered]@{VerifiedAt=[datetime]::UtcNow.ToString('o');Environment=$ledgerEnvironment;Checks=$ledgerChecks;OrdinaryEmployeeAccountsVerified=$ledgerOrdinary;ControlledLedgerCrudVerified=[bool]$Crud;ControlledTestRowsCleaned=$cleaned;DeletionAuditVerified=$deleteAudit;FinancialPayrollRecordsChanged=$false;HistoricalPostingStarted=$false;Limits=$ledgerLimit;ActiveLedgerSteps=@($steps.Data.value).Count}
$reportName=if($Crud){'docs/ledger-live-verification.json'}else{'docs/ledger-runtime-verification.json'}
$report|ConvertTo-Json -Depth 10|Set-Content -Encoding UTF8 (Join-Path $ledgerRoot $reportName)
Write-Host "Ledger activation checks passed: $($ledgerChecks.Count); verified ordinary accounts: $ledgerOrdinary. No real payroll or historical posting changes."
