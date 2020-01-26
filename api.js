'use strict';

const fs = require('fs-extra');
const path = require('path');
const http = require('http');
const url = require('url');
const ddb = require('./lib/ddb.js');
const sqs = require('./lib/sqs.js');
const appConfig = require('./config/app-config.json');

const server = http.createServer(async (req, res) => {
  const reqUri = url.parse(req.url).pathname;

  if (req.method === 'OPTIONS') {
    // Chrome の CORS 回避
    res.writeHead(200, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'POST',
      'Access-Control-Allow-Headers':'content-type'
    });
    res.end();
  } else if (req.method === 'POST') {
    let body = '';
    req.on('data', data => {
      body += data;
    });
    req.on('end', async () => {
      const reqBody = JSON.parse(body);
      const addItemUri = appConfig.api.addItemUri;
      const dlTable = appConfig.ddb.dlTable;
      const favTable = appConfig.ddb.favTable;
      const reqTag = reqBody.tag;
      const reqTable = reqBody.table;

      switch (reqUri) {
        // アイテムの追加/削除処理
        case addItemUri:
          // 入力チェック
          let oppTable;

          switch (reqTable) {
            case favTable:
              // Favorite に登録する場合は既存のDLフォルダを削除
              const dlDir = appConfig.fs.dlDir;
              try {
                fs.removeSync(path.join(dlDir, reqTag));
              } catch(err) {
                console.log(err);
              }

              // DBの更新/削除
              oppTable = dlTable;
              try {
                await ddbUpdate(reqTable, reqTag);
                await ddbDelete(oppTable, reqTag);
                res.writeHead(200, {'Content-Type': 'application/json;charset=utf-8'});
                res.write(JSON.stringify({'success': true, 'table': reqTable, 'tag': reqTag}));
              } catch(err) {
                res.writeHead(503, {'Content-Type': 'application/json;charset=utf-8'});
                res.write(JSON.stringify({'success': false, 'table': reqTable, 'tag': reqTag}));
              }

              // MQのリクエストキューに送信
              const priorFavQueUrl = appConfig.sqs.priorFavQueUrl;
              await sendMessage(priorFavQueUrl, reqTag);

              break;

            case dlTable:
              // DBの更新/削除
              oppTable = favTable;
              try {
                await ddbUpdate(reqTable, reqTag);
                await ddbDelete(oppTable, reqTag);
                res.writeHead(200, {'Content-Type': 'application/json;charset=utf-8'});
                res.write(JSON.stringify({'success': true, 'table': reqTable, 'tag': reqTag}));

              } catch(err) {
                res.writeHead(503, {'Content-Type': 'application/json;charset=utf-8'});
                res.write(JSON.stringify({'success': false, 'table': reqTable, 'tag': reqTag}));
              }

              // MQのリクエストキューに送信
              const priorDlQueUrl = appConfig.sqs.priorDlQueUrl;
              await sendMessage(priorDlQueUrl, reqTag);

              break;

            default:
              break;
          }

          break;
      }

      res.end();
    });
  } else {
    // リクエストの例外処理
    const exceptMsg = appConfig.api.exceptMsg;
    res.writeHead(400, {'Content-Type': 'application/json;charset=utf-8'});
    res.write(JSON.stringify({'success': false, 'status': exceptMsg}));
    res.end();
  }
});

// DB更新
const ddbUpdate = async (reqTable, reqTag) => {
  const updParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.updateItem(updParams);
    console.log('update:' ,updParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}

// DB削除
const ddbDelete = async (reqTable, reqTag) => {
  const delParams = {
    TableName: reqTable,
    Key: {
      'tag': reqTag
    }
  };

  try {
    await ddb.deleteItem(delParams);
    console.log('delete:', delParams);
  } catch(err) {
    console.log(JSON.stringify(err));
    throw err;
  }
}

// MQ送信
const sendMessage = async (queueUrl, reqTag) => {
  const sendParams = {
    MessageBody: JSON.stringify({"tag": reqTag, "last":"0"}),
    QueueUrl: queueUrl,
    DelaySeconds: 0,
  };

  try {
    await sqs.sendMsg(sendParams);
    console.log(sendParams);
  } catch(err) {
    console.log(err);
  }
}

// サーバ起動
server.listen(3000);
console.log('API Server started.');
