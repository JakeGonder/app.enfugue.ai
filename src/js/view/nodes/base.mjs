import { View } from '../base.mjs';
import { FormView } from '../forms/base.mjs';
import { InputView } from '../forms/input.mjs';
import { ElementBuilder } from '../../base/builder.mjs';
import { isEmpty, deepClone, camelCase, sleep } from '../../base/helpers.mjs';
import { Point, Drawable } from '../../graphics/geometry.mjs';

const E = new ElementBuilder({
    nodeContainer: 'enfugue-node-container',
    nodeContents: 'enfugue-node-contents',
    nodeHeader: 'enfugue-node-header',
    nodeName: 'enfugue-node-name',
    nodeButton: 'enfugue-node-button',
    nodeOptionsContents: 'enfugue-node-options-contents',
    nodeOptionsInputsOutputs: 'enfugue-node-options-inputs-outputs',
    nodeOptions: 'enfugue-node-options',
    nodeInputs: 'enfugue-node-inputs',
    inputModes: 'enfugue-node-input-modes',
    nodeOutputs: 'enfugue-node-outputs',
    nodeInput: 'enfugue-node-input',
    nodeInputGroup: 'enfugue-node-input-group',
    nodeOutput: 'enfugue-node-output',
    nodeOutputGroup: 'enfugue-node-output-group'
});

/**
 * For general node functionality (movement, resizing),
 * define an enum for cursor modes.
 */
class NodeCursorMode {
    static NONE = 0;
    static MOVE = 1;
    static RESIZE_N = 2;
    static RESIZE_NE = 3;
    static RESIZE_E = 4;
    static RESIZE_SE = 5;
    static RESIZE_S = 6;
    static RESIZE_SW = 7;
    static RESIZE_W = 8;
    static RESIZE_NW = 9;
}

/**
 * NodeView is an individual node on the node editor.
 *
 * This provides the base class for default operations,
 * which includes moving, resizing, and removing.
 */
class NodeView extends View {
    /**
     * @var string The tag name of the view.
     */
    static tagName = 'enfugue-node';

    /**
     * @var int The number of pixels outside of the node to allow for edge handling.
     */
    static edgeHandlerTolerance = 10;

    /**
     * @var bool Whether or not this node can be closed. Default true.
     */
    static canClose = true;

    /**
     * @var bool Whether or not this node can be resized in the horizontal direction. Default true.
     */
    static canResizeX = true;

    /**
     * @var bool Whether or not this node can be resized in the vertical direction. Default true.
     */
    static canResizeY = true;

    /**
     * @var bool Whether or not this node can be moved on a canvas. Default true.
     */
    static canMove = true;

    /**
     * @var bool Whether or not this node can be renamed. Default true.
     */
    static canRename = true;

    /**
     * @var bool Whether or not this node can be copied. Default true.
     */
    static canCopy = true;

    /**
     * @var bool Whether or not this node can have its header flipped to the bottom. Default true.
     */
    static canFlipHeader = false;

    /**
     * @var int The minimum width of this node, cannot be resized smaller.
     */
    static minWidth = 150;

    /**
     * @var int The minimum height of this node, cannot be resized smaller.
     */
    static minHeight = 100;

    /**
     * @var int The height of the header of the node in pixels.
     */
    static headerHeight = 30;

    /**
     * @var int The precision with which nodes can be resized and moved.
     */
    static snapSize = 10;

    /**
     * @var int The padding of the node.
     */
    static padding = 10;

    /**
     * @var string The default cursor to show when no actions are present.
     */
    static defaultCursor = 'default';

    /**
     * @var bool Whether or not the height of the contents are fixed.
     */
    static fixedHeight = false;

    /**
     * @var bool Whether or not to auto-hide the header, only showing it when the node is active.
     */
    static hideHeader = false;

    /**
     * @var object A map of name to button configuration.
     */
    static nodeButtons = {};

    /**
     * @var string The text of the copy button's tooltip
     */
    static copyText = "Copy";

