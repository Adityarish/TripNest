const defaultUrl = "http://localhost:3000/dashboard";
const field = document.querySelector("#url");
chrome.storage.sync.get({ tripnestUrl: defaultUrl }, ({ tripnestUrl }) => { field.value = tripnestUrl; });
document.querySelector("#save").addEventListener("click", () => chrome.storage.sync.set({ tripnestUrl: field.value || defaultUrl }));
document.querySelector("#open").addEventListener("click", () => chrome.storage.sync.get({ tripnestUrl: defaultUrl }, ({ tripnestUrl }) => chrome.tabs.create({ url: tripnestUrl })));
