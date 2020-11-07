Get-ChildItem . | Where-Object { $_.PSIsContainer } | ForEach-Object {
  $dir = $_.name

  Get-ChildItem $dir -Exclude *.lst, *.bat, *.ps1 `
  | Sort-Object LastWriteTime `
  | Select-Object -skip 10 `
  | ForEach-Object {Remove-Item $_.FullName}
}