    /**
     * @var string The text of the close button's tooltip
     */
    static closeText = "Close";

    /**
     * @var string The text of the flip buttons' tooltip
     */
    static headerBottomText = "Flip Header to Bottom";
    
    /**
     * @var string The text of the flip buttons' tooltip on the bottom
     */
    static headerTopText = "Flip Header to Top";

    /**
     * @var string The icon for the header when flipping to bottom
     */
    static headerBottomIcon = "fa-solid fa-arrow-turn-down";
    
    /**
     * @var string The icon for the header when flipping to top
     */
    static headerTopIcon = "fa-solid fa-arrow-turn-up";

    constructor(editor, name, content, left, top, width, height) {
        super(editor.config);

        this.editor = editor;
        this.name = isEmpty(name) ? this.constructor.name : name;
        this.content = content;
        this.left = isEmpty(left) ? 0 : left;
        this.top = isEmpty(top) ? 0 : top;

        this.left -= this.constructor.padding;
        this.top -= this.constructor.padding;

        this.width = isEmpty(width) ? this.constructor.minWidth : width;
        this.width += this.constructor.padding * 2;

        this.height = isEmpty(height) ? this.constructor.minHeight : height;
        this.height += this.constructor.padding * 2;

        this.setDimension(this.left, this.top, this.width, this.height, true);

        this.removed = false;
        this.closeCallbacks = [];
        this.resizeCallbacks = [];
    }

    /**
     * Gets the content of this node as a DOMElement.
     *
     * @return DOMElement The content of this node.
     */
    async getContent() {
        let content = this.content;
        if (content instanceof View) {
            return await content.getNode();
        }
        return content;
    }

    /**
     * Sets the contents of this node.
     *
     * @param DOMElement|View The new content of this node.
     */
    async setContent(newContent) {
        this.content = newContent;
        if (this.node !== undefined) {
            this.node
                .find(E.getCustomTag('nodeContents'))
                .content(await this.getContent());
        }
        return this;
    }

    /**
     * Adds a callback to be called when this node is closed.
     *
     * @param callable $callback The method to call.
     */
    onClose(callback) {
        this.closeCallbacks.push(callback);
    }

    /**
     * Trigger all of the close callbacks.
     */
    async closed() {
        for (let callback of this.closeCallbacks) {
            await callback();
        }
    }

    /**
     * Adds a callback to be called when this node is resized.
     *
     * @param callable $callback The method to call.
     */
    onResize(callback) {
        this.resizeCallbacks.push(callback);
    }

    /**
     * Trigger all resize callbacks.
     */
    async resized() {
        if (this.content instanceof View) {
            this.content.resize();
        }
        for (let callback of this.resizeCallbacks) {
            await callback();
        }
    }

    /**
     * Gets the dimensions of this node as a drawable.
     *
     * @return Drawable A rectangle with the points of this node.
     */
    get drawable() {
        return new Drawable([
            new Point(this.visibleLeft, this.visibleTop),
            new Point(this.visibleLeft + this.visibleWidth, this.visibleTop),
            new Point(
                this.visibleLeft + this.visibleWidth,
                this.visibleTop + this.visibleHeight
            ),
            new Point(this.visibleLeft, this.visibleTop + this.visibleHeight)
        ]);
    }

    /**
     * Gets the data of this node, which includes the name, class, and dimensions.
     *
     * @return object The data for this node
     */
    getState() {
        return {
            name: this.getName(),
            classname: this.constructor.name,
            x: this.left + this.constructor.padding,
            y: this.top + this.constructor.padding,
            w: this.width - (this.constructor.padding * 2),
            h: this.height - (this.constructor.padding * 2)
        };
    }

    /**
     * Sets the data for this node.
     *
     * @param object The new data - see getState for format
     */
    async setState(newState) {
        this.name = newState.name;
        this.setDimension(newState.x, newState.y, newState.w, newState.h, true);

        if (this.node !== undefined) {
            this.node.find(E.getCustomTag('nodeName')).content(this.name);
        }

        return this;
    }

