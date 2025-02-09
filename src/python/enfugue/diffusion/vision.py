from __future__ import annotations

import cv2
import PIL
import numpy as np

__all__ = ["ComputerVision"]


class ComputerVision:
    """
    Provides helper methods for cv2
    """

    @staticmethod
    def convert_image(image: PIL.Image.Image) -> np.ndarray:
        """
        Converts PIL image to OpenCV format.
        """
        return cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)

    @staticmethod
    def revert_image(array: np.ndarray) -> PIL.Image.Image:
        """
        Converts PIL image to OpenCV format.
        """
        return PIL.Image.fromarray(cv2.cvtColor(array, cv2.COLOR_BGR2RGB))
