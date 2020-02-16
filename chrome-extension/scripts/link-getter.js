chrome.runtime.onMessage.addListener(msg => {
  document.querySelectorAll('[class*="fa-magnet"]').forEach(link => {
    chrome.runtime.sendMessage({
      type: "url",
      value: link.parentNode.href
    });
  });
});
