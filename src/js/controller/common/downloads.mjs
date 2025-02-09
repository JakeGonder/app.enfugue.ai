/** @module controller/common/downloads */
import { isEmpty, waitFor, humanSize, humanDuration } from "../../base/helpers.mjs";
import { ElementBuilder } from "../../base/builder.mjs";
import { Controller } from "../base.mjs";
import { View } from "../../view/base.mjs";

const E = new ElementBuilder({
    "downloadStatus": "enfugue-download-status",
    "downloadCount": "enfugue-download-count",
    "download": "enfugue-download",
    "downloadName": "enfugue-download-name",
    "downloadProgress": "enfugue-download-progress",
    "downloadSize": "enfugue-download-size",
    "downloadTime": "enfugue-download-time"
});

/**
 * This is the view that displays all downloads
 */
class DownloadsView extends View {
    /**
     * @var string The tag name
     */
    static tagName = "enfugue-downloads";

    constructor(config, downloads) {
        super(config);
        this.downloads = downloads;
    }

    /**
     * Updates memory and DOM from retrieved downloads
     */
    update(downloads) {
        if (this.node === undefined) {
            this.downloads = downloads;
            return;
        }
        for (let download of downloads) {
            let downloadNode = this.node.find(`#DL${download.filename.replace('.', '_')}`);
            if (isEmpty(downloadNode)) {
                this.node.append(this.createDownloadNode(download));
            } else {
                downloadNode.find(E.getCustomTag("downloadSize")).content(this.getDownloadSizeText(download));
                downloadNode.find(E.getCustomTag("downloadProgress")).css(this.getDownloadProgressCSS(download));
                downloadNode.find(E.getCustomTag("downloadTime")).content(this.getDownloadTimeText(download));
            }
        }
    }

    /**
     * Gets the linear gradient CSS that should be displayed in the node for this download
     */
    getDownloadProgressCSS(download) {
        if (isEmpty(download.total)) {
            return {};
        }
        let downloadPercent = download.downloaded / download.total;
        if (downloadPercent === 1) {
            return {
                "background-color": "var(--theme-color-primary)",
                "background-image": "none"
            };
        } else {
            return {
                "background-color": "var(--darker-color)",
                "background-image": `linear-gradient(to right, var(--theme-color-primary) 0%, var(--theme-color-primary) ${(downloadPercent*100).toFixed(1)}%, transparent calc(${(downloadPercent*100).toFixed(1)}% + 1px))`
            };
        }
    }

    /**
     * Gets the text to say regarding size when showing a download
     */
    getDownloadSizeText(download) {
        if (isEmpty(download.total)) {
            return "Size Unknown";
        } else if (download.downloaded === download.total) {
            return `Downloaded ${humanSize(download.total)}`;
        } else {
            return `Downloaded ${humanSize(download.downloaded)}/${humanSize(download.total)}`;
        }
    };

    /**
     * Gets the text to say regarding timing when showing a download
     */
    getDownloadTimeText(download) {
        if (isEmpty(download.total)) {
            return "Download Pending";
        } else if (download.downloaded === download.total) {
            let bytesPerSecond = download.total / download.elapsed;
            return `Complete in ${humanDuration(download.elapsed)} (${humanSize(bytesPerSecond)}/sec)`;
        } else {
            let bytesPerSecond = download.downloaded / download.elapsed,
                remainingBytes = download.total - download.downloaded,
                remainingSeconds = remainingBytes / bytesPerSecond;
            
            return `${humanDuration(download.elapsed)} elapsed, ${humanDuration(remainingSeconds)} remaining (${humanSize(bytesPerSecond)}/sec)`;
        }
    };

    /**
     * Creates a new node for an individual download
     */
    createDownloadNode(download) {
        return E.download().id(`DL${download.filename.replace('.', '_')}`).content(
            E.downloadName().content(download.filename),
            E.downloadSize().content(this.getDownloadSizeText(download)),
            E.downloadProgress().css(this.getDownloadProgressCSS(download)),
            E.downloadTime().content(this.getDownloadTimeText(download))
        );
    }

