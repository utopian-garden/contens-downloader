'use strict';

const fs = require('fs');
const path = require('path');

exports.walkExistsSync = async (dirPath, fileName) => {
  let filePath = [];

  // 指定したファイルがディレクトリ配下にある場合はパスを配列に格納
  const walkSubDir = async (dirPath, fileName) => {
    const fullPath = path.join(dirPath, fileName);

    if (fs.existsSync(fullPath)) {
      filePath.push(fullPath);
    }

    // 配下に更にディレクトリがある場合は繰り返し実行
    fs.readdirSync(dirPath).forEach(async (someName) => {
      const nextPath = path.join(dirPath, someName);
      const someStat = fs.statSync(nextPath);

      if (someStat.isDirectory()) {
        await walkSubDir(nextPath, fileName);
      }
    });
  }

  if (dirPath && fs.existsSync(dirPath)) {
    await walkSubDir(dirPath, fileName);
  }
  
  if (filePath.length > 0) {
    return true;
  } else {
    return false;
  }
}
