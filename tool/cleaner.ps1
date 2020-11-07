Get-ChildItem . | Where-Object { $_.PSIsContainer } | ForEach-Object {
  $dir = $_.name

  Get-ChildItem $dir -Recurse -Include *.lst, *.bat, *.ps1 -Exclude cleaner.* `
  | ForEach-Object {Remove-Item $_.FullName}
}
