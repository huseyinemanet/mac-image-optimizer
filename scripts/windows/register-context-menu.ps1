param(
  [Parameter(Mandatory = $true)]
  [string]$AppExePath
)

$command = '"' + $AppExePath + '" "%1"'

New-Item -Path 'HKCU:\Software\Classes\Directory\shell\MacImageOptimizer' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Classes\Directory\shell\MacImageOptimizer' -Name '(Default)' -Value 'Optimise with Mac Image Optimizer'
New-Item -Path 'HKCU:\Software\Classes\Directory\shell\MacImageOptimizer\command' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Classes\Directory\shell\MacImageOptimizer\command' -Name '(Default)' -Value $command

New-Item -Path 'HKCU:\Software\Classes\SystemFileAssociations\image\shell\MacImageOptimizer' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Classes\SystemFileAssociations\image\shell\MacImageOptimizer' -Name '(Default)' -Value 'Optimise with Mac Image Optimizer'
New-Item -Path 'HKCU:\Software\Classes\SystemFileAssociations\image\shell\MacImageOptimizer\command' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\Software\Classes\SystemFileAssociations\image\shell\MacImageOptimizer\command' -Name '(Default)' -Value $command

Write-Host 'Context menu entries created for directories and image files.'
