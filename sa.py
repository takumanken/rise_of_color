from PIL import Image, ImageChops

def trim(im):
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)

im = Image.open("330px-%27Demigod_Guarding_the_Gateway%27%2C_late_9th-early_10th_century%2C_sandstone%2C_Museum_of_Cham_Sculpture.JPG")
im = trim(im)
im.show()