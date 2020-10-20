Get-ChildItem E:\Projects\Sankaku\download `
  | Where-Object { $_.PSIsContainer } `
  | ForEach-Object -Process {
    Copy-Item Order.bat $_.FullName
    Copy-Item Order.ps1 $_.FullName
    Copy-Item Order.lst $_.FullName
  }
