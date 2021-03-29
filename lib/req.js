'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const axios = require('axios');
require('console-stamp')(console, { pattern: 'yyyy/mm/dd HH:MM:ss' });

// 設定ファイル
const appConfig = require('../config/app-config.json');

// AuthToken の取得
exports.getToken = async () => {
  const userAgent = appConfig.req.common.userAgent;
  const authUrl = appConfig.req.auth.authUrl;
  const userName = appConfig.req.auth.userName;
  const passWord = appConfig.req.auth.passWord;
  const authPrefix = appConfig.req.auth.authPrefix;
  const authOptions = {
    method: 'POST',
    url: authUrl,
    headers: {
      'User-Agent': userAgent
    },
    json: true,
    data: {
      login: userName,
      password: passWord
    }
  };

  try {
    return authPrefix + (await axios.request(authOptions)).data.access_token;
  } catch(err) {
    throw err;
  }
}

// ポストの検索
exports.searchPost = async (tagKey, pageNum, searchParam, authToken) => {
  const searchUrl = appConfig.req.search.searchUrl + tagKey + searchParam +
      pageNum;
  const userAgent = appConfig.req.common.userAgent;
  const searchOptions = {
    method: 'GET',
    url: searchUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    return (await axios.request(searchOptions)).data;
  } catch(err) {
    throw err;
  }
}

// タグの検索
exports.searchTag = async (tagCode, pageNum, authToken) => {
  const searchUrl = appConfig.req.search.tagSearchUrl + tagCode +
      appConfig.req.search.tagSearchParam + pageNum;
  const userAgent = appConfig.req.common.userAgent;
  const searchOptions = {
    method: 'GET',
    url: searchUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    return (await axios.request(searchOptions)).data;
  } catch(err) {
    throw err;
  }
}

/* ポストのお気に入り登録
exports.favPost = async (postId, authToken) => {
  const favUrl = appConfig.req.fav.favUrl + postId +
      appConfig.req.fav.favParam;
  const userAgent = appConfig.req.common.userAgent;
  const favOptions = {
    method: 'POST',
    url: favUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    await axios.request(favOptions);
  } catch(err) {
    throw err;
  }
}
*/

// ポストのコンテンツダウンロード
exports.dlContent = async (filePath, fileUrl, refererUrl) => {
  const userAgent = appConfig.req.common.userAgent;
  const dlOptions = {
    method: 'GET',
    url: fileUrl,
    encoding: null,
    headers: {
      'User-Agent': userAgent,
      'Referer': refererUrl
    },
    responseType: 'arraybuffer'
  };

  try {
    fs.outputFileSync(filePath, (await axios.request(dlOptions)).data);
  } catch(err) {
    throw err;
  }
}

// ポストのタグ追加
exports.tagPut = async (postId, reqJson, authToken) => {
  const tagUrl = appConfig.req.tag.tagUrl + postId +
      appConfig.req.tag.tagParam;
  const userAgent = appConfig.req.common.userAgent;
  const tagOptions = {
    method: 'PUT',
    url: tagUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    },
    json: true,
    data: reqJson
  };

  try {
    const result = (await axios.request(tagOptions)).data;
    console.info(JSON.stringify({"success": result.success}));
  } catch(err) {
    throw err;
  }
}
