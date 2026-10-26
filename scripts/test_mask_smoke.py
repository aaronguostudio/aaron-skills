import unittest
from PIL import Image
from mask_smoke import COLOR, check_mask


class MaskPixelsTests(unittest.TestCase):
    def image(self):
        image = Image.new('RGB', (100, 80), 'white')
        image.paste(COLOR, (10, 10, 90, 70))
        return image

    def test_lossless_checks_every_edge_and_fractional_coordinates_round_outwards(self):
        image = self.image()
        box = [10.2, 10.4, 79.3, 59.2]
        check_mask(image, box, lossless=True)
        for point in [(10, 10), (89, 10), (10, 69), (89, 69), (50, 40)]:
            broken = image.copy(); broken.putpixel(point, (240, 240, 240))
            with self.subTest(point=point), self.assertRaises(ValueError):
                check_mask(broken, box, lossless=True)

    def test_lossy_edge_ringing_is_distinct_from_a_missing_mask(self):
        image = self.image()
        # Actual local H.264/JPEG edges differed by 18 channels within two pixels.
        image.putpixel((12, 12), (23, 28, 57))
        check_mask(image, [10, 10, 80, 60], lossless=False)
        with self.assertRaises(ValueError): check_mask(image, [10, 10, 80, 60], lossless=True)
        for broken in [Image.new('RGB', image.size, 'white'), self.image()]:
            broken.putpixel((50, 40), (240, 240, 240))
            with self.assertRaises(ValueError): check_mask(broken, [10, 10, 80, 60], lossless=False)

    def test_empty_or_offscreen_sample_cannot_pass_vacuously(self):
        for box in [[10, 10, 16, 16], [-1, 0, 1000, 60]]:
            with self.assertRaises(ValueError): check_mask(self.image(), box, lossless=False)


if __name__ == '__main__': unittest.main()