    /**
     * Sets the name of this node.
     *
     * @param string $newName The new name, which will populate in the DOM.
     */
    setName(newName) {
        this.name = newName;
        if (this.node !== undefined) {
            this.node.find(E.getCustomTag('nodeName')).content(newName);
        }
    }

    /**
     * Gets the name either from memory or the DOM.
     *
     * @return string The name of the node.
     */
    getName() {
        if (this.node === undefined) return this.name;
        return this.node.find(E.getCustomTag('nodeName')).getText();
    }

    /**
     * Removes this node from the editor.
     */
    remove() {
        this.editor.removeNode(this);
        this.removed = true;
        this.closed();
    }

    /**
     * Focus on this node.
     */
    focus() {
        this.editor.focusNode(this);
    }

    /**
     * Gets the nearest snap point based on class configuration.
     *
     * @param Point point The x, y point.
     * @param int minimum The minimum value.
     * @param int maximum The maximum value.
     * @return int The nearest snap point to the passed point.
     */
    static getNearestSnap(point, minimum, maximum) {
        if (isEmpty(minimum)) minimum = -this.padding;
        if (isEmpty(maximum)) maximum = Infinity;
        return Math.min(
            Math.max(
                Math.round(point / this.snapSize) * this.snapSize,
                minimum
            ),
            maximum
        );
    }

    /**
     * Gets the nearest snap point for a point for left dimensions based on editor dimensions.
     */
    getLeftSnap(point) {
        return this.constructor.getNearestSnap(
            point,
            -this.constructor.padding,
            this.editor.width + this.constructor.padding - this.width
        );
    }

    /**
     * Gets the nearest snap point for a point for top dimensions based on editor dimensions.
     */
    getTopSnap(point) {
        return this.constructor.getNearestSnap(
            point,
            -this.constructor.padding,
            this.editor.height + this.constructor.padding - this.height
        );
    }

    /**
     * Gets the nearest snap point for a point for width dimensions based on editor dimensions.
     */
    getWidthSnap(point, left) {
        return this.constructor.getNearestSnap(
            point,
            this.constructor.minWidth + this.constructor.padding * 2,
            this.editor.width + this.constructor.padding - left
        );
    }

    /**
     * Gets the nearest snap point for a point for height dimensions based on editor dimensions.
     */
    getHeightSnap(point, top) {
        return this.constructor.getNearestSnap(
            point,
            this.constructor.minHeight + this.constructor.padding * 2,
            this.editor.height + this.constructor.padding - top
        );
    }

    /**
     * Reset this node back to its configured position.
     */
    resetDimension() {
        return this.setDimension(
            this.left,
            this.top,
            this.width,
            this.height,
            true
        );
    }

    /**
     * Sets the node in a new position and dimension.
     *
     * @param int $left The pixels from the left to the left side of the node
     * @param int $top The pixels from the top to the top side of the node
     * @param int $width The width of the node
     * @param int $height The height of the node
     * @param bool $save Whether or not to save tese dimensions as the new configured dimensions.
     */
    setDimension(left, top, width, height, save) {
        left = this.constructor.getNearestSnap(left);
        top = this.constructor.getNearestSnap(top);
        width = this.getWidthSnap(width, left);
        height = this.getHeightSnap(height, top);
        if (top + height > this.editor.height + this.constructor.padding) {
            let difference =
                this.editor.height - top - height - this.constructor.padding;
            top += difference;
            if (top < 0) {
                height += top;
                top = 0;
            }
        }

        if (left + width > this.editor.width + this.constructor.padding) {
            let difference =
                this.editor.width - left - width - this.constructor.padding;
            left += difference;
            if (left < 0) {
                width += left;
                left = 0;
            }
        }

        if (this.node !== undefined) {
            this.node.css({
                left: `${left}px`,
                top: `${top}px`,
                width: `${width}px`,
                height: `${height}px`
            });
        }

        if (save) {
            this.left = left;
            this.top = top;
            this.width = width;
            this.height = height;
        }

        this.visibleLeft = left;
        this.visibleTop = top;
        this.visibleWidth = width;
        this.visibleHeight = height;

        return [left, top, width, height];
    }

