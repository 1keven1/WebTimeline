<#
.SYNOPSIS
    CSV 转 JSON 工具 - 结果直接复制到剪贴板
.DESCRIPTION
    将 CSV 转换为 JSON 后自动复制到剪贴板，也可选择显示在控制台或保存文件
#>

param(
    [Parameter(Mandatory = $false)]
    [string]$InputFile
)

Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# 选择文件（如果没有拖拽）
if (-not $InputFile -or -not (Test-Path $InputFile)) {
    Write-Host "请选择CSV文件"
    $FileDialog = New-Object System.Windows.Forms.OpenFileDialog
    $FileDialog.Title = "选择 CSV 文件"
    $FileDialog.Filter = "CSV 文件 (*.csv)|*.csv"
    $FileDialog.InitialDirectory = if ($PSScriptRoot) { $PSScriptRoot } else { [Environment]::GetFolderPath('Desktop') }
    
    if ($FileDialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        $InputFile = $FileDialog.FileName
    }
    else {
        exit
    }
}

try {
    Write-Host "正在读取: $InputFile" -ForegroundColor Cyan
    
    # 读取 CSV
    $Data = Import-Csv -Path $InputFile -Encoding UTF8
    Write-Host "读取到 $($Data.Count) 行数据" -ForegroundColor Gray

    # 构建对象数组
    $JsonArray = foreach ($Row in $Data) {
        [PSCustomObject]@{
            year       = if ($Row.Year -match '^\d+$') { [int]$Row.Year } else { $Row.Year }
            title      = $Row.Title
            label      = $Row.Lable
            importance = if ($Row.Importance -match '^\d+$') { [int]$Row.Importance } else { 0 }
            desc       = $Row.Desc
            detail     = $Row.Detail
            era        = $Row.Era
        }
    }

    # 生成 JSON（格式化缩进）
    $JsonContent = $JsonArray | ConvertTo-Json -Depth 10 -Compress:$false
    
    # 自动复制到剪贴板
    [System.Windows.Forms.Clipboard]::SetText($JsonContent)
    
    Write-Host "`n✓ 成功！" -ForegroundColor Green
    Write-Host "JSON 已自动复制到剪贴板，可直接粘贴使用" -ForegroundColor Green
    Write-Host "统计: $($Data.Count) 条记录, $($JsonContent.Length) 字符" -ForegroundColor Gray

    # 询问后续操作
    Write-Host "`n请选择操作:" -ForegroundColor Yellow
    Write-Host "  [S] 显示 JSON 内容（适合小数据查看）"
    Write-Host "  [F] 保存为 .json 文件"
    Write-Host "  [Enter] 直接退出（已复制到剪贴板）"
    
    $Choice = Read-Host "`n输入选项"
    
    switch ($Choice.ToUpper()) {
        'S' { 
            Write-Host "`n=== JSON 内容 ===" -ForegroundColor Cyan
            $JsonContent
            Write-Host "`n=================" -ForegroundColor Cyan
            Read-Host "按 Enter 关闭"
        }
        'F' {
            $OutputFile = [System.IO.Path]::ChangeExtension($InputFile, '.json')
            $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllLines($OutputFile, $JsonContent, $Utf8NoBom)
            Write-Host "已保存到: $OutputFile" -ForegroundColor Green
            Read-Host "按 Enter 关闭"
        }
        default {
            # 默认直接退出，内容已在剪贴板
            Start-Sleep -Milliseconds 500
        }
    }

}

catch {
    Write-Host "错误: $_" -ForegroundColor Red
    Read-Host "按 Enter 关闭"
}