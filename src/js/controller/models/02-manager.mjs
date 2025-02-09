/** @module controller/model/manager */
import { MenuController } from "../menu.mjs";

/**
 * Shows the model manager, which is kept as a common
 * controller so that we don't spawn a bunch of windows.
 */
class ModelManagerController extends MenuController {
    /**
     * @var string The name in the UI
     */
    static menuName = "Model Manager";

    /**
     * @var string The class of the icon in the UI
     */
    static menuIcon = "fa-solid fa-table-list";

    /**
     * When clicked, show manager
     */
    async onClick() {
        this.application.modelManager.showManager();
    }
}

export { ModelManagerController as MenuController }
