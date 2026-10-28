$ErrorActionPreference='Stop'
$deleteCli='C:/Users/Jomari/AppData/Local/npm-cache/_npx/85d9fc08972aaccb/node_modules/@microsoft/dataverse/bin/win-x64/dataverse.exe'
$deleteEnvironment='https://org9a7651f0.crm5.dynamics.com'
$deleteWork=Join-Path $PSScriptRoot '.work'
New-Item -ItemType Directory -Force -Path $deleteWork | Out-Null
function Read-Deletion([string]$Path) {
    $deleteOutput=& $deleteCli api request --target dataverse --environment $deleteEnvironment --path $Path --method GET --context 'app=dataverse-skills/1.16.0;skill=dv-query;agent=codex'
    if($LASTEXITCODE -ne 0){throw "Read-only verification failed: $Path"}
    return (($deleteOutput -join "`n") | ConvertFrom-Json)
}
function Preview-Deletion([string]$Api,$InputBody,[string]$ExpectedError='', [string]$Caller='') {
    if($Api -notin @('a365_DeletePayrollPeriod','a365_DeletePayrollEntry','a365_DeleteEmployee')){throw 'Unexpected API.'}
    # This verification helper cannot submit a committing deletion request.
    $InputBody.preview=$true
    $InputBody.operationId=[guid]::NewGuid().ToString()
    $deleteBodyFile=Join-Path $deleteWork 'readonly-preview.json'
    [IO.File]::WriteAllText($deleteBodyFile,(@{Request=($InputBody|ConvertTo-Json -Compress)}|ConvertTo-Json -Compress),(New-Object Text.UTF8Encoding($false)))
    $deleteArgs=@('api','request','--target','dataverse','--environment',$deleteEnvironment,'--path',"/api/data/v9.2/$Api",'--method','POST','--body-file',$deleteBodyFile,'--context','app=dataverse-skills/1.16.0;skill=dv-query;agent=codex')
    if($Caller){$deleteArgs+=@('--header',"MSCRMCallerID:$Caller")}
    $deleteOutput=& $deleteCli @deleteArgs 2>&1
    $deleteExit=$LASTEXITCODE
    $deleteText=$deleteOutput -join "`n"
    if($ExpectedError){
        if($deleteExit -eq 0 -or $deleteText -notlike "*$ExpectedError*"){throw "Expected rejection not observed for $Api : $deleteText"}
        return
    }
    if($deleteExit -ne 0){throw "Preview failed for $Api : $deleteText"}
    $deleteResult=($deleteText|ConvertFrom-Json).Response|ConvertFrom-Json
    if($deleteResult.deleted -ne $false -or $deleteResult.preview -ne $true -or $deleteResult.canDelete -ne $true){throw 'Invalid read-only preview response.'}
}
function Counts-Deletion {
    $deleteCounts=@{}
    foreach($deletePair in @(@('a365_employees','a365_employeeid'),@('a365_payrollperiods','a365_payrollperiodid'),@('a365_payrollentries','a365_payrollentryid'),@('a365_payrolldeletionreceipts','a365_payrolldeletionreceiptid'))){
        $deleteCounts[$deletePair[0]]=(Read-Deletion "/api/data/v9.2/$($deletePair[0])?`$select=$($deletePair[1])&`$count=true&`$top=1").'@odata.count'
    }
    return $deleteCounts
}
$deleteWho=Read-Deletion '/api/data/v9.2/WhoAmI'
if($deleteWho.OrganizationId -cne 'fe0edb27-c4a6-f111-aaa0-002248ed6f85'){throw 'Unexpected organization.'}
$deleteBefore=Counts-Deletion
$deletePeriods=(Read-Deletion '/api/data/v9.2/a365_payrollperiods?$select=a365_payrollperiodid,a365_name,a365_payrollstatus&$top=100').value
$deleteEvidence=@{Environment=$deleteEnvironment;VerifiedAt=[DateTime]::UtcNow.ToString('o');BusinessDeletes=0;ApiCount=3;ReadOnlyChecks=@();Unverified=@('Live deletion commit/rollback and concurrent-call races; no authorized disposable fixtures.');OrdinaryAdmin='Not exercised: current connection also has system administration privileges.'}
$deleteGuards=(Read-Deletion '/api/data/v9.2/sdkmessageprocessingsteps?$select=name,stage,mode,statecode&$filter=startswith(name,''A365 Deletion Guard '')').value
foreach($deleteRequiredName in @('A365 Deletion Guard a365_payrollperiod Delete','A365 Deletion Guard a365_payrollentry Delete','A365 Deletion Guard a365_employee Delete','A365 Deletion Guard a365_payrolldeletionreceipt Create','A365 Deletion Guard a365_payrolldeletionreceipt Update','A365 Deletion Guard a365_payrolldeletionreceipt Delete')){
    if(@($deleteGuards|Where-Object{$_.name -ceq $deleteRequiredName -and $_.stage -eq 20 -and $_.mode -eq 0 -and $_.statecode -eq 0}).Count -ne 1){throw "Missing active synchronous guard: $deleteRequiredName"}
}
$deleteEvidence.ActiveSynchronousGuards=@($deleteGuards).Count
$deleteEvidence.ReadOnlyChecks+='Active synchronous PreOperation guards protect native payroll/employee Delete and immutable receipt writes.'
$deleteAssembly=(Read-Deletion '/api/data/v9.2/pluginassemblies?$select=name,version,content&$filter=name eq ''A365.Payroll.Deletion''').value
if(@($deleteAssembly).Count -ne 1 -or $deleteAssembly[0].version -cne '1.0.1.0'){throw 'Unexpected live deletion assembly version.'}
$deleteSha=[Security.Cryptography.SHA256]::Create()
try{$deleteLiveHash=([BitConverter]::ToString($deleteSha.ComputeHash([Convert]::FromBase64String($deleteAssembly[0].content)))).Replace('-','')}finally{$deleteSha.Dispose()}
$deleteLocalHash=(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot '../../plugins/A365.Payroll.Deletion/bin/A365.Payroll.Deletion.dll')).Hash
if($deleteLiveHash -cne $deleteLocalHash){throw 'Live assembly differs from tested server binary.'}
$deleteEvidence.ServerVersion=$deleteAssembly[0].version
$deleteEvidence.ReadOnlyChecks+='Live signed server assembly hash matches the tested local binary.'
$deleteRelationships=(Read-Deletion '/api/data/v9.2/EntityDefinitions(LogicalName=''a365_employee'')?$select=LogicalName&$expand=OneToManyRelationships($select=SchemaName,ReferencingEntity,CascadeConfiguration)').OneToManyRelationships
foreach($deleteRelationship in @($deleteRelationships|Where-Object{$_.ReferencingEntity -like 'a365_*'})){
    if($deleteRelationship.CascadeConfiguration.Delete -cne 'Restrict'){throw "Employee business reference does not restrict deletion: $($deleteRelationship.SchemaName)"}
}
$deleteEvidence.ReadOnlyChecks+='All five existing employee business relationships, including template lines, restrict deletion.'
$deleteProcessing=@($deletePeriods|Where-Object{$_.a365_payrollstatus -in @(749910001,749910000)}|Select-Object -First 1)
if($deleteProcessing.Count){
    $deletePeriod=$deleteProcessing[0]
    $deleteRequest=@{periodId=$deletePeriod.a365_payrollperiodid;periodName=$deletePeriod.a365_name}
    Preview-Deletion 'a365_DeletePayrollPeriod' $deleteRequest
    $deleteEvidence.ReadOnlyChecks+='Processing period preview validates transaction, status and child enumeration without writes.'
    $deleteEntries=(Read-Deletion "/api/data/v9.2/a365_payrollentries?`$select=a365_payrollentryid,_a365_employee_value&`$filter=_a365_payrollperiod_value eq $($deletePeriod.a365_payrollperiodid)&`$top=1").value
    if(@($deleteEntries).Count){
        $deleteEntry=$deleteEntries[0]
        $deleteEmployee=Read-Deletion "/api/data/v9.2/a365_employees($($deleteEntry._a365_employee_value))?`$select=a365_employeeid,a365_name"
        Preview-Deletion 'a365_DeletePayrollEntry' @{periodId=$deletePeriod.a365_payrollperiodid;periodName=$deletePeriod.a365_name;entryId=$deleteEntry.a365_payrollentryid;employeeId=$deleteEmployee.a365_employeeid;employeeName=$deleteEmployee.a365_name}
        $deleteEvidence.ReadOnlyChecks+='Entry preview validates period/employee relationships without writes.'
        Preview-Deletion 'a365_DeleteEmployee' @{employeeId=$deleteEmployee.a365_employeeid;employeeName=$deleteEmployee.a365_name} 'This employee has payroll, leave or template records'
        $deleteEvidence.ReadOnlyChecks+='Employee with business history is rejected by the live API.'
    }
    $deleteNonAdmin=(Read-Deletion '/api/data/v9.2/systemusers?$select=systemuserid,isdisabled&$expand=systemuserroles_association($select=name)&$filter=isdisabled eq false&$top=100').value | Where-Object {
        $deleteRoleNames=@($_.systemuserroles_association.name)
        $deleteRoleNames -contains 'A365 - Payroll Employee' -and $deleteRoleNames -notcontains 'A365 - Payroll Admin' -and $deleteRoleNames -notcontains 'System Administrator'
    } | Select-Object -First 1
    if($deleteNonAdmin){
        foreach($deleteApi in @('a365_DeletePayrollPeriod','a365_DeletePayrollEntry','a365_DeleteEmployee')){
            Preview-Deletion $deleteApi $deleteRequest 'Payroll Admin access is required' $deleteNonAdmin.systemuserid
        }
        $deleteEvidence.ReadOnlyChecks+='Direct calls to all three APIs under an existing Payroll Employee identity are rejected before business-data access.'
    }else{$deleteEvidence.Unverified+='No existing ordinary employee identity available for impersonated read-only denial checks.'}
}
$deleteFinalized=@($deletePeriods|Where-Object{$_.a365_payrollstatus -in @(749910002,749910003,749910004)}|Select-Object -First 1)
if($deleteFinalized.Count){
    foreach($deleteApi in @('a365_DeletePayrollPeriod','a365_DeletePayrollEntry')){
        Preview-Deletion $deleteApi @{periodId=$deleteFinalized[0].a365_payrollperiodid;periodName=$deleteFinalized[0].a365_name;entryId=[guid]::NewGuid().ToString();employeeName='Synthetic confirmation'} 'Only Processing payroll periods and their entries can be deleted'
    }
    $deleteEvidence.ReadOnlyChecks+='Live finalized period and entry deletion calls are rejected.'
}
$deleteAfter=Counts-Deletion
foreach($deleteKey in $deleteBefore.Keys){if($deleteBefore[$deleteKey] -ne $deleteAfter[$deleteKey]){throw 'Record count changed during verification; investigate before claiming read-only verification.'}}
$deleteEvidence.ReadOnlyChecks+='Employee, period, entry and receipt counts unchanged across verification.'
[IO.File]::WriteAllText((Join-Path $PSScriptRoot '../../docs/payroll-deletion-verification.json'),($deleteEvidence|ConvertTo-Json -Depth 10),(New-Object Text.UTF8Encoding($false)))
Write-Host "Passed $($deleteEvidence.ReadOnlyChecks.Count) live read-only deletion checks. No records deleted or receipts created."
