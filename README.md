## SmartProxy

[![license](https://img.shields.io/github/license/salarcode/SmartProxy.svg)](https://github.com/salarcode/SmartProxy/blob/master/LICENSE) [![Travis](https://img.shields.io/travis/salarcode/SmartProxy.svg)]() [![Crowdin](https://d322cqt584bo4o.cloudfront.net/smartproxy/localized.svg)](https://crowdin.com/project/smartproxy)

#### Version 1.0 has just released 🎉
Please use links below to access it from the browser markets.
Head over here to read the [release notes and change logs](https://github.com/salarcode/SmartProxy/releases/tag/v1.0.x).


#### Download From Store

 * [![Mozilla Add-on](https://img.shields.io/amo/v/smartproxy.svg)](https://addons.mozilla.org/en-US/firefox/addon/smartproxy/) [Firefox Desktop Extension](https://addons.mozilla.org/en-US/firefox/addon/smartproxy)
 * [![Mozilla Add-on](https://img.shields.io/amo/v/smartproxy.svg)](https://addons.mozilla.org/en-US/firefox/addon/smartproxy/) [Firefox for Android Extension](https://github.com/salarcode/SmartProxy/wiki/Install-on-Firefox-Android)
 * [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/jogcnplbkgkfdakgdenhlpcfhjioidoj.svg)](https://chrome.google.com/webstore/detail/smartproxy/jogcnplbkgkfdakgdenhlpcfhjioidoj) [Chrome Extension](https://chrome.google.com/webstore/detail/smartproxy/jogcnplbkgkfdakgdenhlpcfhjioidoj)
 * [![Edge Extension](https://img.shields.io/badge/Edge%20Extension-v1.0.x-0884D8)](https://microsoftedge.microsoft.com/addons/detail/canbjhbbhfggbdfgpddpnckdjgfcbnpb) [Edge Extension](https://microsoftedge.microsoft.com/addons/detail/canbjhbbhfggbdfgpddpnckdjgfcbnpb)
 * [![Thunderbird Add-on](https://img.shields.io/badge/thunderbird%20add--on-v1.0.x-blue)](https://addons.thunderbird.net/en-US/thunderbird/addon/smartproxy/) [Thunderbird Extension](https://addons.thunderbird.net/en-US/thunderbird/addon/smartproxy/)

#### What is SmartProxy
SmartProxy is a Firefox/Chrome extension based on WebExtensions/Chrome Extensions technology.

It uses patterns to automatically define rules to proxify your web experience. With SmartProxy, you don't need to change your proxy manually and turn it on and off. You can add your desired website to the proxy rules list with just one click. After that, when you visit that specific website, SmartProxy will act and all you data for that website will be transferred though the proxy, without you doing anything.

What's more, SmartProxy is inspired by AutoProxy and AutoProxy-ng and that are now considered legacy. SmartProxy is completely written from ground up using WebExtensions and provides more functionality than those proxies.

##### Highlights
- Automatically detect when to enable or disable proxy to certain websites based on rule patterns
- Easily switch between many proxy servers as your active proxy server setting
- Easily with one click add current site to your proxy list
- View current website items and requests and decide whether to proxify them with one click
- Easily switch between proxy modes and enable proxy for all domains
- Proxy API is supported through subscriptions
- Backup/Restore settings and rules

#### How to translate
If you are interested to have SmartProxy in your language or it is not translated completely you can head to https://crowdin.com/project/smartproxy then login with Google or Github and there by clicking your language start translating right away.

#### How to build/test:
Requirements

    Node.js
    Firefox or Chrome browser

Run the app

    npm install
    npm run build-ff:watch

To install in **Firefox** follow these instructions:

https://extensionworkshop.com/documentation/develop/temporary-installation-in-firefox/

1.	build the project using `npm run build-ff` command
2.	open Firefox
3.	enter "about:debugging" in the URL bar
4.	click "Load Temporary Add-on"
5.	open the extension's 'build' directory and select any file inside the extension.

To install in **Google Chrome** follow these instructions:

https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked

1.	build the project using `npm run build-ch` command
2.	Open the Extension Management page by navigating to chrome://extensions.
3.	The Extension Management page can also be opened by clicking on the Chrome menu, hovering over More Tools then selecting Extensions.
4.	Enable Developer Mode by clicking the toggle switch next to Developer mode.
5.	Click the LOAD UNPACKED button and select the extension's 'build' directory.

