// addItem リクエストの発行
const addRequest = (tagKey, addTab) => {
  fetch('http://localhost:3000/addItem', {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      'table': addTab,
      'tag': tagKey
    }),
  });
}

// コンテキストメニューの Download をクリックした場合
chrome.contextMenus.create({
  title: "Download",
  contexts: ["link"],
  type: "normal",
  documentUrlPatterns: ["*://chan.sankakucomplex.com/*"],
  onclick: info => {
    const tagKey = decodeURIComponent(info.linkUrl.split('=').pop().split('+').shift());
    addRequest(tagKey, 'Download');
  }
});

// コンテキストメニューの Favorite をクリックした場合
chrome.contextMenus.create({
  title: "Favorite",
  contexts: ["link"],
  type: "normal",
  documentUrlPatterns: ["*://chan.sankakucomplex.com/*"],
  onclick: info => {
    const tagKey = decodeURIComponent(info.linkUrl.split('=').pop().split('+').shift());
    addRequest(tagKey, 'Favorite');
  }
});

// コンテキストメニューの Download をクリックした場合
chrome.contextMenus.create({
  title: "Download",
  contexts: ["page"],
  type: "normal",
  documentUrlPatterns: ["*://chan.sankakucomplex.com/*post/show/*"],
  onclick: info => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, {'type':'download'});
    });
  }
});

// コンテキストメニューの Favorite をクリックした場合
chrome.contextMenus.create({
  title: "Favorite",
  contexts: ["page"],
  type: "normal",
  documentUrlPatterns: ["*://chan.sankakucomplex.com/*post/show/*"],
  onclick: info => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, {'type':'favorite'});
    });
  }
});

// コンテキストメニューの Open をクリックした場合
chrome.contextMenus.create({
  title: "Open links",
  contexts: ["page"],
  type: "normal",
  documentUrlPatterns: ["*://chan.sankakucomplex.com/*&tags*"],
  onclick: info => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, {'type':'open'});
    });
  }
});

// コンテキストメニューの Get をクリックした場合
chrome.contextMenus.create({
  title: "Get links",
  contexts: ["page"],
  type: "normal",
  documentUrlPatterns: ["*://*.nyaa.si/*"],
  onclick: info => {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      chrome.tabs.sendMessage(tabs[0].id, {'type':'get'});
    });
  }
});

// コンテンツからメッセージを受信した場合
chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case "url":
      const url = msg.value;
      fetch('http://localhost:3000/getLink', {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          'url': url
        }),
      });

      break;
  }
});
