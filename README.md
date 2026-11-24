<h1 align="center">star-light-planner</h1>
<p align="center">Plan LED string light wrapping for a welded 3D star frame: 3D preview, wire length, strip count, cost and a wrapping guide</p>
<div align="center">
  <a href="https://github.com/abhijithvijayan/star-light-planner/blob/main/license">
    <img src="https://img.shields.io/github/license/abhijithvijayan/star-light-planner.svg" alt="LICENSE" />
  </a>
  <a href="https://twitter.com/intent/tweet?text=Check%20out%20star-light-planner%21%20by%20%40_abhijithv%0A%0APlan%20LED%20string%20light%20wrapping%20for%20a%203D%20star%20frame%0Ahttps%3A%2F%2Fgithub.com%2Fabhijithvijayan%2Fstar-light-planner%0A%0A%23christmas%20%23diy">
     <img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social" alt="TWEET" />
  </a>
</div>
<h3 align="center">Made by <a href="https://twitter.com/_abhijithv">@abhijithvijayan</a></h3>
<p align="center">
  Donate:
  <a href="https://www.paypal.me/iamabhijithvijayan" target='_blank'><i><b>PayPal</b></i></a>,
  <a href="https://www.patreon.com/abhijithvijayan" target='_blank'><i><b>Patreon</b></i></a>
</p>
<p align="center">
  <a href='https://www.buymeacoffee.com/abhijithvijayan' target='_blank'>
    <img height='36' style='border:0px;height:36px;' src='https://bmc-cdn.nyc3.digitaloceanspaces.com/BMC-button-images/custom_images/orange_img.png' border='0' alt='Buy Me a Coffee' />
  </a>
</p>
<hr />

**Live:** [apps.star-lights.abhijithvijayan.in](https://apps.star-lights.abhijithvijayan.in)

## Table of Contents

- [Features](#features)
- [Usage](#usage)
- [How It Works](#how-it-works)
- [Assumptions](#assumptions)
- [Development](#development)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Issues](#issues)
- [License](#license)

## Features

- **3D preview** - Rotate and zoom the frame with the wire and bulbs drawn at the chosen spacing
- **Two wrap methods** - A full-body spiral that keeps both top points, or each point wound on its own plus the centre
- **Live numbers** - Wire length, turns, strips with and without a wastage buffer, bulb count and cost
- **Wrapping guide** - Step-by-step directions for whoever does the wrapping, with where each strip runs out, shown as a table and as markers in 3D
- **Editable frame** - Point bar lengths, centre depth and inner edge lengths can all be changed
- **No backend** - Static page, no build step, light and dark themes

## Usage

1. Open the [live page](https://apps.star-lights.abhijithvijayan.in).
2. Enter the frame measurements if they differ from the defaults.
3. Drag the loop spacing slider and pick the bulb spacing (3, 5 or 7 inch) to see how dense the wrap looks.
4. Enter the price per strip and the wastage buffer.
5. Turn on the wrapping guide and hand the steps and the strip table to whoever is wrapping.

## How It Works

The frame is two identical five-pointed stars welded at the five tips and held apart at the inner pentagon corners by struts.

| Part | Default |
|------|---------|
| Upper point bars (four points, four bars each) | 80 cm |
| Bottom point bars | 112 cm |
| Centre depth (strut) | 27 cm |
| Inner pentagon, four sides | 53 cm |
| Inner pentagon, bottom side | 58 cm |

Axes: x right, y up, z towards the viewer. The front face is at z = +depth/2, the back at z = −depth/2, and the tips at z = 0. Each tip sits on the perpendicular through the middle of its inner edge, at the distance that makes all four of its bars the given length.

**Full-body spiral.** Level turns from the bottom tip upwards, one per pitch of height. Each turn is the taut loop around the frame at that height. Above the top corner of the inner pentagon the frame splits into two points, so the wire winds one top point, runs back down to the notch and winds the other. A single loop around both would cross up to 125 cm of empty air and fill in the V.

**Points + centre.** Each point is a four-sided pyramid wound from its base to its tip, one turn per pitch along the bar. The centre is wound as a pentagonal box.

Each turn is counted as √(perimeter² + pitch²). With the defaults at 1.5 cm pitch:

| Method | Wire | 14 ft strips | With 10% |
|--------|------|--------------|----------|
| Full-body spiral | 265.5 m | 63 | 69 |
| Points + centre | 329.9 m | 78 | 86 |

## Assumptions

- **Pentagon shape** - Four 53 cm sides and a 58 cm bottom side don't fix a pentagon. The model uses the version whose corners lie on one circle, which is symmetric and closest to a regular pentagon.
- **Not included** - Sag, the lead to the plug and joins between pieces. The wastage buffer covers these.
- **Strip ends** - The strip table is worked out from the model. Real wire drifts a little, so check against the height marks while wrapping.

## Development

Requires Node.js 20 or later.

```sh
git clone https://github.com/abhijithvijayan/star-light-planner.git
cd star-light-planner
npm install
```

Run the page locally with Wrangler:

```sh
npm run dev
```

Run the tests, which check the frame geometry against the spec and the wire lengths for the default frame:

```sh
npm test
```

## Deployment

The page is served by a Cloudflare Worker with [static assets](https://developers.cloudflare.com/workers/static-assets/). The custom domain is declared in `wrangler.toml`.

```sh
npx wrangler login
npm run deploy
```

## Project Structure

```
├── public/
│   ├── index.html       # markup and styles
│   ├── calc.js          # geometry and wire length maths, no DOM
│   ├── app.js           # 3D view (three.js), controls and wrapping guide
│   └── robots.txt       # blocks search engine indexing
├── tests/
│   └── calc.test.js
├── wrangler.toml        # Cloudflare Worker config and custom domain
└── package.json
```

## Issues

_Looking to contribute? Look for the [Good First Issue](https://github.com/abhijithvijayan/star-light-planner/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22good+first+issue%22) label._

### Bugs

Please file an issue [here](https://github.com/abhijithvijayan/star-light-planner/issues/new) for bugs, missing documentation, or unexpected behavior.

[**See Bugs**](https://github.com/abhijithvijayan/star-light-planner/issues?q=is%3Aissue+is%3Aopen+sort%3Aupdated-desc+label%3A%22type%3A+bug%22)

## License

MIT © [Abhijith Vijayan](https://abhijithvijayan.in)
