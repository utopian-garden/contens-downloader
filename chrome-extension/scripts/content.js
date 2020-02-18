window.addEventListener('load', () => {
  // リンクの検索オプションを追加
  document.querySelectorAll(
    '[class="tag-type-artist"] > a, [class="tag-type-studio"] > a'
  ).forEach(link => {
    link.setAttribute('href', link.getAttribute('href') +
        '+order:quality+-rating:safe');
  });

  // 検索ボックスのオプションを追加
  const options = ' order:quality -rating:safe';
  let box = document.getElementById('tags');
  if (box && box !== undefined) {
    if (!box.value.includes(options)) {
      box.value += options;
    }
  }

  // 動画のデフォルト設定の制御
  let video = document.getElementById('image');
  if (video && video !== undefined) {
    if (video.tagName === 'VIDEO') {
      video.volume = 0.2;
      video.loop = false;
    }
  }
});

// DOM変化時の処理
const observer = new MutationObserver(() => {
  document.querySelectorAll('[class*="favorited"]').forEach(img => {
    const disabledLink = () => {
      window.open(img.parentNode.linkUrl);
    };
    img.parentNode.linkUrl = img.parentNode.href;
    img.parentNode.removeAttribute('href');
    img.parentNode.addEventListener('click', disabledLink);
  });
});

// 要素の監視を開始
const elem = document.getElementById('recommendations');
const config = {
  attributes: true,
  childList: true,
  characterData: true
};

if (elem !== undefined && elem) {
  observer.observe(elem, config);
}

// リンクを取得して開く
chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case 'open':
      document.querySelectorAll('[class*="preview"]:not([class*="favorited"])').forEach(link => {
        window.open(link.parentNode.href);
      });

      break;
  }
});

// リンクを取得してバックグラウンドへ送信
chrome.runtime.onMessage.addListener(msg => {
  switch (msg.type) {
    case 'get':
      document.querySelectorAll('[class*="fa-magnet"]').forEach(link => {
        chrome.runtime.sendMessage({
          type: "url",
          value: link.parentNode.href
        });
      });

      break;
  }
});
