// test
const shiftRequest = (buttonId) => {
  let inputTag = document.getElementById('tag');
  let fromTab, toTab;
  if (buttonId === 'favorite') {
    fromTab = 'Download';
    toTab = 'Favorite';
  } else {
    fromTab = 'Favorite';
    toTab = 'Download';
  }

  const xhr = new XMLHttpRequest();
  xhr.open("POST", 'http://localhost:3000/shiftItem');
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.send(JSON.stringify({'tag':inputTag.value, 'from':fromTab, 'to':toTab}));

  inputTag.value = "";
}

// test
document.getElementById('download').addEventListener('click', () => {
  shiftRequest('download');
}, false);

// test
document.getElementById('favorite').addEventListener('click', () => {
  shiftRequest('favorite');
}, false);
