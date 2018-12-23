## SmartProxy

[![license](https://img.shields.io/github/license/salarcode/SmartProxy.svg)](https://github.com/salarcode/SmartProxy/blob/master/LICENSE) [![Travis](https://img.shields.io/travis/salarcode/SmartProxy.svg)]() [![Crowdin](https://d322cqt584bo4o.cloudfront.net/smartproxy/localized.svg)](https://crowdin.com/project/smartproxy)

#### Download From Store

 * [Firefox Extension](https://addons.mozilla.org/en-US/firefox/addon/smartproxy) [![Mozilla Add-on](https://img.shields.io/amo/v/smartproxy.svg)](https://addons.mozilla.org/en-US/firefox/addon/smartproxy/)
 * [Chrome Extension](https://chrome.google.com/webstore/detail/smartproxy/jogcnplbkgkfdakgdenhlpcfhjioidoj) [![Chrome Web Store](https://img.shields.io/chrome-web-store/v/jogcnplbkgkfdakgdenhlpcfhjioidoj.svg)](https://chrome.google.com/webstore/detail/smartproxy/jogcnplbkgkfdakgdenhlpcfhjioidoj)

#### Upcoming release

Currently I'm rewriting the proxy from ground up using Typescript and I'm also implementing the *smart features* that was the initial intention of this extension.

* Apply proxy to a certain tab and all resources in it.
* UI will be based on Bootstrap 4.
* More proxy server options.
* More proxy rule options.

It is buggy and is in its early stage and may not even load, but you can find it here: https://github.com/salarcode/SmartProxy/tree/SmartProxy-ts

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
- Backup/Restore settings and rules

#### How to translate
If you are interested to have SmartProxy in your language or it is not translated completely you can head to https://crowdin.com/project/smartproxy then login with Google or Github and there by clicking your language start translating right away.

#### How to build/test:
You don't need to build to test the extension, but if you want you should run Travsis.
To debug and test in Firefox create a copy of "manifest-firefox.json" and name it "manifest.json". For Chrome do the same but use "manifest-chrome.json" to create the copy.

To install in **Firefox** follow these instructions:

https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Temporary_Installation_in_Firefox

1.	open Firefox
2.	enter "about:debugging" in the URL bar
3.	click "Load Temporary Add-on"
4.	open the extension's directory and select any file inside the extension.

To install in **Google Chrome** follow these instructions:

https://developer.chrome.com/extensions/getstarted#unpacked

1.	Open the Extension Management page by navigating to chrome://extensions.
2.	The Extension Management page can also be opened by clicking on the Chrome menu, hovering over More Tools then selecting Extensions.
3.	Enable Developer Mode by clicking the toggle switch next to Developer mode.
4.	Click the LOAD UNPACKED button and select the extension directory.

