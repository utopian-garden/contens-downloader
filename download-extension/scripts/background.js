// addItem リクエストの発行
const addRequest = (info, addTab) => {
  const tagKey = decodeURIComponent(info.linkUrl.split('=').pop().split('+').shift());

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
  onclick: info => {
    addRequest(info, 'Download');
  }
});

// コンテキストメニューの Favorite をクリックした場合
chrome.contextMenus.create({
  title: "Favorite",
  contexts: ["link"],
  type: "normal",
  onclick: info => {
    addRequest(info, 'Favorite');
  }
});

// コンテキストメニューの Open をクリックした場合
chrome.contextMenus.create({
  title: "Link Open",
  contexts: ["page"],
  type: "normal",
  onclick: info => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {'type':'open'});
    });
  }
});
