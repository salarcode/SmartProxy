import { jQuery } from "../../lib/External";

export class CommonUi {

    public static onDocumentReady(callback: Function) {
        jQuery(document).ready(callback);
    }

    //** localize the ui */
    public static localizeHtmlPage() {

        function replace_i18n(obj, tag) {
            let msg = browser.i18n.getMessage(tag.trim());

            if (msg && msg != tag) obj.innerHTML = msg;
        }

        // page direction
        let dir = browser.i18n.getMessage("uiDirection");
        if (dir) {
            jQuery(document.body).addClass(dir).css("direction", dir);
        }

        // Localize using data-localize tags
        let data = document.querySelectorAll("[data-localize]");

        for (let i = 0; i < data.length; i++) {
            const obj: any = data[i];
            let tag = obj.dataset["localize"];

            replace_i18n(obj, tag);
        }
    }
}