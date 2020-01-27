'use strict';

const fs = require('fs-extra');
const rp = require('request-promise');
const config = require('../config/app-config.json');

exports.getToken = async () => {
  const userAgent = config.req.common.userAgent;
  const authUrl = config.req.auth.authUrl;
  const userName = config.req.auth.userName;
  const passWord = config.req.auth.passWord;
  const authPrefix = config.req.auth.authPrefix;

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

exports.searchPost = async (tagKey, pageNum, authToken) => {
  const userAgent = config.req.common.userAgent;
  const searchUrl = config.req.search.searchUrl;
  const searchParam = config.req.search.searchParam;

  const searchOptions = {
    method: 'GET',
    uri: searchUrl + encodeURI(tagKey) + searchParam + pageNum,
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

exports.favPost = async (postId, authToken) => {
  const userAgent = config.req.common.userAgent;
  const favUrl = config.req.fav.favUrl;
  const favParam = config.req.fav.favParam;

  const favOptions = {
    method: 'POST',
    uri: favUrl + postId + favParam,
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

exports.votePost = async (postId, authToken) => {
  const userAgent = config.req.common.userAgent;
  const voteUrl = config.req.vote.voteUrl;
  const voteParam = config.req.vote.voteParam;

  const voteOptions = {
    method: 'DELETE',
    uri: voteUrl + postId + voteParam,
    headers: {
      'User-Agent': userAgent,
      'Authorization': authToken
    },
  };

  try {
    console.log(await rp(voteOptions));
  } catch(err) {
    throw err;
  }
}

exports.dlContent = async (filePath, fileUrl, refererUrl) => {
  const userAgent = config.req.common.userAgent;

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
