// リンクを取得してバックグラウンドへ送信
chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case 'open':
      document.querySelectorAll('[class*="fa-magnet"]').forEach(link => {
        chrome.runtime.sendMessage({
          type: "url",
          value: link.parentNode.href
        });
      });

      break;
  }
});
