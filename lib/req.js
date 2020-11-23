'use strict';

// 依存パッケージ
const fs = require('fs-extra');
const rp = require('request-promise');

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
    uri: authUrl,
    headers: {
      'User-Agent': userAgent
    },
    json: {
      login: userName,
      password: passWord
    }
  };

  try {
    return authPrefix + (await rp(authOptions)).access_token;
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
    uri: searchUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    return JSON.parse(await rp(searchOptions));
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
    uri: searchUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    return JSON.parse(await rp(searchOptions));
  } catch(err) {
    throw err;
  }
}

// ポストのお気に入り登録
exports.favPost = async (postId, authToken) => {
  const favUrl = appConfig.req.fav.favUrl + postId +
      appConfig.req.fav.favParam;
  const userAgent = appConfig.req.common.userAgent;
  const favOptions = {
    method: 'POST',
    uri: favUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    }
  };

  try {
    console.log(await rp(favOptions));
  } catch(err) {
    throw err;
  }
}

// ポストのコンテンツダウンロード
exports.dlContent = async (filePath, fileUrl, refererUrl) => {
  const userAgent = appConfig.req.common.userAgent;
  const dlOptions = {
    method: 'GET',
    uri: fileUrl,
    encoding: null,
    headers: {
      'User-Agent': userAgent,
      'Referer': refererUrl
    }
  };

  try {
    fs.outputFileSync(filePath, await rp(dlOptions));
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
    uri: tagUrl,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    },
    json: reqJson
  };

  try {
    const result = await rp(tagOptions);
    console.log(JSON.stringify({"success": result.success}));
  } catch(err) {
    throw err;
  }
}
