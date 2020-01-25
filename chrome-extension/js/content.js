window.onload = () => {
  // お気に入り済みコンテンツのグレーアウト
  document.querySelectorAll('[class*="favorited"], [class*=attachment-thumbnail]').forEach((img) => {
    img.style.display = 'none';
  });

  // 検索のオプションを追加、一部の文字サイズを変更
  const tag = document.querySelectorAll('[class="tag-type-artist"] > a, [class="tag-type-studio"] > a');
  tag.forEach((link) => {
    link.style.fontSize = '120%';
    link.setAttribute('href', link.getAttribute('href') + '+order:quality+-rating:safe');
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
  document.querySelectorAll('[class*="favorited"]').forEach((img) => {
    img.style.display = 'none';
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
