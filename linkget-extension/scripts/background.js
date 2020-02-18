// コンテキストメニューの Get をクリックした場合
chrome.contextMenus.create({
  title: "Link Get",
  contexts: ["page"],
  type: "normal",
  onclick: info => {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
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
