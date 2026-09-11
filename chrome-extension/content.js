// Content script — runs on job application pages
// Listens for fill commands from the popup

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ ready: true })
  }
})
