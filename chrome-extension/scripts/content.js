window.addEventListener('load', () => {
  // お気に入り済みコンテンツのリンクの挙動を変更
  document.querySelectorAll('[class*="favorited"]').forEach(img => {
    const disabledLink = () => {
      window.open(img.parentNode.linkUrl);
    };
    img.parentNode.linkUrl = img.parentNode.href;
    img.parentNode.removeAttribute('href');
    img.parentNode.addEventListener('click', disabledLink);
  });

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

  // デフォルト音量の制御
  let video = document.getElementById('image');
  if (video.tagName === 'VIDEO') {
    video.volume = 0.1;
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