    /**
     * Flips the header between top and bottom.
     */
    flipHeader() {
        let button = this.node.find(".node-button-flip"),
            icon = button.find("i");
        if (this.flipped === true) {
            this.flipped = false;
            this.removeClass("flipped");
            button.data("tooltip", this.constructor.headerBottomText);
            icon.class(this.constructor.headerBottomIcon);
        } else {
            this.flipped = true;
            this.addClass("flipped");
            button.data("tooltip", this.constructor.headerTopText);
            icon.class(this.constructor.headerTopIcon);
        }
    }

    /**
     * Builds the node and binds events.
     */
    async build() {
        let node = await super.build(),
            nodeContainer = E.nodeContainer(),
            cursorMode = NodeCursorMode.NONE,
            nextMode = NodeCursorMode.NONE,
            startPositionX,
            startPositionY,
            nodeName = E.nodeName().content(this.name),
            nodeHeader = E.nodeHeader()
                .content(nodeName)
                .css({
                    height: `${this.constructor.headerHeight}px`,
                    'line-height': `${this.constructor.headerHeight}px`
                });

        if (this.constructor.canRename) {
            nodeName.editable();
            nodeHeader.on('dblclick', (e) => {
                e.preventDefault();
                e.stopPropagation();
                nodeName.focus();
            });
        }

        if (this.constructor.hideHeader) {
            node.addClass("hide-header");
            nodeHeader.css('height', 0);
        }

        let buttons = { ...this.constructor.nodeButtons };
        if (this.constructor.canCopy) {
            buttons.copy = {
                icon: 'fa-solid fa-copy',
                tooltip: this.constructor.copyText,
                callback: () => {
                    this.editor.copyNode(this);
                }
            };
        }
        if (this.constructor.canFlipHeader) {
            buttons.flip = {
                icon: this.constructor.headerBottomIcon,
                tooltip: this.constructor.headerBottomText,
                callback: () => {
                    this.flipHeader();
                }
            };
        };
        if (this.constructor.canClose) {
            buttons.close = {
                icon: 'fa-solid fa-window-close',
                tooltip: this.constructor.closeText,
                callback: () => {
                    this.closed();
                    this.editor.removeNode(this);
                }
            };
        }
        for (let buttonName in buttons) {
            // Add in the constructor buttons, for extending classes.
            let buttonConfiguration = buttons[buttonName],
                button = E.nodeButton()
                    .class(`node-button-${camelCase(buttonName)}`)
                    .content(E.i().class(buttonConfiguration.icon))
                    .on('click', (e) => {
                        buttonConfiguration.callback.call(this, e);
                    });

            if (buttonConfiguration.tooltip) {
                button.data('tooltip', buttonConfiguration.tooltip);
            }

            nodeHeader.append(button);
        }

        let setNodeDimension = (e, saveChanges) => {
            /* Depending on the cursor mode, calculate what dimensions
             * (left, top, width, height) to change.
             *
             * saveChanges() will set the nodes stored values, so that
             * should be called when the activity has ceased (i.e. mouseup)
             */
            e.preventDefault();
            e.stopPropagation();

            let changed = false,
                left = this.left,
                top = this.top,
                width = this.width,
                height = this.height,
                [deltaX, deltaY] = [0, 0];

            if (!isEmpty(startPositionX) && !isEmpty(startPositionY)) {
                [deltaX, deltaY] = [
                    e.clientX - startPositionX,
                    e.clientY - startPositionY
                ];
                deltaX *= 1 / this.editor.zoom;
                deltaY *= 1 / this.editor.zoom;
            }

            switch (cursorMode) {
                case NodeCursorMode.MOVE:
                    left = left + deltaX;
                    top = top + deltaY;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_N:
                    top = top + deltaY;
                    height = height - deltaY;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_NE:
                    top = top + deltaY;
                    height = height - deltaY;
                    width = width + deltaX;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_E:
                    width = width + deltaX;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_SE:
                    width = width + deltaX;
                    height = height + deltaY;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_S:
                    height = height + deltaY;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_SW:
                    height = height + deltaY;
                    left = left + deltaX;
                    width = width - deltaX;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_W:
                    left = left + deltaX;
                    width = width - deltaX;
                    changed = true;
                    break;
                case NodeCursorMode.RESIZE_NW:
                    top = top + deltaY;
                    height = height - deltaY;
                    left = left + deltaX;
                    width = width - deltaX;
                    changed = true;
                    break;
            }

            if (changed) {
                this.setDimension(left, top, width, height, saveChanges);
                this.editor.decorations.recalculate();
                this.editor.decorations.draw();
                this.resized();
            }
        };
        nodeContainer.append(nodeHeader);
        node.append(nodeContainer)
            .css({
                left: `${this.left}px`,
                top: `${this.top}px`,
                width: `${this.width}px`,
                height: `${this.height}px`,
                padding: `${this.constructor.padding}px`
            })
            .on('mouseenter', (e) => {
                if (this.constructor.hideHeader) {
                    nodeHeader.css(
                        'height',
                        `${this.constructor.headerHeight}px`
                    );
                }
            })
            .on('mouseleave', (e) => {
                if (this.constructor.hideHeader) {
                    nodeHeader.css('height', '0');
                }
            })
            .on('mousemove', (e) => {
                if (cursorMode == NodeCursorMode.NONE) {
                    /* If there is no cursor mode assigned,
                     * evalaute what the next mode would be
                     * if it were to be changed.
                     */
                    let targetNode = e.target;
                    while (targetNode.tagName !== 'ENFUGUE-NODE') {
                        targetNode = targetNode.parentElement;
                    }
                    if (targetNode !== node.element) return; // Ignore events for child nodes
                    let nodeBounds = node.element.getBoundingClientRect(),
                        tolerance = this.constructor.edgeHandlerTolerance * this.editor.zoom,
                        headerHeight = this.constructor.headerHeight * this.editor.zoom,
                        onTop = e.clientY >= nodeBounds.y && e.clientY < nodeBounds.y + tolerance,
                        onLeft = e.clientX >= nodeBounds.x && e.clientX < nodeBounds.x + tolerance,
                        onRight = e.clientX >= nodeBounds.x + nodeBounds.width - tolerance,
                        onBottom = e.clientY >= nodeBounds.y + nodeBounds.height - tolerance,
                        inHeader = this.flipped === true
                            ? !onBottom && e.clientY >= nodeBounds.y + nodeBounds.height - headerHeight - tolerance
                            : !onTop && e.clientY >= nodeBounds.y && e.clientY < nodeBounds.y + tolerance + headerHeight;

                    if (
                        onTop &&
                        onLeft &&
                        this.constructor.canResizeX &&
                        this.constructor.canResizeY
                    ) {
                        nextMode = NodeCursorMode.RESIZE_NW;
                    } else if (
                        onTop &&
                        onRight &&
                        this.constructor.canResizeX &&
                        this.constructor.canResizeY
                    ) {
                        nextMode = NodeCursorMode.RESIZE_NE;
                    } else if (onTop && this.constructor.canResizeY) {
                        nextMode = NodeCursorMode.RESIZE_N;
                    } else if (
                        onBottom &&
                        onLeft &&
                        this.constructor.canResizeX &&
                        this.constructor.canResizeY
                    ) {
                        nextMode = NodeCursorMode.RESIZE_SW;
                    } else if (
                        onBottom &&
                        onRight &&
                        this.constructor.canResizeX &&
                        this.constructor.canResizeY
                    ) {
                        nextMode = NodeCursorMode.RESIZE_SE;
                    } else if (onBottom && this.constructor.canResizeY) {
                        nextMode = NodeCursorMode.RESIZE_S;
                    } else if (onLeft && this.constructor.canResizeX) {
                        nextMode = NodeCursorMode.RESIZE_W;
                    } else if (onRight && this.constructor.canResizeX) {
                        nextMode = NodeCursorMode.RESIZE_E;
                    } else if (
                        inHeader &&
                        this.constructor.canMove &&
                        !onLeft &&
                        !onRight
                    ) {
                        nextMode = NodeCursorMode.MOVE;
                    } else {
                        nextMode = NodeCursorMode.NONE;
                    }

                    switch (nextMode) {
                        // Set the cursor as the indication to the user.
                        case NodeCursorMode.MOVE:
                            node.css('cursor', 'grab');
                            break;
                        case NodeCursorMode.RESIZE_NE:
                        case NodeCursorMode.RESIZE_SW:
                            node.css('cursor', 'nesw-resize');
                            break;
                        case NodeCursorMode.RESIZE_N:
                        case NodeCursorMode.RESIZE_S:
                            node.css('cursor', 'ns-resize');
                            break;
                        case NodeCursorMode.RESIZE_E:
                        case NodeCursorMode.RESIZE_W:
                            node.css('cursor', 'ew-resize');
                            break;
                        case NodeCursorMode.RESIZE_NW:
                        case NodeCursorMode.RESIZE_SE:
                            node.css('cursor', 'nwse-resize');
                            break;
                        default:
                            node.css('cursor', this.constructor.defaultCursor);
                            break;
                    }
                }
            })
            .on('mousedown', (e) => {
                if (
                    e.which !== 1 ||
                    nextMode === NodeCursorMode.NONE ||
                    cursorMode !== NodeCursorMode.NONE
                )
                    return;
                /* On mousedown, we'll determine the final mode of the cursor,
                 * and initiate the action.
                 *
                 * We also bind the mousemove() and mouseup() listeners within
                 * this listener, and unbind them in the mouseup/mouseleave
                 * listener.
                 */
                e.preventDefault();
                e.stopPropagation();

                this.editor.focusNode(this);

                switch (nextMode) {
                    case NodeCursorMode.MOVE:
                    case NodeCursorMode.RESIZE_NE:
                    case NodeCursorMode.RESIZE_SW:
                    case NodeCursorMode.RESIZE_N:
                    case NodeCursorMode.RESIZE_S:
                    case NodeCursorMode.RESIZE_E:
                    case NodeCursorMode.RESIZE_W:
                    case NodeCursorMode.RESIZE_NW:
                    case NodeCursorMode.RESIZE_SE:
                        [startPositionX, startPositionY] = [
                            e.clientX,
                            e.clientY
                        ];
                        cursorMode = nextMode;

                        switch (cursorMode) {
                            case NodeCursorMode.MOVE:
                                this.editor.node.css('cursor', 'grab');
                                break;
                            case NodeCursorMode.RESIZE_NE:
                            case NodeCursorMode.RESIZE_SW:
                                this.editor.node.css('cursor', 'nesw-resize');
                                break;
                            case NodeCursorMode.RESIZE_N:
                            case NodeCursorMode.RESIZE_S:
                                this.editor.node.css('cursor', 'ns-resize');
                                break;
                            case NodeCursorMode.RESIZE_E:
                            case NodeCursorMode.RESIZE_W:
                                this.editor.node.css('cursor', 'ew-resize');
                                break;
                            case NodeCursorMode.RESIZE_NW:
                            case NodeCursorMode.RESIZE_SE:
                                this.editor.node.css('cursor', 'nwse-resize');
                                break;
                            default:
                                this.editor.node.css(
                                    'cursor',
                                    this.constructor.defaultCursor
                                );
                                break;
                        }

                        let endCursor = (e) => {
                            setNodeDimension(e, true);

                            cursorMode = NodeCursorMode.NONE;
                            [startPositionX, startPositionY] = [null, null];
                            this.editor.node
                                .off('mouseup,mouseleave,mousemove')
                                .css('cursor', this.constructor.defaultCursor);
                            node.off('mouseup');
                            if (this.editor.constructor.disableCursor) {
                                this.editor.node.css("pointer-events", "none");
                            }
                        };

                        this.editor.node
                            .on('mousemove', (e2) => {
                                e2.preventDefault();
                                e2.stopPropagation();
                                setNodeDimension(e2, false);
                            })
                            .on('mouseup,mouseleave', (e2) => {
                                e2.preventDefault();
                                e2.stopPropagation();
                                endCursor(e2);
                            });

                        node.on('mouseup', (e2) => {
                            endCursor(e2);
                        });
                            
                        if (this.editor.constructor.disableCursor) {
                            this.editor.node.css("pointer-events", "all");
                        }

                        break;
                    default:
                        break;
                }
            });

        let content = await this.getContent(),
            contentContainer = E.nodeContents();

        if (!isEmpty(content)) {
            if (content instanceof View) {
                content = await content.getNode();
            }
            contentContainer.content(content);
        }

        contentContainer.on('mousedown', (e) => {
            this.editor.focusNode(this);
        });

        if (!this.constructor.fixedHeight) {
            if (
                this.constructor.hideHeader ||
                this.constructor.fixedHeader
            ) {
                contentContainer.css('height', '100%');
            } else {
                contentContainer.css(
                    'height',
                    `calc(100% - ${this.constructor.headerHeight}px)`
                );
            }
        }

        nodeContainer.append(contentContainer);
        return node;
    }
}

