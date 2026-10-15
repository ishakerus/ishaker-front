import type { Article } from "../../types/article";

export const catalogGuides: Article[] = [
  {
    id: "guide-create-brand",
    code: "create-brand",
    type: "page",
    header: "How to create a brand",
    subheader: "Prepare your logo and add a brand to your cabinet's catalog.",
    isOutdated: false,
    article: `## Prepare your brand logo

A brand needs a name and one logo image. Create a **500 × 330 px** canvas and place your logo inside it, as shown below. Keep the entire logo within the canvas, with enough space around the edges so it stays readable when displayed at a smaller size.

![Brand logo layout on a 500 by 330 pixel canvas](/guides/brand.jpg)

Export the logo as a **PNG (.png)** with a transparent background. Each file must be **5 MB or smaller**. The illustration above is a layout reference; upload your finished logo rather than the reference image with its dimensions and border. Changing a JPEG filename to .png does not convert it into a PNG.

## Add the brand to your catalog

1. Open the [Taste and brand catalog](/catalog) in your cabinet.
2. Find **Add a custom brand** and enter a brand name of 2–80 characters. Choose a name that is not already used in the catalog.
3. Select your PNG logo. The form checks its extension, actual PNG data, pixel dimensions, and file size before showing a preview. If the file is rejected, correct the problem described in the message and select it again.
4. Check the logo preview and click **Create brand**.

Your new brand appears under **Your brands** and is associated with the client whose cabinet is open.

## Manage your brands

Use **Delete** on one of your own brand cards to remove it. A brand used by a product must first be removed from those products. Shared brands and brands belonging to the root client are read-only in the cabinet.

For the taste artwork that accompanies your products, follow [How to create a taste](/articles/create-taste).`,
  },
  {
    id: "guide-create-taste",
    code: "create-taste",
    type: "page",
    header: "How to create a taste",
    subheader: "Combine ingredient cutouts, a main image, a circle, and a color splash into a custom taste.",
    isOutdated: false,
    article: `## Understand the taste artwork

A taste uses two visual compositions. Five separate ingredient cutouts are animated together with a base color splash above the product cup. A separate main image shows the complete ingredient arrangement with a rotating circle behind it. The cup and brand are selected in the product editor; you do not upload a cup when creating a taste.

![Five strawberry and banana ingredient cutouts, a main ingredient arrangement, a circle, and a pink splash combine with a branded cup](/guides/tastes-construction.jpg)

## Prepare the PNG files

Prepare **six PNG files** with transparent backgrounds: five individual ingredient images and one main image. Keep each file at **5 MB or smaller**.

| Image | Quantity | Exact canvas size |
| --- | --- | --- |
| Individual ingredient cutout | 5 | 500 × 500 px each |
| Main image containing the complete ingredient arrangement | 1 | 350 × 350 px |

![An individual banana slice uses a 500 by 500 pixel canvas; the complete strawberry and banana arrangement uses a 350 by 350 pixel canvas](/guides/taste-dimensions.jpg)

Use separate cutouts for the five ingredient images, such as the strawberry halves and banana slices shown above. For the main image, arrange the ingredients together into one balanced composition. Keep the artwork inside each canvas and export as PNG with transparency. Do not include the reference illustration's labels, borders, or background in your files.

The form rejects files with the wrong extension, image format, dimensions, or file size. Renaming a JPEG file to .png is not sufficient; export or convert it as a real PNG.

## Build and preview the taste

1. Open the [Taste and brand catalog](/catalog) and find **Add a custom taste**.
2. Enter a unique taste name of 2–80 characters.
3. Select your **350 × 350 px main image**.
4. Choose an existing **Circle image**. The small taste preview shows the main image with that circle behind it.
5. Choose an existing **Base color splash** that matches your ingredients. The selector shows its final animation frame.
6. Select **exactly five 500 × 500 px ingredient PNGs** together in the ingredient file picker.
7. Click **Generate splash**. Review the resulting 20-frame animation and the smaller main-image preview beneath it. If you change the name, base splash, or ingredients, generate the splash again.
8. Click **Submit custom taste** when the previews are ready.

The taste appears under **Your tastes** with a **Pending review** badge. Submission does not make it live on machines: the iShaker team must review and approve it first.

## Manage your tastes

Your taste belongs to the client whose cabinet is open. Use **Delete** on your own taste card to remove it. If a product uses that taste or its main image, remove those references first. Shared tastes and tastes belonging to the root client are read-only in the cabinet.

To prepare the logo used with your products, follow [How to create a brand](/articles/create-brand).`,
  },
];
