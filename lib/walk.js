'use strict';

const fs = require('fs');
const path = require('path');

exports.walkExistsSync = async (dir, file) => {
  let items = [];

  // 指定したファイルがディレクトリ配下にある場合はパスを配列に格納
  const walkSubDir = async (dir, file) => {
    const fullPath = path.join(dir, file);

    if (fs.existsSync(fullPath)) {
      items.push(fullPath);
    }

    // 配下に更にディレクトリがある場合は繰り返し実行
    fs.readdirSync(dir).forEach(async (name) => {
      const nextPath = path.join(dir, name);
      const stat = fs.statSync(nextPath);

      if (stat.isDirectory()) {
        await walkSubDir(nextPath, file);
      }
    });
  }

  if (dir && fs.existsSync(dir)) {
    await walkSubDir(dir, file);
  }
  
  if (items.length > 0) {
    return true;
  } else {
    return false;
  }
}
