import { jQuery } from "../../lib/External";
import { browser } from "../../lib/environment";

export class CommonUi {

    public static downloadData(data: any, fileName: string) {

        let downloadUrl = "data:application/json;charset=utf-8," + encodeURIComponent(data);
        let a = jQuery("<a/>")
            .attr("download", fileName || "")
            .attr("href", downloadUrl);
        a[0].dispatchEvent(new MouseEvent("click"));
    }

    public static onDocumentReady(callback: Function) {
        jQuery(document).ready(callback);
    }

    public static selectFileOnTheFly(form: HTMLElement, inputName: string, onFileSelected: Function, acceptFormat?) {
        ///<summary>Select a file from a detached file input</summary>
        let fileContainer = jQuery(`<div style='display: none'><input style='display: none' type=file accept='${acceptFormat || ""}' class='' name='${inputName}'/></div>`);
        let fileInput = fileContainer.find("input");

        form = jQuery(form);
        form.append(fileContainer);

        function onFile(evt) {
            fileContainer.remove();

            let files = evt.target.files;
            if (!files.length)
                return;

            if (onFileSelected) {
                onFileSelected(fileInput, files);
            }
        }
        fileInput.on("change", onFile);
        fileInput.trigger("click");
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