/**
 * The OptionsNodeView extends the NodeView by additionally offering a place for
 * a form or an input to go.
 */
class OptionsNodeView extends NodeView {
    /**
     * @var FormView|InputView The options view.
     */
    static nodeOptions = null;
    
    /**
     * @var int The height of the options node in pixels.
     */
    static optionsHeight = 0;

    constructor(editor, name, content, left, top, width, height) {
        super(editor, name, content, left, top, width, height);
        this.options = this.constructor.nodeOptions;
    }

    /**
     * Overridde setState() to additionally populate the form/input.
     */
    async setState(newState) {
        await super.setState(newState);
        if (typeof this.options == 'function') {
            this.options = new this.options(this.config);
        }

        if (!isEmpty(newState.options)) {
            if (isEmpty(this.options)) {
                console.warn('Options passed, but no options present on node.');
            } else {
                if (this.options instanceof InputView) {
                    let setValue =
                        typeof newState.options == 'object' &&
                        !isEmpty(newState.options.default)
                            ? newState.options.default
                            : newState.options;
                    await this.options.setValue(setValue);
                } else if (this.options instanceof FormView) {
                    await this.options.setValues(newState.options);
                    this.options.submit();
                } else {
                    this.options = newState.options;
                }
            }
        }
        return this;
    }

    /**
     * Override getContent() to additionally embed the options.
     */
    async getContent() {
        let node = E.nodeOptionsContents(),
            optionsNode = E.nodeOptions().css(
                'height',
                `${this.constructor.optionsHeight}px`
            );

        if (!isEmpty(this.options)) {
            if (typeof this.options == 'function') {
                this.options = new this.options(this.config);
                optionsNode.append(await this.options.getNode());
            } else if (this.options instanceof View) {
                optionsNode.append(await this.options.getNode());
            } else {
                optionsNode.append(this.options);
            }
        }

        node.append(optionsNode, await super.getContent());

        return node;
    }

    /**
     * Override getState to additionally include the data from the form/input.
     */
    getState() {
        let parentState = super.getState();

        parentState.options = isEmpty(this.options)
            ? null
            : this.options instanceof InputView
            ? this.options.getValue()
            : this.options instanceof FormView
            ? this.options.values
            : this.options;

        return parentState;
    }
}

export { NodeView, OptionsNodeView };
