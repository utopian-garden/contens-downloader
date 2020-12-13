'use strict';

// 依存パッケージ
const fs = require('fs');
const path = require('path');

// 再帰的なファイル名取得
exports.walkFileSync = async (dirPath) => {
  // 指定したファイルがディレクトリ配下にある場合はパスを配列に格納
  let fileName = [];
  const walkSubDir = async (dirPath) => {
    fs.readdirSync(dirPath).forEach(async (someName) => {
      const nextPath = path.join(dirPath, someName);
      const someStat = fs.statSync(nextPath);

      // 配下に更にディレクトリがある場合は繰り返し実行
      if (someStat.isDirectory()) {
        await walkSubDir(nextPath);
      } else {
        fileName.push(someName);
      }
    });
  }

  if (dirPath && fs.existsSync(dirPath)) {
    await walkSubDir(dirPath);
  }

  return fileName;
}