    /**
     * On build, append known downloads
     */
    async build() {
        let node = await super.build();
        for (let download of this.downloads) {
            node.append(this.createDownloadNode(download));
        }
        return node;
    }
}

/**
 * This class manages downloads, queueing, etc.
 */
class DownloadsController extends Controller {
    /**
     * @var int The width of the downloads window
     */
    static downloadsWindowWidth = 600;

    /**
     * @var int The height of the downloads window
     */
    static downloadsWindowHeight = 500;

    /**
     * Gets the configured or default timing interval
     */
    get interval() {
        return this.config.model.downloads.interval || 5000;
    }
    
    /**
     * Starts the timer for checking downloads again
     */
    startTimer() {
        this.timer = setTimeout(() => this.checkDownloads(), this.interval);
    }

    /**
     * Gets the CSS to display in the header regarding the most downloaded item
     */
    getDownloadStatusCSS(ratio) {
        return {
            "background-image": `conic-gradient(from 180deg, var(--theme-color-primary) ${(ratio*100).toFixed(1)}%, transparent ${(ratio*100).toFixed(1)}%)`
        };
    }

    /**
     * Starts a download
     */
    async download(type, url, filename) {
        let payload = {
            "type": type,
            "url": url,
            "filename": filename
        };
            
        try {
            let response = await this.model.post("download", null, null, payload);
            this.checkDownloads();
        } catch(e) {
            if (!isEmpty(e) && e.status == 409) {
                if (await this.confirm(`File '${filename}' exists. Overwrite?`)) {
                    payload.overwrite = true;
                    response = await this.model.post("download", null, null, payload);
                }
            } else {
                let errorMessage = isEmpty(e) 
                    ? "Couldn't communicate with server." 
                    : isEmpty(e.detail)
                       ? `${e}`
                       : e.detail;
                this.notify("error", "Couldn't Download", errorMessage);
            }
        }
    }

    /**
     * Shows the downloads
     */
    async showDownloads() {
        if (!isEmpty(this.downloadWindow)) {
            this.downloadWindow.focus();
        } else {
            let downloadsView = new DownloadsView(this.config, this.currentDownloads);
            this.downloadWindow = await this.spawnWindow(
                "Downloads", 
                downloadsView, 
                this.constructor.downloadsWindowWidth,
                this.constructor.downloadsWindowHeight
            );
            this.downloadWindow.onClose(() => { delete this.downloadWindow; });
        }
    }

    /**
     * Calls the API to check downloads, then report on the page
     */
    async checkDownloads() {
        clearTimeout(this.timer);
        this.currentDownloads = await this.model.get("download");

        let activeDownloads = 0,
            highestDownloadRatio = 0;

        for (let download of this.currentDownloads) {
            if (download.status === "downloading") {
                let thisDownloadRatio = download.downloaded / download.total;
                if (thisDownloadRatio > highestDownloadRatio) {
                    highestDownloadRatio = thisDownloadRatio;
                }
                activeDownloads++;
            }
        }

        if (activeDownloads > 0) {
            this.downloadStatusIndicator
                .removeClass("inactive")
                .css(this.getDownloadStatusCSS(highestDownloadRatio))
                .data("tooltip", `${(highestDownloadRatio*100).toFixed(2)}%`)
                .find(E.getCustomTag("downloadCount")).content(`${activeDownloads}`).show();
            this.startTimer();
        } else {
            this.downloadStatusIndicator.data("tooltip", "No Active Downloads").addClass("inactive").find(E.getCustomTag("downloadCount")).content("").hide();
        }

        if (!isEmpty(this.downloadWindow)) {
            this.downloadWindow.content.update(this.currentDownloads);
        }
    }

    /**
     * On initialization, append status indicator to header
     */
    async initialize() {
        this.downloadStatusIndicator = E.downloadStatus().content(
            E.i().class("fa-solid fa-download"),
            E.downloadCount().hide()
        ).on("click", () => this.showDownloads());
        await this.checkDownloads();
        document.querySelector("header").appendChild(await this.downloadStatusIndicator.render());
    }
}

export { DownloadsController };
