import torch
from enfugue.diffusion.rt.model.base import BaseModel
from typing import Dict, List, Tuple


class ControlledUNet(BaseModel):
    """
    The controlled UNet uses a controlnet that forwards mid/down blocks.
    """

    def __init__(
        self,
        model: torch.nn.Module,
        use_fp16: bool = True,
        device: str = "cuda",
        max_batch_size: int = 16,
        embedding_dim: int = 768,
        text_maxlen: int = 77,
        unet_dim: int = 4,
    ) -> None:
        super(ControlledUNet, self).__init__(
            model=model,
            use_fp16=use_fp16,
            device=device,
            max_batch_size=max_batch_size,
            embedding_dim=embedding_dim,
            text_maxlen=text_maxlen,
        )
        self.unet_dim = unet_dim
        self.name = "ControlledUNet"

    def get_model_key(self) -> str:
        return "controlledunet"

    def get_input_names(self) -> List[str]:
        return [
            "sample",
            "timestep",
            "encoder_hidden_states",
            "mid_block",
            "down_block_0",
            "down_block_1",
            "down_block_2",
            "down_block_3",
            "down_block_4",
            "down_block_5",
            "down_block_6",
            "down_block_7",
            "down_block_8",
            "down_block_9",
            "down_block_10",
            "down_block_11",
        ]

    def get_output_names(self) -> List[str]:
        return ["latent"]

    def get_dynamic_axes(self) -> Dict[str, Dict[int, str]]:
        return {
            "sample": {0: "2B", 2: "H", 3: "W"},
            "encoder_hidden_states": {0: "2B"},
            "mid_block": {0: "2B", 1: "4S", 2: "8H", 3: "8W"},
            "down_block_0": {0: "2B", 1: "S", 2: "H", 3: "W"},
            "down_block_1": {0: "2B", 1: "S", 2: "H", 3: "W"},
            "down_block_2": {0: "2B", 1: "S", 2: "H", 3: "W"},
            "down_block_3": {0: "2B", 1: "S", 2: "2H", 3: "2W"},
            "down_block_4": {0: "2B", 1: "2S", 2: "2H", 3: "2W"},
            "down_block_5": {0: "2B", 1: "2S", 2: "2H", 3: "2W"},
            "down_block_6": {0: "2B", 1: "2S", 2: "4H", 3: "4W"},
            "down_block_7": {0: "2B", 1: "4S", 2: "4H", 3: "4W"},
            "down_block_8": {0: "2B", 1: "4S", 2: "4H", 3: "4W"},
            "down_block_9": {0: "2B", 1: "4S", 2: "8H", 3: "8W"},
            "down_block_10": {0: "2B", 1: "4S", 2: "8H", 3: "8W"},
            "down_block_11": {0: "2B", 1: "4S", 2: "8H", 3: "8W"},
            "latent": {0: "2B", 2: "H", 3: "W"},
        }

    def get_input_profile(
        self,
        batch_size: int,
        image_height: int,
        image_width: int,
        static_batch: bool,
        static_shape: bool,
    ) -> Dict[str, List[Tuple[int, ...]]]:
        latent_height, latent_width = self.check_dims(batch_size, image_height, image_width)
        (
            (min_batch, max_batch),
            _,
            _,
            (min_latent_height, max_latent_height),
            (min_latent_width, max_latent_width),
        ) = self.get_minmax_dims(batch_size, image_height, image_width, static_batch, static_shape)
        return {
            "sample": [
                (2 * min_batch, self.unet_dim, min_latent_height, min_latent_width),
                (2 * batch_size, self.unet_dim, latent_height, latent_width),
                (2 * max_batch, self.unet_dim, max_latent_height, max_latent_width),
            ],
            "encoder_hidden_states": [
                (2 * min_batch, self.text_maxlen, self.embedding_dim),
                (2 * batch_size, self.text_maxlen, self.embedding_dim),
                (2 * max_batch, self.text_maxlen, self.embedding_dim),
            ],
            "mid_block": [
                (2 * min_batch, 1280, min_latent_height // 8, min_latent_width // 8),
                (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
                (2 * max_batch, 1280, max_latent_height // 8, max_latent_width // 8),
            ],
            "down_block_0": [
                (2 * min_batch, 320, min_latent_height, min_latent_width),
                (2 * batch_size, 320, latent_height, latent_width),
                (2 * max_batch, 320, max_latent_height, max_latent_width),
            ],
            "down_block_1": [
                (2 * min_batch, 320, min_latent_height, min_latent_width),
                (2 * batch_size, 320, latent_height, latent_width),
                (2 * max_batch, 320, max_latent_height, max_latent_width),
            ],
            "down_block_2": [
                (2 * min_batch, 320, min_latent_height, min_latent_width),
                (2 * batch_size, 320, latent_height, latent_width),
                (2 * max_batch, 320, max_latent_height, max_latent_width),
            ],
            "down_block_3": [
                (2 * min_batch, 320, min_latent_height // 2, min_latent_width // 2),
                (2 * batch_size, 320, latent_height // 2, latent_width // 2),
                (2 * max_batch, 320, max_latent_height // 2, max_latent_width // 2),
            ],
            "down_block_4": [
                (2 * min_batch, 640, min_latent_height // 2, min_latent_width // 2),
                (2 * batch_size, 640, latent_height // 2, latent_width // 2),
                (2 * max_batch, 640, max_latent_height // 2, max_latent_width // 2),
            ],
            "down_block_5": [
                (2 * min_batch, 640, min_latent_height // 2, min_latent_width // 2),
                (2 * batch_size, 640, latent_height // 2, latent_width // 2),
                (2 * max_batch, 640, max_latent_height // 2, max_latent_width // 2),
            ],
            "down_block_6": [
                (2 * min_batch, 640, min_latent_height // 4, min_latent_width // 4),
                (2 * batch_size, 640, latent_height // 4, latent_width // 4),
                (2 * max_batch, 640, max_latent_height // 4, max_latent_width // 4),
            ],
            "down_block_7": [
                (2 * min_batch, 1280, min_latent_height // 4, min_latent_width // 4),
                (2 * batch_size, 1280, latent_height // 4, latent_width // 4),
                (2 * max_batch, 1280, max_latent_height // 4, max_latent_width // 4),
            ],
            "down_block_8": [
                (2 * min_batch, 1280, min_latent_height // 4, min_latent_width // 4),
                (2 * batch_size, 1280, latent_height // 4, latent_width // 4),
                (2 * max_batch, 1280, max_latent_height // 4, max_latent_width // 4),
            ],
            "down_block_9": [
                (2 * min_batch, 1280, min_latent_height // 8, min_latent_width // 8),
                (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
                (2 * max_batch, 1280, max_latent_height // 8, max_latent_width // 8),
            ],
            "down_block_10": [
                (2 * min_batch, 1280, min_latent_height // 8, min_latent_width // 8),
                (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
                (2 * max_batch, 1280, max_latent_height // 8, max_latent_width // 8),
            ],
            "down_block_11": [
                (2 * min_batch, 1280, min_latent_height // 8, min_latent_width // 8),
                (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
                (2 * max_batch, 1280, max_latent_height // 8, max_latent_width // 8),
            ],
        }

    def get_shape_dict(
        self, batch_size: int, image_height: int, image_width: int
    ) -> Dict[str, Tuple[int, ...]]:
        latent_height, latent_width = self.check_dims(batch_size, image_height, image_width)
        return {
            "sample": (2 * batch_size, self.unet_dim, latent_height, latent_width),
            "encoder_hidden_states": (
                2 * batch_size,
                self.text_maxlen,
                self.embedding_dim,
            ),
            "mid_block": (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
            "down_block_0": (2 * batch_size, 320, latent_height, latent_width),
            "down_block_1": (2 * batch_size, 320, latent_height, latent_width),
            "down_block_2": (2 * batch_size, 320, latent_height, latent_width),
            "down_block_3": (2 * batch_size, 320, latent_height // 2, latent_width // 2),
            "down_block_4": (2 * batch_size, 640, latent_height // 2, latent_width // 2),
            "down_block_5": (2 * batch_size, 640, latent_height // 2, latent_width // 2),
            "down_block_6": (2 * batch_size, 640, latent_height // 4, latent_width // 4),
            "down_block_7": (2 * batch_size, 1280, latent_height // 4, latent_width // 4),
            "down_block_8": (2 * batch_size, 1280, latent_height // 4, latent_width // 4),
            "down_block_9": (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
            "down_block_10": (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
            "down_block_11": (2 * batch_size, 1280, latent_height // 8, latent_width // 8),
            "latent": (2 * batch_size, 4, latent_height, latent_width),
        }

    def get_sample_input(
        self,
        batch_size: int,
        image_height: int,
        image_width: int,
    ) -> Tuple[torch.Tensor, ...]:
        latent_height, latent_width = self.check_dims(batch_size, image_height, image_width)
        dtype = torch.float16 if self.use_fp16 else torch.float32
        return (
            torch.randn(
                2 * batch_size,
                self.unet_dim,
                latent_height,
                latent_width,
                dtype=torch.float32,
                device=self.device,
            ),  # Sample
            torch.tensor([1.0], dtype=torch.float32, device=self.device),  # Timestep
            torch.randn(
                2 * batch_size,
                self.text_maxlen,
                self.embedding_dim,
                dtype=dtype,
                device=self.device,
            ),  # Encoder Hidden Sates
            torch.randn(
                2 * batch_size,
                1280,
                latent_height // 8,
                latent_width // 8,
                dtype=dtype,
                device=self.device,
            ),  # mid block
            torch.randn(
                2 * batch_size,
                320,
                latent_height,
                latent_width,
                dtype=dtype,
                device=self.device,
            ),  # down block 0
            torch.randn(
                2 * batch_size,
                320,
                latent_height,
                latent_width,
                dtype=dtype,
                device=self.device,
            ),  # down block 1
            torch.randn(
                2 * batch_size,
                320,
                latent_height,
                latent_width,
                dtype=dtype,
                device=self.device,
            ),  # down block 2
            torch.randn(
                2 * batch_size,
                320,
                latent_height // 2,
                latent_width // 2,
                dtype=dtype,
                device=self.device,
            ),  # down block 3
            torch.randn(
                2 * batch_size,
                640,
                latent_height // 2,
                latent_width // 2,
                dtype=dtype,
                device=self.device,
            ),  # down block 4
            torch.randn(
                2 * batch_size,
                640,
                latent_height // 2,
                latent_width // 2,
                dtype=dtype,
                device=self.device,
            ),  # down block 5
            torch.randn(
                2 * batch_size,
                640,
                latent_height // 4,
                latent_width // 4,
                dtype=dtype,
                device=self.device,
            ),  # down block 6
            torch.randn(
                2 * batch_size,
                1280,
                latent_height // 4,
                latent_width // 4,
                dtype=dtype,
                device=self.device,
            ),  # down block 7
            torch.randn(
                2 * batch_size,
                1280,
                latent_height // 4,
                latent_width // 4,
                dtype=dtype,
                device=self.device,
            ),  # down block 8
            torch.randn(
                2 * batch_size,
                1280,
                latent_height // 8,
                latent_width // 8,
                dtype=dtype,
                device=self.device,
            ),  # down block 9
            torch.randn(
                2 * batch_size,
                1280,
                latent_height // 8,
                latent_width // 8,
                dtype=dtype,
                device=self.device,
            ),  # down block 10
            torch.randn(
                2 * batch_size,
                1280,
                latent_height // 8,
                latent_width // 8,
                dtype=dtype,
                device=self.device,
            ),  # down block 11
        )
