Import-Csv Order.lst | ForEach-Object {
	$ext = $_.extension
	$dir = $_.directory

	Get-ChildItem . `
  | Where-Object { $_.Extension -eq $ext } `
  | ForEach-Object -Process {
    if (!(Test-Path $dir)) {
      New-Item $dir -ItemType Directory
    }

    if (!(Test-Path $dir\ok)) {
      New-Item $dir\ok -ItemType Directory
    }

    if (!(Test-Path $dir\ng)) {
      New-Item $dir\ng -ItemType Directory
    }

    Move-Item $_ $dir
  }
}
