window.onload = () => {
  // 不要コンテンツの非表示
  document.querySelectorAll('[class*=attachment-thumbnail]').forEach(img => {
    img.style.display = "none";
  });

  // お気に入り済みコンテンツのグレーアウト
  document.querySelectorAll('[class*="favorited"]').forEach(img => {
    img.style.webkitFilter = "saturate(0%)";

    const disabledLink = () => {
      window.open(img.parentNode.linkUrl);
    };
    img.parentNode.linkUrl = img.parentNode.href;
    img.parentNode.removeAttribute('href');
    img.parentNode.addEventListener('click', disabledLink);
  });

  // 検索のオプションを追加、一部の文字サイズを変更
  document.querySelectorAll(
    '[class="tag-type-artist"] > a, [class="tag-type-studio"] > a'
  ).forEach(link => {
    link.style.fontSize = '120%';
    link.setAttribute('href', link.getAttribute('href') +
        '+order:quality+-rating:safe');
  });

  // 検索のオプションを追加
  const options = ' order:quality -rating:safe';
  let box = document.getElementById('tags');
  if (box && box !== undefined) {
    if (!box.value.includes(options)) {
      box.value += options;
    }
  }
};

// DOM変化時の処理
const observer = new MutationObserver(() => {
  document.querySelectorAll('[class*="favorited"]').forEach(img => {
    img.parentNode.href = 'javascript:disabledLink();void(0)';
    img.style.webkitFilter = "saturate(0%)";
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
